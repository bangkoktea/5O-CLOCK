// netlify/functions/lalamove-quote.mjs
// Диагностический вариант: помогает понять, какие env не приходят в функцию

const REQD = [
  'LALAMOVE_API_KEY',
  'LALAMOVE_API_SECRET',
  'LALAMOVE_MARKET',
  'LALAMOVE_COUNTRY',
  'LALAMOVE_BASE_URL',
];

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

function readEnv() {
  const env = {};
  for (const k of REQD) env[k] = process.env[k] || '';
  return env;
}

function findMissing(env) {
  return REQD.filter((k) => !String(env[k] || '').trim());
}

export async function handler(event) {
  try {
    // ПИНГ: быстро проверить, видит ли функция переменные окружения
    const url = new URL(event.rawUrl || `https://x.x${event.path}?${event.queryStringParameters || ''}`);
    if (event.httpMethod === 'GET' && (url.searchParams.get('ping') === '1' || url.searchParams.get('ping') === 'true')) {
      const env = readEnv();
      const missing = findMissing(env);
      return json( missing.length ? 500 : 200, {
        ok: missing.length === 0,
        missing,
        present: Object.fromEntries(REQD.map(k => [k, !!String(env[k]).trim()])),
        note: 'Если missing не пуст — проверьте имена переменных, scope (Functions+Runtime) и выполните Clear cache and deploy.',
      });
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const env = readEnv();
    const missing = findMissing(env);
    if (missing.length) {
      console.log('[ENV_MISSING]', missing);
      return json(500, { error: 'Missing Lalamove keys', missing });
    }

    // --- ниже обычная логика запроса в Lalamove (SANDBOX/PROD одинаково — зависит от BASE_URL) ---
    const { pickup, dropoff, serviceType = 'MOTORCYCLE' } = JSON.parse(event.body || '{}');

    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return json(400, { error: 'Bad request: pickup/dropoff lat/lng required' });
    }

    // Простейший запрос QRF (quote) — как пример; специфика Lalamove может отличаться,
    // важна демонстрация работы ключей и roundtrip.
    const payload = {
      scheduleAt: 'NOW',
      serviceType,
      specialRequests: [],
      stops: [
        { coordinates: { lat: String(pickup.lat),  lng: String(pickup.lng)  } },
        { coordinates: { lat: String(dropoff.lat), lng: String(dropoff.lng) } },
      ],
      requesterContact: { name: '5oclock', phone: '+66' },
    };

    // Подпись зависит от актуальной версии API Lalamove; для песочницы часто не требуется строгая подпись.
    // Ниже – безопасный «пасс» без подписи, чтобы проверить сетку/ключи. Если ваш аккаунт требует подпись,
    // её можно добавить, но сначала добьёмся, что env приходят.
    const res = await fetch(`${env.LALAMOVE_BASE_URL}/v3/quotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Market': env.LALAMOVE_MARKET,
        'Country': env.LALAMOVE_COUNTRY,
        'Authorization': `hmac ${env.LALAMOVE_API_KEY}:${env.LALAMOVE_API_SECRET}`, // временно, для обхода CORS/проверки
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return json(res.ok ? 200 : res.status, {
      ok: res.ok,
      status: res.status,
      data,
    });

  } catch (e) {
    console.error(e);
    return json(500, { error: e.message || 'Server error' });
  }
}
