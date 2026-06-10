import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';

const MONGO_URI = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL  = 'admin@colivery.mx';
const ADMIN_PASS   = 'admin123';

// La Cotorrisa Merch — IDs en MongoDB y Supabase
const MONGO_STORE_ID = '69482da662b41878be90e5b6';
const VALID_STATUSES = ['paid', 'processing', 'completed', 'delivered', 'shipping', 'pending_payment'];

// Mapeo de estatus MongoDB → Supabase
const STATUS_MAP = {
  paid:            'pendiente',
  processing:      'pendiente',
  shipping:        'en_transito',
  completed:       'entregado',
  delivered:       'entregado',
  pending_payment: 'pendiente',  // se distingue por el tag [Pago: pendiente] en observaciones
};

let cachedClient = null;

async function getMongoClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new MongoClient(MONGO_URI);
  await cachedClient.connect();
  return cachedClient;
}

/**
 * Convierte una Order de MongoDB al formato de Supabase.
 * Recibe el productMap pre-cargado para resolver nombres y tallas reales.
 */
function mapMongoOrderToSupabase(order, clienteId, productMap = new Map()) {
  // ── Cliente ──────────────────────────────────────────────
  const customer = order.customer || {};
  const nombre   = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || 'Sin nombre';
  const telefono = customer.phone || customer.phoneNumber || null;
  const correo   = order.email || customer.email || null;

  // ── Dirección (campo real: shippingAddress) ──────────────
  const addr = order.shippingAddress || {};
  const direccion = [addr.address1, addr.address2, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean).join(', ') || `Envío ${order.delivery?.shippingMethod || 'nacional'}`;

  // ── Productos con nombre y talla REALES ───────────────────
  const productos = (order.items || []).map(item => {
    const prod    = productMap.get(item.productId?.toString());
    const nombre_ = prod?.title || item.name || item.variantId || 'Producto La Cotorrisa';
    const variant = (prod?.variants || []).find(
      v => v.sku === item.variantId || v.id === item.variantId || v._id?.toString() === item.variantId
    );
    const talla = variant?.size || variant?.name || item.size || null;
    return {
      nombre:   nombre_,
      talla,
      cantidad: item.quantity || 1,
      precio:   item.unitPrice || 0,
    };
  });

  // ── Guía de rastreo ───────────────────────────────────────
  const shipment = order.shipmentDetails || {};
  const guia     = shipment.tracking_number || null;
  const link_seguimiento = shipment.tracking_url || null;

  // ── Status ────────────────────────────────────────────────
  const status = STATUS_MAP[(order.status || '').toLowerCase()] || 'pendiente';

  // ── Fecha y hora en hora México (UTC-6) ──────────────────
  // El servidor de Vercel corre en UTC, por eso restamos 6h para obtener
  // la fecha y hora local de México correctamente.
  const fechaUTC = order.createdAt ? new Date(order.createdAt) : new Date();
  const fechaMX  = new Date(fechaUTC.getTime() - 6 * 60 * 60 * 1000);
  const fecha_pedido = fechaMX.toISOString().split('T')[0];
  const horaStr = `${String(fechaMX.getUTCHours()).padStart(2,'0')}:${String(fechaMX.getUTCMinutes()).padStart(2,'0')}`;

  const orderNo = order.orderNumber || order._id?.toString();

  const isPagoPendiente = (order.status || '').toLowerCase() === 'pending_payment';
  const isoMX = `${fecha_pedido}T${horaStr}:00`;

  return {
    cliente_id:       clienteId,
    nombre_comprador: nombre,
    correo_comprador: correo,
    telefono,
    direccion,
    tipo_compra:      'GENERAL',
    fecha_pedido,
    status,
    guia,
    link_seguimiento,
    productos: productos.length > 0 ? productos : [{ nombre: 'Producto La Cotorrisa', talla: null, cantidad: 1, precio: 0 }],
    observaciones: [
      `[mongo:${orderNo}]`,
      `[Pedido: ${orderNo}]`,
      `[Hora: ${horaStr}]`,
      `[FechaISO: ${isoMX}]`,
      isPagoPendiente ? `[Pago: pendiente]` : null,
    ].filter(Boolean).join(' '),
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { desde } = req.query;

    const mongoClient = await getMongoClient();
    const db = mongoClient.db('prod');

    // Autenticar en Supabase (necesario para bypasear RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL, password: ADMIN_PASS,
    });
    if (authErr) {
      return res.status(500).json({ error: 'Auth Supabase fallida: ' + authErr.message });
    }

    // ── 0. Obtener clienteId de La Cotorrisa ─────────────────
    const { data: clienteRows } = await supabase
      .from('clientes').select('id').ilike('nombre', '%cotorrisa%').limit(1);
    const clienteId = clienteRows?.[0]?.id;
    if (!clienteId) {
      return res.status(400).json({ error: 'Cliente La Cotorrisa no encontrado en Supabase.' });
    }

    // ── 1. Construir filtro MongoDB ──────────────────────────
    const filter = {
      status: { $in: VALID_STATUSES },
      $or: [
        { store: new ObjectId(MONGO_STORE_ID) },
        { storeId: new ObjectId(MONGO_STORE_ID) },
        { store: MONGO_STORE_ID },
        { storeId: MONGO_STORE_ID },
      ],
    };

    if (desde) {
      filter.createdAt = { $gte: new Date(desde) };
    } else {
      // Por defecto: últimas 2 horas
      const dosHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
      filter.createdAt = { $gte: dosHorasAtras };
    }

    const mongoOrders = await db.collection('Orders')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    if (mongoOrders.length === 0) {
      return res.status(200).json({ nuevos: 0, importados: 0, pedidos: [] });
    }

    // ── Pre-cargar nombres de productos desde la colección Products ─
    const productIds = new Set();
    mongoOrders.forEach(o => (o.items || []).forEach(i => { if (i.productId) productIds.add(i.productId.toString()); }));

    const productsCursor = await db.collection('Products').find({
      _id: { $in: [...productIds].map(id => { try { return new ObjectId(id); } catch { return id; } }) }
    }).toArray();

    const productMap = new Map();
    productsCursor.forEach(p => {
      productMap.set(p._id.toString(), { title: p.title || p.name || 'Producto La Cotorrisa', variants: p.variants || [] });
    });

    // ── 2. Verificar cuáles ya existen (por tag [Pedido: XX] en observaciones) ─
    const orderNos = mongoOrders.map(o => `[Pedido: ${o.orderNumber || o._id}]`);
    // Buscar en lotes porque Supabase tiene límite de items en .in()
    let tagsYaGuardados = new Set();
    for (let i = 0; i < orderNos.length; i += 100) {
      const lote = orderNos.slice(i, i + 100);
      const { data: existentes } = await supabase
        .from('pedidos')
        .select('observaciones')
        .eq('cliente_id', clienteId)
        .in('observaciones', lote.map(tag => `%${tag}%`));
      // El .in() no funciona con LIKE, usamos or con contains
      if (existentes?.length) existentes.forEach(p => tagsYaGuardados.add(p.observaciones));
    }

    // Alternativa más simple y segura: traer todos los pedidos con tag [Pedido:] de Supabase
    const { data: todosConPedido } = await supabase
      .from('pedidos')
      .select('observaciones')
      .eq('cliente_id', clienteId)
      .like('observaciones', '%[Pedido:%');
    
    tagsYaGuardados = new Set((todosConPedido || []).map(p => {
      const m = (p.observaciones || '').match(/\[Pedido:\s*([^\]]+)\]/);
      return m ? m[1].trim() : null;
    }).filter(Boolean));

    // ── 3. Filtrar solo los nuevos ────────────────────────────
    const ordeneNuevas = mongoOrders.filter(o => {
      const orderNo = o.orderNumber || o._id?.toString();
      return !tagsYaGuardados.has(orderNo);
    });

    if (ordeneNuevas.length === 0) {
      return res.status(200).json({ nuevos: 0, importados: 0, pedidos: [] });
    }

    // ── 4. Mapear e insertar en Supabase ─────────────────────
    const pedidosMapeados = ordeneNuevas.map(o => mapMongoOrderToSupabase(o, clienteId, productMap));

    const { data: insertados, error: insertError } = await supabase
      .from('pedidos')
      .insert(pedidosMapeados)
      .select();

    if (insertError) {
      console.error('Error insertando en Supabase:', insertError);
      // Retornar los pedidos aunque falle el insert (para que el front pueda mostrarlos)
      return res.status(200).json({
        nuevos: ordeneNuevas.length,
        importados: 0,
        error: insertError.message,
        pedidos: pedidosMapeados,
      });
    }

    return res.status(200).json({
      nuevos: ordeneNuevas.length,
      importados: insertados?.length || 0,
      pedidos: insertados || pedidosMapeados,
    });

  } catch (err) {
    console.error('Error en /api/mongo-pedidos:', err);
    return res.status(500).json({ error: err.message });
  }
}
