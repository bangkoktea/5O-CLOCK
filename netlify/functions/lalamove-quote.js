// netlify/functions/lalamove-quote.js
// CJS-версия (без ESM), чтобы исключить ошибки модулей на Netlify Runtime.
// Эта функция делает две вещи:
// 1) Валидирует входные данные и окружение
// 2) Либо зовёт Lalamove sandbox API, либо возвращает понятную ошибку/фолбэк

const ALLOW_ORIGIN = '*'; // поменяешь на свой домен при желании

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: cors,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { pickup, dropoff, serviceType } = payload || {};
  if (
    !pickup || typeof pickup.lat !== 'number' || typeof pickup.lng !== 'number' ||
    !dropoff || typeof dropoff.lat !== 'number' || typeof dropoff.lng !== 'number'
  ) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: 'pickup/dropoff must be {lat:number, lng:number}' }),
    };
  }

  const KEY     = process.env.LALAMOVE_API_KEY;
  const SECRET  = process.env.LALAMOVE_API_SECRET;
  const BASE    = process.env.LALAMOVE_BASE_URL || 'https://rest.sandbox.lalamove.com';
  const MARKET  = process.env.LALAMOVE_MARKET || 'TH';
  const COUNTRY = process.env.LALAMOVE_COUNTRY || 'TH';

  if (!KEY || !SECRET) {
    // Без ключей возвращаем понятную ошибку (и простой локальный расчёт как фолбэк).
    const km = haversine(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const localQuote = estimateLalamoveLikeFare(km);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        ok: false,
        reason: 'Missing Lalamove keys on server',
        sandbox: true,
        distance_km: km,
        estimateTHB: localQuote,
        note: 'Set LALAMOVE_API_KEY and LALAMOVE_API_SECRET in Netlify → Environment variables and redeploy.',
      }),
    };
  }

  // --- Lalamove v3 Quotation (Sandbox) ---
  // Важно: у Lalamove HMAC-подпись. Формула: HMAC-SHA256(secret, `${ts}\r\n${method}\r\n${path}\r\n${body}`)
  // Заголовок Authorization: `hmac ${key}:${signature}:${ts}`
  // Ниже реализована минимальная версия только для /v3/quotations.
  const path = '/v3/quotations';
  const url  = BASE + path;
  const method = 'POST';

  // Тело запроса для sandbox (минимум полей)
  const body = {
    scheduleAt: 'NOW',
    serviceType: serviceType || 'MOTORCYCLE',
    stops: [
      {
        coordinates: { lat: pickup.lat, lng: pickup.lng },
        address: 'Pickup',
      },
      {
        coordinates: { lat: dropoff.lat, lng: dropoff.lng },
        address: 'Dropoff',
      },
    ],
    country: COUNTRY,
    market: MARKET,
  };
  const rawBody = JSON.stringify(body);

  const ts = Date.now().toString(); // миллисекунды
  const toSign = `${ts}\r\n${method}\r\n${path}\r\n${rawBody}`;

  // Подпись
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', SECRET).update(toSign).digest('hex');
  const authorization = `hmac ${KEY}:${signature}:${ts}`;

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Accept': 'application/json',
        'X-LLM-Market': MARKET,   // важные хедеры для маршрутизации
        'X-LLM-Country': COUNTRY, // (названия хедеров в v3 именно такие)
      },
      body: rawBody,
    });

    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { /* оставим text как есть */ }

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: cors,
        body: JSON.stringify({
          ok: false,
          status: resp.status,
          error: json || text,
          sent: body,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, quote: json || text }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ ok: false, error: String(e) }),
    };
  }
};

// --- простая геометрия и фолбэк-тариф ---
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function estimateLalamoveLikeFare(km) {
  // Примерный локальный расчёт: база 40 + 7 THB/км после 3 км
  if (km <= 0) return 40;
  let fare = 40;
  const extra = Math.max(0, km - 3) * 7;
  fare += extra;
  return Math.round(fare / 5) * 5;
}
