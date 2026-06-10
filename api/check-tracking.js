/**
 * /api/check-tracking.js — Vercel Serverless
 * Consulta el estado real de un paquete en la página del carrier
 * GET /api/check-tracking?carrier=dhl&guia=2556457584
 */

const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*',
        'Accept-Language': 'es-MX,es;q=0.9',
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

function checkEntregado(body) {
  const t = body.toLowerCase();
  return (
    t.includes('entregado') ||
    t.includes('delivered') ||
    t.includes('delivery successful') ||
    t.includes('paquete entregado') ||
    t.includes('package delivered') ||
    t.includes('envío entregado') ||
    t.includes('signat') // "signature obtained"
  );
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { carrier = '', guia = '' } = req.query;
  const c = carrier.toLowerCase().trim();
  const g = guia.replace(/\s/g, '').trim();

  if (!c || !g) {
    return res.status(400).json({ error: 'carrier y guia son requeridos', entregado: false });
  }

  try {
    let url = '';
    let entregado = false;

    // ── DHL México ─────────────────────────────────────────
    if (c.includes('dhl')) {
      // Intentar API JSON de DHL MX
      const r1 = await fetchUrl(`https://rastreo.dhl.com.mx/rastreomia/api/tracking/${g}`);
      if (r1.status === 200) {
        entregado = checkEntregado(r1.body);
        if (!entregado) {
          // Fallback: página HTML
          const r2 = await fetchUrl(`https://rastreo.dhl.com.mx/${g}`);
          entregado = checkEntregado(r2.body);
        }
      } else {
        const r2 = await fetchUrl(`https://rastreo.dhl.com.mx/${g}`);
        entregado = checkEntregado(r2.body);
      }
    }

    // ── iMile ──────────────────────────────────────────────
    else if (c.includes('imile')) {
      const r = await fetchUrl(`https://track.imile.com/index.html#/track?no=${g}`);
      entregado = checkEntregado(r.body);
    }

    // ── FedEx ──────────────────────────────────────────────
    else if (c.includes('fedex')) {
      const r = await fetchUrl(`https://www.fedex.com/fedextrack/?trknbr=${g}`);
      entregado = checkEntregado(r.body);
    }

    // ── Estafeta ───────────────────────────────────────────
    else if (c.includes('estafeta')) {
      const r = await fetchUrl(`https://rastreo.estafeta.com/index.aspx?waybill=${g}`);
      entregado = checkEntregado(r.body);
    }

    // ── Paquete Express ───────────────────────────────────
    else if (c.includes('paquete express') || c.includes('paqueteexpress')) {
      const r = await fetchUrl(`https://www.paquetexpress.com.mx/rastreo?guia=${g}`);
      entregado = checkEntregado(r.body);
    }

    else {
      return res.status(200).json({ entregado: false, nota: `Carrier no soportado: ${carrier}` });
    }

    return res.status(200).json({ entregado, carrier: c, guia: g });

  } catch (err) {
    return res.status(200).json({ entregado: false, error: err.message });
  }
};
