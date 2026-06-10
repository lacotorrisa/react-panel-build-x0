const { MongoClient, ObjectId } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Cargar Variables de Entorno desde .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error("❌ Archivo .env no encontrado en el directorio actual.");
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  return env;
}

const env = loadEnv();
const MONGODB_URI = env.MONGODB_URI;
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!MONGODB_URI || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Faltan credenciales en el archivo .env.");
  process.exit(1);
}

// Inicialización de clientes
const mongoClient = new MongoClient(MONGODB_URI);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const storeId = new ObjectId("69482da662b41878be90e5b6");
let clientId = null;
let paqueteriasList = [];
const orderSyncPromises = new Map();

// Función para limpiar acentos y caracteres especiales para matching
function cleanText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function getLocalDateString(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d)) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalTimeString(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d)) return "";
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getDaysDiff(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Mapeo inteligente de nombres de productos para consistencia con pedidos
function mapProductName(title) {
  return title.trim();
}

const obtenerPrecioUnitario = (nombre) => {
  const n = nombre.toUpperCase();
  if (n.includes('HOODIE')) return 1749;
  if (n.includes('JERSEY')) return 949;
  if (n.includes('WASHTEE')) return 899;
  if (n.includes('SLOBO') || n.includes('RICARDO') || n.includes('RICKACHU') || n.includes('VACA')) return 649;
  if (n.includes('WHITETEE') || n.includes('TEE NEGRA')) return 749;
  if (n.includes('GERRY')) return 999;
  if (n.includes('ALGODON') || n.includes('ALGODÓN')) return 599;
  return 649;
};

// Mapeo inteligente de nombres y tallas para compatibilidad
function mapProductInfo(title, size) {
  let sizeWord = size;
  if (size === 'S' || size === 'CH' || size === 'Chica') sizeWord = 'Chica';
  else if (size === 'M' || size === 'MED' || size === 'Mediana') sizeWord = 'Mediana';
  else if (size === 'L' || size === 'GDE' || size === 'Grande') sizeWord = 'Grande';
  else if (size === 'XL') sizeWord = 'XL';
  else if (size === 'XXL') sizeWord = 'XXL';

  const mappedName = mapProductName(title);

  return {
    nombre: `${mappedName} ${size}`,
    descripcion: `${mappedName} (${sizeWord})`,
    talla: size
  };
}

// Mapeo de estatus de MongoDB → colivery-admin
const mapOrderStatus = (mongoStatus) => {
  if (mongoStatus === 'delivered')        return 'entregado';
  if (mongoStatus === 'completed')        return 'entregado';   // completed = entregado
  if (mongoStatus === 'shipping')         return 'en_transito';
  if (mongoStatus === 'cancelled')        return 'problema';    // cancelado = problema/retorno
  if (mongoStatus === 'returned')         return 'problema';    // devuelto = problema/retorno
  // paid, processing, pending_payment → pendiente
  return 'pendiente';
};


const mapPaymentStatus = (mongoStatus) => {
  if (mongoStatus === 'pending_payment') return 'pendiente';
  return 'pagado';
};

// Sincronizar un único pedido (Encolado para evitar condiciones de carrera)
async function syncOrder(db, order) {
  const orderId = order._id.toString();
  
  if (orderSyncPromises.has(orderId)) {
    const currentPromise = orderSyncPromises.get(orderId);
    const nextPromise = currentPromise.then(() => syncOrderInternal(db, order));
    orderSyncPromises.set(orderId, nextPromise);
    return nextPromise;
  }

  const promise = syncOrderInternal(db, order).finally(() => {
    if (orderSyncPromises.get(orderId) === promise) {
      orderSyncPromises.delete(orderId);
    }
  });
  orderSyncPromises.set(orderId, promise);
  return promise;
}

// Lógica interna de sincronización de pedido
async function syncOrderInternal(db, order) {
  const orderNo = order.orderNumber || order._id.toString();
  const mongoDate = getLocalDateString(order.createdAt);
  const mongoTime = getLocalTimeString(order.createdAt);
  const buyerName = order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : "Sin Nombre";
  const cleanBuyer = cleanText(buyerName);

  const mappedStatus = mapOrderStatus(order.status);
  
  // Buscar paquetería
  let paqId = null;
  if (order.shipmentDetails?.carrier) {
    let carrierName = order.shipmentDetails.carrier.trim().toLowerCase();
    if (carrierName.includes('estafeta') || carrierName.includes('esatfeta') || carrierName.includes('esateta')) {
      carrierName = 'estafeta';
    } else if (carrierName.includes('fedex')) {
      carrierName = 'fedex';
    } else if (carrierName.includes('dhl')) {
      carrierName = 'dhl';
    } else if (carrierName.includes('imile') || carrierName.includes('i-mile')) {
      carrierName = 'imile';
    } else if (carrierName.includes('j&t') || carrierName.includes('jt ') || carrierName.includes('jet')) {
      carrierName = 'j&t';
    }
    // Match flexible: nombre contiene key o key contiene nombre
    const foundPaq = paqueteriasList.find(p =>
      p.nombre.toLowerCase() === carrierName ||
      p.nombre.toLowerCase().includes(carrierName) ||
      carrierName.includes(p.nombre.toLowerCase())
    );
    if (foundPaq) paqId = foundPaq.id;
  }


  const trackingNumber = order.shipmentDetails?.tracking_number?.trim() || null;
  const trackingUrl = order.shipmentDetails?.tracking_url || null;
  const eta = order.shipmentDetails?.eta_date || null;
  const notes = order.shipmentDetails?.notes || null;

  // Consultar pedidos existentes del cliente
  const { data: pedData, error: pedErr } = await supabase
    .from('pedidos')
    .select('*')
    .eq('cliente_id', clientId);

  if (pedErr) {
    console.error("❌ Error consultando pedidos en Supabase:", pedErr.message);
    return;
  }

  let existingPedidos = pedData || [];

  const address = order.shippingAddress ? 
    `${order.shippingAddress.address1}, ${order.shippingAddress.address2 || ''}, ${order.shippingAddress.city}, ${order.shippingAddress.state}, CP ${order.shippingAddress.postalCode}, ${order.shippingAddress.country}` : "Sin dirección";

  const paymentStatus = mapPaymentStatus(order.status);
  const mongoIdStr = order._id.toString();

  // Evaluar si es posterior o igual al 28 de mayo de 2026
  const orderDate = new Date(order.createdAt);
  const limitDate = new Date('2026-05-28T00:00:00Z');
  const shouldSplit = orderDate >= limitDate;

  // Obtener productos
  const itemsToSync = [];
  if (shouldSplit) {
    let index = 0;
    for (const item of order.items || []) {
      const product = await db.collection("Products").findOne({ _id: item.productId });
      const productTitle = product ? product.title : `Producto ID ${item.productId}`;
      const size = item.variantId ? item.variantId.split('-').pop() : 'N/A';
      const prodInfo = mapProductInfo(productTitle, size);
      
      const qty = item.quantity || 1;
      for (let q = 0; q < qty; q++) {
        itemsToSync.push({
          productos: [{
            nombre: prodInfo.nombre,
            descripcion: prodInfo.descripcion,
            talla: prodInfo.talla,
            cantidad: 1
          }],
          itemIndex: index++
        });
      }
    }
  } else {
    // Consolidated
    const mappedProducts = [];
    for (const item of order.items || []) {
      const product = await db.collection("Products").findOne({ _id: item.productId });
      const productTitle = product ? product.title : `Producto ID ${item.productId}`;
      const size = item.variantId ? item.variantId.split('-').pop() : 'N/A';
      const prodInfo = mapProductInfo(productTitle, size);
      mappedProducts.push({
        nombre: prodInfo.nombre,
        descripcion: prodInfo.descripcion,
        talla: prodInfo.talla,
        cantidad: item.quantity || 1
      });
    }
    itemsToSync.push({
      productos: mappedProducts,
      itemIndex: null
    });
  }

  // Cleanup: borrar filas del formato anterior en Supabase
  if (shouldSplit) {
    // Eliminar fila consolidada si existe (tiene el Mongo ID pero no tiene [Item Index:)
    const consolidatedMatch = existingPedidos.find(p => 
      p.observaciones && 
      p.observaciones.includes(`[Mongo ID: ${mongoIdStr}]`) && 
      !p.observaciones.includes('[Item Index:')
    );
    if (consolidatedMatch) {
      console.log(`🗑️  [Change Stream - Cleanup] Deleting consolidated order for #${orderNo} to split it`);
      const { error: delErr } = await supabase.from('pedidos').delete().eq('id', consolidatedMatch.id);
      if (delErr) console.error("   ❌ Error en cleanup:", delErr.message);
      existingPedidos = existingPedidos.filter(p => p.id !== consolidatedMatch.id);
    }
  } else {
    // Eliminar filas divididas si existen (tienen el Mongo ID y tienen [Item Index:)
    const splitMatches = existingPedidos.filter(p => 
      p.observaciones && 
      p.observaciones.includes(`[Mongo ID: ${mongoIdStr}]`) && 
      p.observaciones.includes('[Item Index:')
    );
    if (splitMatches.length > 0) {
      console.log(`🗑️  [Change Stream - Cleanup] Deleting ${splitMatches.length} split rows for #${orderNo} to consolidate`);
      for (const sm of splitMatches) {
        const { error: delErr } = await supabase.from('pedidos').delete().eq('id', sm.id);
        if (delErr) console.error("   ❌ Error en cleanup:", delErr.message);
      }
      existingPedidos = existingPedidos.filter(p => !splitMatches.some(sm => sm.id === p.id));
    }
  }

  // Sincronizar las filas requeridas (una consolidada, o múltiples divididas)
  for (const itemSync of itemsToSync) {
    const isSplit = itemSync.itemIndex !== null;
    const indexTag = isSplit ? `[Item Index: ${itemSync.itemIndex}]` : "";
    const uniqueObsKey = `[Mongo ID: ${mongoIdStr}]${isSplit ? ` [Item Index: ${itemSync.itemIndex}]` : ""}`;

    // Buscar match por [Mongo ID:] (pedidos del Change Stream)
    let match = existingPedidos.find(p => p.observaciones && p.observaciones.includes(uniqueObsKey));

    // Fallback: buscar por número de pedido ([Pedido: MX-XXXXX] o [mongo:MX-XXXXX])
    // Esto cubre pedidos importados por setup_inicial.cjs que usan ese formato
    if (!match && orderNo) {
      match = existingPedidos.find(p =>
        p.observaciones && (
          p.observaciones.includes(`[Pedido: ${orderNo}]`) ||
          p.observaciones.includes(`[mongo:${orderNo}]`)
        )
      );
      if (match) {
        console.log(`   🔗 Match por número de pedido: ${orderNo} (id: ${match.id})`);
      }
    }

    if (match) {
      if (match.tipo_compra === 'EXCLUSIVOS') {
        console.log(`⚠️  [Change Stream] Órden #${orderNo}${isSplit ? ` Prenda ${itemSync.itemIndex}` : ''} es EXCLUSIVO. No se altera.`);
        continue;
      }

      const paqIdToUse = paqId !== null ? paqId : match.paqueteria_id;
      const trackingNumberToUse = trackingNumber !== null ? trackingNumber : match.guia;
      const trackingUrlToUse = trackingUrl !== null ? trackingUrl : match.link_seguimiento;
      const etaToUse = eta !== null ? eta : match.tiempo_estimado_entrega;

      const trackingUpdate = match.guia !== trackingNumberToUse || match.paqueteria_id !== paqIdToUse;
      const statusUpdate = match.status !== mappedStatus;
      const paymentStatusUpdate = !match.observaciones || !match.observaciones.includes(`[Pago: ${paymentStatus}]`);

      const observacionesField = `[Pedido: ${orderNo}] [Hora: ${mongoTime}] [Pago: ${paymentStatus}] ${uniqueObsKey} ${notes || ''}`.trim();

      if (statusUpdate || trackingUpdate || paymentStatusUpdate) {
        console.log(`🔄 [Change Stream - Pedido Actualizado${isSplit ? ` Prenda ${itemSync.itemIndex}` : ''}] #${orderNo} (${buyerName}): '${match.status}' -> '${mappedStatus}' | Guía: '${match.guia}' -> '${trackingNumberToUse}'`);
        const { error: updErr } = await supabase
          .from('pedidos')
          .update({
            status: mappedStatus,
            paqueteria_id: paqIdToUse,
            guia: trackingNumberToUse,
            link_seguimiento: trackingUrlToUse,
            tiempo_estimado_entrega: etaToUse,
            productos: itemSync.productos,
            observaciones: observacionesField
          })
          .eq('id', match.id);

        if (updErr) {
          console.error(`   ❌ Error actualizando pedido ${match.id}:`, updErr.message);
        } else {
          console.log(`   ✅ Sincronizado correctamente.`);
        }
      }
    } else {
      console.log(`✨ [Change Stream - Nuevo Pedido${isSplit ? ` Prenda ${itemSync.itemIndex}` : ''}] #${orderNo} (${buyerName}) de fecha ${mongoDate}`);

      const observacionesField = `[Pedido: ${orderNo}] [Hora: ${mongoTime}] [Pago: ${paymentStatus}] ${uniqueObsKey} ${notes || ''}`.trim();

      const nuevoPedido = {
        cliente_id: clientId,
        tipo_compra: 'GENERAL',
        fecha_pedido: mongoDate,
        nombre_comprador: buyerName,
        direccion: address,
        telefono: order.customer?.phone || null,
        correo_comprador: order.email || '-',
        productos: itemSync.productos,
        status: mappedStatus,
        paqueteria_id: paqId,
        guia: trackingNumber,
        link_seguimiento: trackingUrl,
        tiempo_estimado_entrega: eta,
        observaciones: observacionesField,
        created_at: order.createdAt
      };

      const { error: insErr } = await supabase
        .from('pedidos')
        .insert(nuevoPedido);

      if (insErr) {
        console.error(`   ❌ Error insertando pedido nuevo:`, insErr.message);
      } else {
        console.log(`   ✅ Insertado correctamente como GENERAL.`);
        
        // Insertar automáticamente en trazabilidad_guias para desglose financiero
        try {
          const trazabilidadItems = [];
          itemSync.productos.forEach(prod => {
            const nombre = prod.nombre || 'Producto';
            const talla = prod.talla || '';
            const desc = talla && !nombre.includes(`(${talla})`) ? `${nombre} (${talla})` : nombre;
            const qty = parseInt(prod.cantidad) || 1;
            const precio = obtenerPrecioUnitario(nombre);

            for (let q = 0; q < qty; q++) {
              trazabilidadItems.push({
                cliente_id: clientId,
                numero_pedido: orderNo,
                nombre: buyerName || null,
                telefono: order.customer?.phone || null,
                fecha_compra: mongoDate,
                producto: desc,
                precio_tienda: precio,
                precio_envio: 99,
                comision_pct: mongoDate >= '2026-05-28' ? 10 : 20,
                costo_guia: 0,
                notas: `Sincronizado automáticamente desde pedidos`
              });
            }
          });

          if (trazabilidadItems.length > 0) {
            const { error: trazErr } = await supabase
              .from('trazabilidad_guias')
              .insert(trazabilidadItems);
            if (trazErr) {
              console.error(`   ❌ Error insertando trazabilidad_guias:`, trazErr.message);
            } else {
              console.log(`   ✅ Sincronizado automáticamente a trazabilidad_guias (${trazabilidadItems.length} items).`);
            }
          }
        } catch (trazEx) {
          console.error(`   ❌ Excepción al insertar trazabilidad_guias:`, trazEx.message);
        }
      }
    }
  }
}

// Sincronizar un único payout
async function syncPayout(payout) {
  const amount = payout.amount?.totalEarnings || 0;
  const rawDate = payout.processedAt || payout.createdAt || payout.date;
  const dateStr = getLocalDateString(rawDate);
  const notes = payout.notes || "Retiro general";
  const reference = payout._id.toString();

  const excludeAmounts = [7900, 4000, 3400, 15000, 19000];
  const isExcludedDate = (dStr) => {
    return dStr === '2026-05-31' || dStr === '2026-06-01' || dStr === '2026-06-02';
  };

  if (excludeAmounts.includes(amount) && isExcludedDate(dateStr)) {
    console.log(`🚫 [Change Stream - Payout Omitido] MX$${amount} del ${dateStr} (Excluido por regla de negocio)`);
    return;
  }

  // Verificar si ya existe en Supabase
  const { data: existing, error } = await supabase
    .from('cliente_transferencias')
    .select('id')
    .eq('cliente_id', clientId)
    .eq('fecha', dateStr)
    .eq('monto', amount)
    .eq('tienda', 'general');

  if (error) {
    console.error("❌ Error consultando Payouts en Supabase:", error.message);
    return;
  }

  if (existing.length > 0) {
    return; // Ya existe
  }

  let timeStr = null;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d)) timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  console.log(`✨ [Change Stream - Payout Nuevo] MX$${amount} del ${dateStr} (${notes})`);

  const nuevoPayout = {
    cliente_id: clientId,
    fecha: dateStr,
    hora: timeStr,
    monto: amount,
    tienda: 'general',
    destinatario: 'La Cotorrisa',
    referencia: `${notes} (ID: ${reference})`,
    observaciones: `Sincronizado de MongoDB Payout ${reference}`
  };

  const { error: insErr } = await supabase
    .from('cliente_transferencias')
    .insert(nuevoPayout);

  if (insErr) {
    console.error(`   ❌ Error insertando Payout en Supabase:`, insErr.message);
  } else {
    console.log(`   ✅ Payout insertado correctamente.`);
  }
}

async function start() {
  console.log("\n=======================================================");
  console.log("⚡ INICIANDO MOTOR DE SINCRONIZACIÓN EN TIEMPO REAL ⚡");
  console.log("=======================================================");

  try {
    // 1. Conexión y carga de datos iniciales en Supabase
    await supabase.auth.signInWithPassword({
      email: 'admin@colivery.mx',
      password: 'admin123'
    });

    const { data: clientData } = await supabase
      .from('clientes')
      .select('id')
      .eq('nombre', 'La Cotorrisa')
      .single();

    clientId = clientData.id;

    const { data: paqData } = await supabase.from('paqueterias').select('id, nombre');
    paqueteriasList = paqData || [];

    console.log(`✅ Supabase configurado (Cliente ID: ${clientId})`);
    console.log(`✅ Paqueterías cargadas: ${paqueteriasList.map(p => p.nombre).join(', ')}`);

    // 2. Conexión a MongoDB
    await mongoClient.connect();
    const db = mongoClient.db("prod");
    console.log("✅ Conectado a MongoDB.");

    // 3. Crear los Change Streams
    console.log("\n📡 Escuchando cambios en la base de datos de MongoDB Atlas...");

    // Stream para órdenes
    const ordersStream = db.collection("Orders").watch([
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace'] },
          $or: [
            { 'fullDocument.storeId': storeId },
            { 'fullDocument.store': storeId },
            { 'fullDocument.storeId': storeId.toString() },
            { 'fullDocument.store': storeId.toString() }
          ]
        }
      }
    ], { fullDocument: 'updateLookup' });

    ordersStream.on('change', async (next) => {
      try {
        if (next.fullDocument) {
          const status = next.fullDocument.status;
          // Incluir TODOS los status relevantes, incluyendo delivered/completed
          if (['paid', 'processing', 'pending_payment', 'shipping', 'delivered', 'completed', 'cancelled', 'returned'].includes(status)) {
            await syncOrder(db, next.fullDocument);
          }
        }
      } catch (err) {
        console.error("❌ Error procesando evento de orden:", err.message);
      }
    });

    // Stream para payouts
    const payoutsStream = db.collection("Payouts").watch([
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace'] },
          $or: [
            { 'fullDocument.storeId': storeId },
            { 'fullDocument.store': storeId },
            { 'fullDocument.storeId': storeId.toString() },
            { 'fullDocument.store': storeId.toString() }
          ]
        }
      }
    ], { fullDocument: 'updateLookup' });

    payoutsStream.on('change', async (next) => {
      try {
        if (next.fullDocument && next.fullDocument.status === 'completed') {
          await syncPayout(next.fullDocument);
        }
      } catch (err) {
        console.error("❌ Error procesando evento de payout:", err.message);
      }
    });

    // Stream para productos (inventario)
    const productsStream = db.collection("Products").watch([
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace'] },
          $or: [
            { 'fullDocument.stores': storeId },
            { 'fullDocument.store': storeId },
            { 'fullDocument.storeId': storeId },
            { 'fullDocument.stores': storeId.toString() },
            { 'fullDocument.store': storeId.toString() },
            { 'fullDocument.storeId': storeId.toString() }
          ]
        }
      }
    ], { fullDocument: 'updateLookup' });

    productsStream.on('change', async (next) => {
      try {
        if (next.fullDocument) {
          console.log(`📡 [Change Stream - Producto] Cambio en "${next.fullDocument.title}". Sincronizando inventario...`);
          const { runInventorySync } = require('./sync_inventory.cjs');
          await runInventorySync(true);
        }
      } catch (err) {
        console.error("❌ Error sincronizando inventario en change stream:", err.message);
      }
    });

    // Sincronizar inventario inicial al arrancar
    try {
      console.log("📦 Sincronizando inventario inicial...");
      const { runInventorySync } = require('./sync_inventory.cjs');
      await runInventorySync(true);
    } catch (e) {
      console.error("❌ Error en la sincronización de inventario inicial:", e.message);
    }

    // Mantener proceso vivo
    console.log("🚀 Motor de sincronización en ejecución. Presiona Ctrl+C para salir.\n");

  } catch (err) {
    console.error("❌ Error en el motor de sincronización:", err.message);
    process.exit(1);
  }
}

start();
