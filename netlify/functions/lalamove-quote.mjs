// netlify/functions/lalamove-quote.mjs
// ESM-функция Netlify (Node 18+). Эндпоинт: /.netlify/functions/lalamove-quote
// Сейчас считает локально "как у Lalamove". Готова к замене на реальный API позже.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Use POST' }, 405);
  }

  try {
    const payload = await safeJson(req);
    if (!payload) return json({ ok: false, error: 'Invalid JSON' }, 400);

    const { pickup, dropoff, serviceType = 'MOTORCYCLE' } = payload;

    // Валидация входа
    const err = validatePoints(pickup, dropoff);
    if (err) return json({ ok: false, error: err }, 400);

    const distKm = haversine(
      Number(pickup.lat),
      Number(pickup.lng),
      Number(dropoff.lat),
      Number(dropoff.lng)
    );

    // === Локальный тариф (твои правила) ===
    const baseTHB = 50;
    const tier_0_5  = Math.min(distKm, 5) * 0;
    const tier_5_15 = Math.max(Math.min(distKm, 15) - 5, 0) * 10;
    const tier_15p  = Math.max(distKm - 15, 0) * 15;

    let raw = baseTHB + tier_0_5 + tier_5_15 + tier_15p;
    const totalRounded = Math.max(0, Math.round(raw / 5) * 5);

    const etaMinutes = estimateETA(distKm, serviceType);

    return json({
      ok: true,
      currency: 'THB',
      serviceType,
      distanceKm: Number(distKm.toFixed(2)),
      breakdown: {
        baseTHB,
        tier_0_5: Math.round(tier_0_5),
        tier_5_15: Math.round(tier_5_15),
        tier_15p: Math.round(tier_15p),
      },
      totalFee: totalRounded,
      etaMinutes,
      // Пометка источника — сейчас локально; когда подключим реальный API, сменим
      source: 'local-tariff'
    });

    // === Шаблон для будущего реального Lalamove ===
    // Если понадобится, добавим здесь:
    // const quote = await getLalamoveQuoteViaAPI({ pickup, dropoff, serviceType });
    // return json({ ok:true, ...quote, source:'lalamove' });

  } catch (e) {
    return json({ ok: false, error: 'Server error', details: String(e) }, 500);
  }
};

/* ----------------- Helpers ----------------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function safeJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function validatePoints(pickup, dropoff) {
  if (!pickup || !dropoff) return 'Need { pickup, dropoff }';
  const nums = [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng].map(Number);
  if (nums.some((v) => Number.isNaN(v))) return 'lat/lng must be numbers';
  if (Math.abs(nums[0]) > 90 || Math.abs(nums[2]) > 90) return 'bad latitude';
  if (Math.abs(nums[1]) > 180 || Math.abs(nums[3]) > 180) return 'bad longitude';
  return null;
}

// Haversine distance (km)
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Примерная ETA: скорость и буфер зависят от сервиса
function estimateETA(km, serviceType) {
  const speeds = {
    MOTORCYCLE: 25, // км/ч
    CAR: 30,
    VAN: 25,
  };
  const speed = speeds[serviceType] || 25;
  const driving = (km / speed) * 60; // минуты
  const buffer = 10; // на поиск курьера/погрузку
  return Math.max(8, Math.round(driving + buffer));
}

/* ----------------- Заглушка под реальный Lalamove (на будущее) -----------------

// 1) В Netlify → Site configuration → Environment variables добавим:
   LALAMOVE_PUBLIC_KEY
   LALAMOVE_SECRET_KEY
   LALAMOVE_HOST=https://sandbox-rest.lalamove.com  (или боевой)
// 2) Реализуем запрос к /v3/quotations с HMAC-подписью.
   Здесь опустил реализацию, чтобы не ломать деплой и не гадать формат подписи:
   документация Lalamove часто меняется. Когда будешь готов — скажи, добавлю
   готовый блок кода под твою версию API.

------------------------------------------------------------------------------- */
