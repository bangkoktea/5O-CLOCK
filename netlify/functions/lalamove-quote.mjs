// Реальный расчёт доставки через Lalamove API (с подписью HMAC-SHA256)
// Работает с ключами из Netlify Environment Variables

import crypto from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  try {
    const {
      LALAMOVE_API_KEY,
      LALAMOVE_API_SECRET,
      LALAMOVE_MARKET,
      LALAMOVE_COUNTRY,
      LALAMOVE_BASE_URL,
    } = process.env;

    const payload = JSON.parse(event.body || "{}");
    const { pickup, dropoff, serviceType = "MOTORCYCLE" } = payload;

    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return json({ error: "Bad pickup/dropoff" }, 400);
    }

    const path = "/v3/quotations";
    const method = "POST";
    const body = {
      scheduleAt: "NOW",
      serviceType,
      stops: [
        { coordinates: { lat: String(pickup.lat), lng: String(pickup.lng) } },
        { coordinates: { lat: String(dropoff.lat), lng: String(dropoff.lng) } },
      ],
      country: LALAMOVE_COUNTRY,
      market: LALAMOVE_MARKET,
    };

    const rawBody = JSON.stringify(body);
    const timestamp = Date.now().toString();
    const stringToSign = `${timestamp}\r\n${method}\r\n${path}\r\n${rawBody}`;

    // Подпись HMAC
    const signature = crypto
      .createHmac("sha256", LALAMOVE_API_SECRET)
      .update(stringToSign)
      .digest("hex");

    const authHeader = `hmac ${LALAMOVE_API_KEY}:${signature}:${timestamp}`;

    const response = await fetch(LALAMOVE_BASE_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        Accept: "application/json",
        "X-LLM-Market": LALAMOVE_MARKET,
        "X-LLM-Country": LALAMOVE_COUNTRY,
      },
      body: rawBody,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return json(
        {
          ok: false,
          status: response.status,
          error: data || text,
          sent: body,
        },
        response.status
      );
    }

    return json({ ok: true, data });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
}

function json(data, status = 200) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...CORS },
    body: JSON.stringify(data),
  };
}
