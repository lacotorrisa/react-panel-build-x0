/**
 * /api/check-tracking.js — Vercel Serverless
 * Detecta el estado real de un paquete consultando la página pública del carrier.
 * Retorna: { status: 'entregado' | 'problema' | 'con_retraso' | 'en_transito', evento }
 */

const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
  });
}

/**
 * Analiza el texto del body y retorna el estado detectado.
 */
function detectarEstado(body) {
  const t = body.toLowerCase();

  // ── ENTREGADO ──────────────────────────────────────────────────
  const ENTREGADO = [
    'entregado', 'delivered', 'delivery successful', 'paquete entregado',
    'package delivered', 'envío entregado', 'signature obtained',
    'entregado al destinatario', 'entrega exitosa', 'delivered to',
    'successfully delivered', 'entrega realizada',
  ];
  if (ENTREGADO.some(k => t.includes(k))) {
    return { status: 'entregado', evento: 'Entrega confirmada' };
  }

  // ── PROBLEMA / INCIDENCIA ──────────────────────────────────────
  const PROBLEMA = [
    'devuelto', 'returned', 'retorno', 'regresado',
    'rechazado', 'rejected', 'refused',
    'no entregado', 'not delivered', 'undeliverable',
    'no se pudo entregar', 'failed delivery', 'delivery failed',
    'dirección incorrecta', 'address not found', 'destinatario ausente',
    'perdido', 'lost', 'dañado', 'damaged',
    'cancelado', 'cancelled', 'extraviado',
    'no hay nadie', 'nobody home', 'delivery exception',
    'problema', 'incidencia', 'exception',
  ];
  if (PROBLEMA.some(k => t.includes(k))) {
    return { status: 'problema', evento: 'Incidencia detectada en la entrega' };
  }

  // ── CON RETRASO ────────────────────────────────────────────────
  const RETRASO = [
    'retraso', 'delayed', 'demorado', 'demora',
    'en espera', 'on hold', 'delay', 'retraso en tránsito',
    'fuera de tiempo', 'tarde', 'retrasado',
  ];
  if (RETRASO.some(k => t.includes(k))) {
    return { status: 'con_retraso', evento: 'Retraso detectado' };
  }

  return { status: 'en_transito', evento: null };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { carrier = '', guia = '' } = req.query;
  const c = carrier.toLowerCase().trim();
  const g = guia.replace(/\s/g, '').trim();

  if (!c || !g) {
    return res.status(400).json({ error: 'carrier y guia son requeridos', status: 'en_transito' });
  }

  try {
    let body = '';

    // ── DHL México ─────────────────────────────────────────────
    if (c.includes('dhl')) {
      const r1 = await fetchUrl(`https://rastreo.dhl.com.mx/rastreomia/api/tracking/${g}`);
      if (r1.status === 200 && r1.body.length > 50) {
        body = r1.body;
      } else {
        const r2 = await fetchUrl(`https://rastreo.dhl.com.mx/${g}`);
        body = r2.body;
      }
    }

    // ── iMile ──────────────────────────────────────────────────
    else if (c.includes('imile')) {
      const r = await fetchUrl(`https://track.imile.com/index.html#/track?no=${g}`);
      body = r.body;
    }

    // ── FedEx ──────────────────────────────────────────────────
    else if (c.includes('fedex')) {
      const r = await fetchUrl(`https://www.fedex.com/fedextrack/?trknbr=${g}`);
      body = r.body;
    }

    // ── Estafeta ───────────────────────────────────────────────
    else if (c.includes('estafeta')) {
      const r = await fetchUrl(`https://rastreo.estafeta.com/index.aspx?waybill=${g}`);
      body = r.body;
    }

    // ── Paquete Express ────────────────────────────────────────
    else if (c.includes('paquete express') || c.includes('paqueteexpress')) {
      const r = await fetchUrl(`https://www.paquetexpress.com.mx/rastreo?guia=${g}`);
      body = r.body;
    }

    else {
      return res.status(200).json({ status: 'en_transito', nota: `Carrier no soportado: ${carrier}` });
    }

    const resultado = detectarEstado(body);
    return res.status(200).json({ ...resultado, carrier: c, guia: g });

  } catch (err) {
    return res.status(200).json({ status: 'en_transito', error: err.message });
  }
};
