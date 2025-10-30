// Netlify serverless: /.netlify/functions/lalamove-quote
// Вход:  { pickup:{lat,lng}, dropoff:{lat,lng}, serviceType:"MOTORCYCLE"|... }
// Выход: { priceTHB, currency, etaMinutes, raw }

export const config = { path: "/.netlify/functions/lalamove-quote" };

const allowedOrigins = [
  "https://<ВАШ_домен_GitHub_Pages>", // напр. https://bangkoktea.github.io
  "http://localhost:5173",
  "http://localhost:8080",
];

function cors(origin){
  const allow = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(event.headers.origin) };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST", headers: cors(event.headers.origin) };
  }

  try {
    const {
      LALAMOVE_API_KEY,
      LALAMOVE_API_SECRET,
      LALAMOVE_BASE_URL = "https://rest.sandbox.lalamove.com",
      LALAMOVE_MARKET = "TH_BKK",   // при необходимости поменяете
      LALAMOVE_COUNTRY = "TH"       // TH
    } = process.env;

    if (!LALAMOVE_API_KEY || !LALAMOVE_API_SECRET) {
      return { statusCode: 500, body: "Missing Lalamove keys", headers: cors(event.headers.origin) };
    }

    const body = JSON.parse(event.body || "{}");
    const { pickup, dropoff, serviceType = "MOTORCYCLE" } = body;

    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return { statusCode: 400, body: "Bad coordinates", headers: cors(event.headers.origin) };
    }

    // Lalamove quotation payload (v3)
    const payload = {
      scheduleAt: "NOW",
      serviceType,           // "MOTORCYCLE" | "CAR" | ...
      stops: [
        { coordinates: { lat: String(pickup.lat),  lng: String(pickup.lng)  } },
        { coordinates: { lat: String(dropoff.lat), lng: String(dropoff.lng) } },
      ],
      isRouteOptimized: false,
      language: "en_TH",
    };

    const path = "/v3/quotations";
    const method = "POST";
    const timestamp = Date.now().toString();
    const requestBody = JSON.stringify(payload);

    // Lalamove HMAC (timestamp + \n + method + \n + path + \n + body)
    const stringToSign = `${timestamp}\r\n${method}\r\n${path}\r\n${requestBody}`;
    const crypto = await import("node:crypto");
    const signature = crypto.createHmac("sha256", LALAMOVE_API_SECRET)
                            .update(stringToSign)
                            .digest("base64");

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `hmac ${LALAMOVE_API_KEY}:${timestamp}:${signature}`,
      "Market": LALAMOVE_MARKET,      // пример: TH_BKK
      "Country": LALAMOVE_COUNTRY,    // пример: TH
      "Request-ID": crypto.randomBytes(8).toString("hex"),
      "Accept": "application/json",
    };

    const res = await fetch(LALAMOVE_BASE_URL + path, {
      method, headers, body: requestBody
    });

    const raw = await res.json().catch(()=> ({}));
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: cors(event.headers.origin),
        body: JSON.stringify({ error: raw || await res.text() }),
      };
    }

    // Простейший парсер цены/ETA (в ответе Lalamove поля могут называться priceBreakdown / totalFee / quotations[0] и т.п.)
    const price = Number(raw?.totalFee || raw?.price || raw?.totalPrice || 0);
    const currency = raw?.currency || "THB";
    const etaMinutes = Number(raw?.estimatedTime || raw?.eta || 0);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...cors(event.headers.origin) },
      body: JSON.stringify({
        priceTHB: price,
        currency,
        etaMinutes,
        raw
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers: cors(event.headers.origin), body: JSON.stringify({ error: String(e) }) };
  }
}
