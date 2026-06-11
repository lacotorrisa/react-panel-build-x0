/**
 * /api/sync-full.js
 * API serverless que sincroniza MongoDB -> Supabase:
 * 1. Pedidos (tabla `pedidos`)
 * 2. Trazabilidad (tabla `trazabilidad_guias`)
 * 3. Payouts (tabla `cliente_transferencias`)
 * 
 * GET  /api/sync-full?desde=2026-06-01   → sync desde esa fecha
 * GET  /api/sync-full                     → últimas 48h
 * GET  /api/sync-full?full=1              → todo el historial (últimos 60 días)
 */
import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';

const MONGO_URI    = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL  = 'admin@colivery.mx';
const ADMIN_PASS   = 'admin123';
const MONGO_STORE_ID = '69482da662b41878be90e5b6';
const CLIENTE_ID     = '1882e9a0-4dc0-4a03-96e4-ffa5712cda09';

const VALID_STATUSES = ['paid','processing','shipping','delivered','completed','pending_payment'];

const STATUS_MAP = {
  paid: 'pendiente', processing: 'pendiente', pending_payment: 'pendiente',
  shipping: 'en_transito', completed: 'entregado', delivered: 'entregado',
};

// Precio por nombre de producto (fallback si no está en Products)
const getPrecioFallback = (nombre = '') => {
  const n = nombre.toUpperCase();
  if (n.includes('HOODIE')) return 1749;
  if (n.includes('JERSEY')) return 949;
  if (n.includes('WASHTEE') || n.includes('WASH TEE')) return 899;
  if (n.includes('WHITETEE') || n.includes('WHITE TEE') || n.includes('NEGRA')) return 749;
  if (n.includes('GERRY')) return 999;
  return 699;
};

let cachedMongo = null;
async function getMongo() {
  if (!cachedMongo) {
    cachedMongo = new MongoClient(MONGO_URI);
    await cachedMongo.connect();
  }
  return cachedMongo;
}

// Fecha MX desde UTC
const toMXDate = (d) => {
  const mx = new Date(new Date(d).getTime() - 6*60*60*1000);
  return mx.toISOString().split('T')[0];
};
const toMXTime = (d) => {
  const mx = new Date(new Date(d).getTime() - 6*60*60*1000);
  return mx.toISOString().split('T')[1].substr(0,5);
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const startTime = Date.now();
  const log = [];

  try {
    // ── Auth Supabase ──────────────────────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (authErr) return res.status(500).json({ error: 'Auth Supabase: ' + authErr.message });

    // ── Conexión Mongo ─────────────────────────────────────────────
    const mongo = await getMongo();
    const db = mongo.db('prod');
    const storeId = new ObjectId(MONGO_STORE_ID);

    // ── Rango de fechas ────────────────────────────────────────────
    const { desde, full } = req.query;
    let fechaDesde;
    if (full === '1') {
      fechaDesde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 días
    } else if (desde) {
      fechaDesde = new Date(desde);
    } else {
      fechaDesde = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h por default
    }

    // ── 1. Traer órdenes de Mongo ─────────────────────────────────
    const mongoOrders = await db.collection('Orders').find({
      storeId, status: { $in: VALID_STATUSES },
      createdAt: { $gte: fechaDesde }
    }).sort({ createdAt: 1 }).toArray();

    log.push(`📦 Órdenes Mongo: ${mongoOrders.length}`);

    // ── 2. Pre-cargar productos ────────────────────────────────────
    const prodIds = new Set();
    mongoOrders.forEach(o => (o.items||[]).forEach(i => { if (i.productId) prodIds.add(i.productId.toString()); }));
    const prods = await db.collection('Products').find({
      _id: { $in: [...prodIds].map(id => { try { return new ObjectId(id); } catch { return id; } }) }
    }).toArray();
    const prodMap = new Map();
    prods.forEach(p => prodMap.set(p._id.toString(), p));

    // ── 3. Traer paqueterías de Supabase ───────────────────────────
    const { data: paqList } = await supabase.from('paqueterias').select('id, nombre');
    const paqMap = {};
    (paqList||[]).forEach(p => { paqMap[p.nombre.toLowerCase()] = p.id; });

    // ── 4. Tags existentes en pedidos ─────────────────────────────
    const { data: existPedidos } = await supabase
      .from('pedidos').select('observaciones, status, guia, paqueteria_id')
      .eq('cliente_id', CLIENTE_ID).like('observaciones', '%[Pedido:%');
    const existObs = new Set((existPedidos||[]).map(p => {
      const m = (p.observaciones||'').match(/\[Pedido:\s*([^\]]+)\]/);
      return m ? m[1].trim() : null;
    }).filter(Boolean));

    // ── 5. Sync pedidos ────────────────────────────────────────────
    let pedidosNuevos = 0, pedidosActualizados = 0;
    const pedidosInsert = [];
    const trazInsert    = [];

    // Pedidos existentes en trazabilidad para no duplicar
    const { data: trazExist } = await supabase
      .from('trazabilidad_guias').select('numero_pedido')
      .eq('cliente_id', CLIENTE_ID).gte('fecha_compra', toMXDate(fechaDesde));
    const trazExistSet = new Set((trazExist||[]).map(t => (t.numero_pedido||'').replace(/-\d+$/,'')));

    for (const order of mongoOrders) {
      const orderNo  = order.orderNumber || order._id.toString();
      const fechaMX  = toMXDate(order.createdAt);
      const horaMX   = toMXTime(order.createdAt);
      const nombre   = `${order.customer?.firstName||''} ${order.customer?.lastName||''}`.trim() || 'Sin nombre';
      const correo   = order.email || order.customer?.email || '';
      const tel      = order.customer?.phone || null;
      const addr     = order.shippingAddress;
      const direccion= addr ? `${addr.address1||''}, ${addr.city||''}, ${addr.state||''}, CP ${addr.postalCode||''}, México` : '';
      const status   = STATUS_MAP[order.status] || 'pendiente';
      const guia     = order.shipmentDetails?.tracking_number || null;
      const carrier  = (order.shipmentDetails?.carrier||'').toLowerCase();
      const paqId    = paqMap[carrier.includes('estafeta')?'estafeta':carrier.includes('dhl')?'dhl':carrier.includes('fedex')?'fedex':carrier.includes('imile')?'imile':carrier] || null;
      const isPending= order.status === 'pending_payment';
      const obs      = `[Pedido: ${orderNo}] [Hora: ${horaMX}] [Pago: ${isPending?'pendiente':'pagado'}] [Mongo ID: ${order._id}]`;

      // Insertar en pedidos si no existe
      if (!existObs.has(orderNo) && !isPending) {
        const productos = (order.items||[]).flatMap(item => {
          const p = prodMap.get(item.productId?.toString());
          const title = p?.title || p?.name || 'Producto La Cotorrisa';
          const qty = item.quantity || 1;
          return Array(qty).fill({ nombre: title, talla: item.variantId||null, cantidad: 1, precio: item.unitPrice||0 });
        });
        pedidosInsert.push({
          cliente_id: CLIENTE_ID, tipo_compra: 'GENERAL', fecha_pedido: fechaMX,
          nombre_comprador: nombre, correo_comprador: correo, telefono: tel,
          direccion, productos, status, paqueteria_id: paqId, guia,
          observaciones: obs, created_at: order.createdAt,
        });
        pedidosNuevos++;
      }

      // Insertar en trazabilidad_guias si no existe
      if (!trazExistSet.has(orderNo) && !isPending) {
        const totals = order.totals || {};
        const pricingFees = order.pricingFees || {};
        const prendaTotal = totals.subtotal || (totals.total - (totals.shippingCost||0)) || 0;
        const envioTotal  = totals.shippingCost || 0;

        // Una fila por item
        for (const item of (order.items||[])) {
          const p = prodMap.get(item.productId?.toString());
          const title = p?.title || p?.name || 'Producto La Cotorrisa';
          const talla = item.variantId ? item.variantId.split('-').pop() : '';
          const qty   = item.quantity || 1;
          const precio_unitario = item.unitPrice || getPrecioFallback(title);
          const comPct = fechaMX >= '2026-05-28' ? 10 : 20;

          for (let q = 0; q < qty; q++) {
            trazInsert.push({
              cliente_id:    CLIENTE_ID,
              numero_pedido: orderNo,
              nombre:        nombre,
              telefono:      tel,
              fecha_compra:  fechaMX,
              nombre_producto: talla ? `${title} - ${talla}` : title,
              producto:      talla ? `${title} - ${talla}` : title,
              precio_tienda: precio_unitario,
              precio_envio:  q === 0 ? envioTotal / (order.items?.length||1) : 0,
              comision_pct:  comPct,
              costo_guia:    0,
              status:        status,
              guia:          guia,
              notas:         `Sync auto [${order.status}]`,
            });
          }
        }
        trazExistSet.add(orderNo);
      }
    }

    // Batch inserts (50 por lote)
    const batchInsert = async (table, rows) => {
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase.from(table).insert(rows.slice(i, i+50));
        if (error) log.push(`⚠️ Error en ${table}: ${error.message}`);
        else inserted += rows.slice(i, i+50).length;
      }
      return inserted;
    };

    const pedInserted = await batchInsert('pedidos', pedidosInsert);
    const trazInserted = await batchInsert('trazabilidad_guias', trazInsert);

    log.push(`✅ Pedidos insertados: ${pedInserted}`);
    log.push(`✅ Trazabilidad insertada: ${trazInserted}`);

    // ── 6. Sync Payouts ────────────────────────────────────────────
    const payouts = await db.collection('Payouts').find({
      storeId, status: 'completed'
    }).toArray();

    const { data: existPayouts } = await supabase
      .from('cliente_transferencias').select('fecha, monto').eq('cliente_id', CLIENTE_ID);
    const existPaySet = new Set((existPayouts||[]).map(p => `${p.fecha}_${p.monto}`));

    let payoutsInserted = 0;
    const payInsert = [];
    // Excluir los que ya estaban manuales: $4000, $3400, $15000, $19000 del 1 jun
    const EXCLUIR = [{f:'2026-06-01',m:4000},{f:'2026-06-01',m:3400},{f:'2026-06-01',m:15000},{f:'2026-06-01',m:19000}];
    for (const p of payouts) {
      const amount = p.amount?.totalEarnings || 0;
      const fecha  = toMXDate(p.processedAt || p.createdAt);
      const hora   = toMXTime(p.processedAt || p.createdAt);
      const key    = `${fecha}_${amount}`;
      const excluir = EXCLUIR.some(e => e.f === fecha && e.m === amount);
      if (!existPaySet.has(key) && !excluir) {
        payInsert.push({
          cliente_id: CLIENTE_ID, fecha, hora, monto: amount,
          tienda: 'general', destinatario: 'La Cotorrisa',
          referencia: `Payout Colivery ${p._id}`,
          observaciones: `Sync auto desde MongoDB`
        });
        payoutsInserted++;
      }
    }
    if (payInsert.length) await batchInsert('cliente_transferencias', payInsert);
    log.push(`✅ Payouts sincronizados: ${payoutsInserted}`);

    return res.status(200).json({
      ok: true,
      duracion_ms: Date.now() - startTime,
      periodo: { desde: fechaDesde.toISOString(), hasta: new Date().toISOString() },
      resultados: {
        ordenes_mongo: mongoOrders.length,
        pedidos_nuevos: pedInserted,
        trazabilidad_nuevas: trazInserted,
        payouts_nuevos: payoutsInserted,
      },
      log,
    });

  } catch (err) {
    console.error('/api/sync-full error:', err);
    return res.status(500).json({ error: err.message, log });
  }
}
