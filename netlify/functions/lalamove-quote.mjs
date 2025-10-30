// Netlify Function: Lalamove Quotation (REAL)
// ВАЖНО: Никаких моков. Если подпись/ключи неверные — вернём
// прозрачную ошибку Lalamove с кодом/текстом для быстрого дебага.

import crypto from 'node:crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// ——— подпись по Lalamove v3 ———
// signString = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`
// signature  = hex(HMAC-SHA256(secret, signString))
// Authorization: `hmac ${apiKey}:${signature}`

function hmacSign({ ts, method, path, body, secret }) {
  const signString = `${ts}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`;
  return crypto.createHmac('sha256', secret).update(signString).digest('hex');
}

// Хелпер для ответа
function json(code, payload) {
  return { statusCode: code, headers: { 'Content-Type':'application/json', ...CORS }, body: JSON.stringify(payload) };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')   return json(405, { ok:false, error:{ code:405, message:'Use POST' } });

  // ——— ENV ———
  const {
    LALAMOVE_API_KEY,
    LALAMOVE_API_SECRET,
    LALAMOVE_BASE_URL,   // напр. https://rest.sandbox.lalamove.com  или https://rest.lalamove.com
    LALAMOVE_MARKET,     // напр. TH
    LALAMOVE_COUNTRY     // напр. TH
  } = process.env;

  if (!LALAMOVE_API_KEY || !LALAMOVE_API_SECRET || !LALAMOVE_BASE_URL || !LALAMOVE_MARKET || !LALAMOVE_COUNTRY) {
    return json(500, { ok:false, error:{ code:'MISSING_ENV', message:'Missing Lalamove env vars (API_KEY/SECRET/BASE_URL/MARKET/COUNTRY)' } });
  }

  // ——— входные данные ———
  let req;
  try { req = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok:false, error:{ code:400, message:'Bad JSON' } }); }

  const { pickup, dropoff, serviceType = 'MOTORCYCLE' } = req || {};
  if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
    return json(400, { ok:false, error:{ code:400, message:'pickup/dropoff {lat,lng} required' } });
  }

  // ——— формируем тело запроса Lalamove /v3/quotations ———
  const path = '/v3/quotations';
  const url  = new URL(path, LALAMOVE_BASE_URL).toString();
  // минимально достаточное тело: serviceType + stops
  const llmBodyObj = {
    serviceType,
    stops: [
      { lat: String(pickup.lat),  lng: String(pickup.lng)  },
      { lat: String(dropoff.lat), lng: String(dropoff.lng) }
    ],
    // опционально: можно конкретизировать вес/категорию, если аккаунт того требует
    // item:{ quantity:1, weight:'LESS_THAN_3_KG', categories:['FOOD_DELIVERY'] },
    isRouteOptimized: false
  };
  const bodyStr = JSON.stringify(llmBodyObj);

  // ——— подпись ———
  const ts = Date.now().toString(); // миллисекунды — как требует Lalamove
  const signature = hmacSign({
    ts, method:'POST', path, body: bodyStr, secret: LALAMOVE_API_SECRET
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `hmac ${LALAMOVE_API_KEY}:${signature}`,
    'X-LLM-Market':  LALAMOVE_MARKET,
    'X-LLM-Country': LALAMOVE_COUNTRY,
    'X-LLM-Request-Timestamp': ts
  };

  try {
    const r = await fetch(url, { method:'POST', headers, body: bodyStr });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw:text }; }

    if (!r.ok) {
      // Отдаём наружу ошибку Lalamove «как есть», чтобы быстро фиксить ключ/подпись/права
      return json(r.status, { ok:false, error:{ code:r.status, message:'Lalamove error', data } });
    }

    // Ответ Lalamove содержит quotation с priceBreakdown/priceTotal/eta и т.п.
    return json(200, { ok:true, provider:'lalamove', quotation:data });
  } catch (e) {
    return json(502, { ok:false, error:{ code:502, message:'Upstream fetch failed', detail:e?.message } });
  }
}
