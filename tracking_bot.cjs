/**
 * BOT DE RASTREO AUTOMÁTICO - Colivery Admin
 * ─────────────────────────────────────────────────────────────
 * Revisa todos los pedidos "en_transito" con guía asignada,
 * consulta el estatus real de cada carrier (DHL, iMile, FedEx, Estafeta)
 * y actualiza automáticamente a "entregado" cuando el paquete llegó.
 *
 * Carriers soportados:
 *   - DHL Mexico    → rastreo.dhl.com.mx
 *   - iMile Mexico  → track.imile.com
 *   - FedEx Mexico  → fedex.com
 *   - Estafeta      → estafeta.com
 */

const https = require('https');
const http  = require('http');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bqeinifjdhewlwwpeyfn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZWluaWZqZGhld2x3d3BleWZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM0MTQsImV4cCI6MjA5NDM4OTQxNH0.I2OmQRSpHXlmz-BgKihwBLpYA5MBkWCHYUU0eoMHSfA';
const CLIENTE_ID   = '1882e9a0-4dc0-4a03-96e4-ffa5712cda09';

// ─── Helpers de red ───────────────────────────────────────────
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'es-MX,es;q=0.9',
        ...options.headers,
      },
      timeout: 12000,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function fetchPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (url.startsWith('https') ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
      timeout: 12000,
    };
    const req = lib.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

// ─── Detectores de entrega por carrier ───────────────────────

/**
 * DHL México — usa la API pública JSON de rastreo
 */
async function checkDHL(guia) {
  try {
    // DHL tiene una API pública sin key en mx
    const url = `https://api-eu.dhl.com/track/shipments?trackingNumber=${guia.replace(/\s/g,'')}`;
    // Intentar con API pública de DHL
    const res = await fetchUrl(
      `https://rastreo.dhl.com.mx/rastreomia/api/tracking/${guia.replace(/\s/g,'')}`,
      { headers: { 'Accept': 'application/json', 'Referer': 'https://rastreo.dhl.com.mx/' } }
    );
    if (res.status === 200) {
      const text = res.body.toLowerCase();
      if (text.includes('entregado') || text.includes('delivered') || text.includes('delivery successful')) {
        return { entregado: true, evento: 'Entregado (DHL)' };
      }
    }
    // Fallback: scraping de la página HTML
    const res2 = await fetchUrl(`https://rastreo.dhl.com.mx/${guia.replace(/\s/g,'')}`);
    const text2 = res2.body.toLowerCase();
    if (text2.includes('entregado') || text2.includes('delivery successful') || text2.includes('paquete entregado')) {
      return { entregado: true, evento: 'Entregado (DHL)' };
    }
    return { entregado: false };
  } catch (e) {
    return { entregado: false, error: e.message };
  }
}

/**
 * iMile — usa su API de rastreo
 */
async function checkIMile(guia) {
  try {
    const cleanGuia = guia.replace(/\s/g, '');
    // API pública de iMile
    const res = await fetchPost(
      'https://track.imile.com/api/track/order',
      { orderNo: cleanGuia, language: 'es' },
      { 'Referer': 'https://track.imile.com/', 'Origin': 'https://track.imile.com' }
    );
    if (res.status === 200) {
      const json = JSON.parse(res.body);
      const status = (json?.data?.status || json?.data?.orderStatus || '').toLowerCase();
      const traces = json?.data?.traceList || json?.data?.traces || [];
      const lastEvent = traces[0]?.desc || traces[0]?.remark || '';
      if (status.includes('delivered') || status.includes('entregado') ||
          lastEvent.toLowerCase().includes('entregado') || lastEvent.toLowerCase().includes('delivered')) {
        return { entregado: true, evento: `Entregado (iMile): ${lastEvent}` };
      }
    }
    // Fallback: página HTML
    const res2 = await fetchUrl(`https://track.imile.com/index.html#/track?no=${cleanGuia}`);
    const text2 = res2.body.toLowerCase();
    if (text2.includes('delivered') || text2.includes('entregado')) {
      return { entregado: true, evento: 'Entregado (iMile)' };
    }
    return { entregado: false };
  } catch (e) {
    return { entregado: false, error: e.message };
  }
}

/**
 * FedEx México — scraping de la página pública
 */
async function checkFedEx(guia) {
  try {
    const cleanGuia = guia.replace(/\s/g, '');
    const res = await fetchUrl(
      `https://www.fedex.com/fedextrack/?trknbr=${cleanGuia}&trkqual=12023~${cleanGuia}~FDEG`,
      { headers: { 'Accept': 'text/html', 'Referer': 'https://www.fedex.com/' } }
    );
    const text = res.body.toLowerCase();
    if (text.includes('delivered') || text.includes('entregado') || text.includes('package delivered')) {
      return { entregado: true, evento: 'Entregado (FedEx)' };
    }
    return { entregado: false };
  } catch (e) {
    return { entregado: false, error: e.message };
  }
}

/**
 * Estafeta México — API JSON pública
 */
async function checkEstafeta(guia) {
  try {
    const cleanGuia = guia.replace(/\s/g, '');
    const res = await fetchPost(
      'https://rastreo.estafeta.com/api/v1/trackingInfo',
      { wayBillType: 'single', waybill: cleanGuia, waybillType: '1', searchType: 'L' },
      { 'Referer': 'https://rastreo.estafeta.com/', 'Origin': 'https://rastreo.estafeta.com' }
    );
    if (res.status === 200) {
      const text = res.body.toLowerCase();
      if (text.includes('entregado') || text.includes('delivered')) {
        return { entregado: true, evento: 'Entregado (Estafeta)' };
      }
    }
    return { entregado: false };
  } catch (e) {
    return { entregado: false, error: e.message };
  }
}

// ─── Dispatcher por carrier ───────────────────────────────────
async function checkCarrier(carrier, guia) {
  const c = (carrier || '').toLowerCase();
  if (c.includes('dhl'))      return checkDHL(guia);
  if (c.includes('imile'))    return checkIMile(guia);
  if (c.includes('fedex'))    return checkFedEx(guia);
  if (c.includes('estafeta')) return checkEstafeta(guia);
  return { entregado: false, error: `Carrier no soportado: ${carrier}` };
}

// ─── Motor principal ──────────────────────────────────────────
async function runTrackingBot(supabase, paqueteriasList, verbose = true) {
  const log = verbose ? console.log : () => {};
  log('\n🤖 [Tracking Bot] Iniciando barrido de paquetes en tránsito...');

  // 1. Traer todos los pedidos en_transito con guía
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('id, guia, paqueteria_id, nombre_comprador, status')
    .eq('cliente_id', CLIENTE_ID)
    .eq('status', 'en_transito')
    .not('guia', 'is', null);

  if (error) { log('❌ Error consultando pedidos:', error.message); return; }
  if (!pedidos?.length) { log('✅ No hay pedidos en tránsito con guía asignada.'); return; }

  log(`📦 ${pedidos.length} pedidos en tránsito. Consultando carriers...\n`);

  const paqMap = new Map((paqueteriasList||[]).map(p => [p.id, p.nombre]));

  let entregados = 0, errores = 0, pendientes = 0;

  for (const pedido of pedidos) {
    const carrier = paqMap.get(pedido.paqueteria_id) || '';
    const guia    = pedido.guia?.trim();

    if (!guia || !carrier) { pendientes++; continue; }

    try {
      // Delay entre consultas para no saturar los servidores
      await new Promise(r => setTimeout(r, 1200));

      const resultado = await checkCarrier(carrier, guia);

      if (resultado.entregado) {
        // ✅ Actualizar a entregado en Supabase
        const { error: updErr } = await supabase
          .from('pedidos')
          .update({ status: 'entregado' })
          .eq('id', pedido.id);

        if (updErr) {
          log(`❌ Error actualizando ${pedido.nombre_comprador}: ${updErr.message}`);
          errores++;
        } else {
          log(`✅ ENTREGADO: ${pedido.nombre_comprador} | Guía: ${guia} | ${carrier}`);
          if (resultado.evento) log(`   📍 ${resultado.evento}`);
          entregados++;
        }
      } else {
        if (verbose && resultado.error) {
          log(`   ⚠️  ${pedido.nombre_comprador} (${guia}): ${resultado.error}`);
        }
        pendientes++;
      }
    } catch (e) {
      log(`❌ ${pedido.nombre_comprador} (${guia}): ${e.message}`);
      errores++;
    }
  }

  log(`\n📊 [Tracking Bot] Barrido completo:`);
  log(`   ✅ Marcados como entregados: ${entregados}`);
  log(`   📦 Aún en tránsito: ${pendientes}`);
  log(`   ❌ Errores: ${errores}`);
  log(`   ⏰ Próximo barrido en 30 minutos\n`);

  return { entregados, pendientes, errores };
}

// ─── Modo standalone (ejecución directa) ─────────────────────
if (require.main === module) {
  (async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await supabase.auth.signInWithPassword({ email: 'admin@colivery.mx', password: 'admin123' });
    const { data: paq } = await supabase.from('paqueterias').select('id, nombre');
    await runTrackingBot(supabase, paq, true);
  })().catch(console.error);
}

module.exports = { runTrackingBot };
