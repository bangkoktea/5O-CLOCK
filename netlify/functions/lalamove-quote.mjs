// netlify/functions/lalamove-quote.mjs
export const config = { path: "/.netlify/functions/lalamove-quote" };

const {
  LALAMOVE_API_KEY,
  LALAMOVE_API_SECRET,
  LALAMOVE_BASE_URL,   // пример: https://rest.sandbox.lalamove.com
  LALAMOVE_COUNTRY,    // TH
  LALAMOVE_MARKET      // BKK
} = process.env;

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra
    }
  });
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  if (!LALAMOVE_API_KEY || !LALAMOVE_API_SECRET || !LALAMOVE_BASE_URL || !LALAMOVE_COUNTRY || !LALAMOVE_MARKET) {
    return json(500, { error: "Missing Lalamove keys" });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Bad JSON" });
  }

  const { pickup, dropoff, serviceType = "MOTORCYCLE" } = payload || {};
  if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
    return json(400, { error: "pickup/dropoff {lat,lng} required" });
  }

  // Подпись Lalamove (HMAC SHA256)
  const timestamp = Date.now().toString();
  const method = "POST";
  const path = "/v3/quotations";
  const body = {
    scheduleAt: "ASAP",
    serviceType,
    language: "en_TH",
    stops: [
      { coordinates: { lat: pickup.lat, lng: pickup.lng } },
      { coordinates: { lat: dropoff.lat, lng: dropoff.lng } }
    ],
    requesterContact: { name: "Web", phone: "0000000000" }
  };

  const rawBody = JSON.stringify(body);

  // Строка для подписи: <timestamp>\r\n<method>\r\n<path>\r\n<rawBody>
  const toSign = `${timestamp}\r\n${method}\r\n${path}\r\n${rawBody}`;

  // Вычисляем HMAC
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(LALAMOVE_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(toSign));
  const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  const auth =
    `hmac ${LALAMOVE_API_KEY}:${timestamp}:${signature}`;

  try {
    const r = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth,
        "Accept": "application/json",
        "X-LLM-Country": LALAMOVE_COUNTRY,
        "X-LLM-Market": LALAMOVE_MARKET
      },
      body: rawBody
    });

    const text = await r.text();
    // Пытаемся распарсить, но всегда возвращаем тело как есть для отладки
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok) return json(r.status, { ok: false, status: r.status, error: data });

    return json(200, { ok: true, data });
  } catch (e) {
    return json(502, { ok: false, error: String(e) });
  }
};
