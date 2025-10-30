// Netlify Function: POST { origin: "string address", destination: "string address" }
// Ответ: { price: number, distanceKm: number }
export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { origin, destination } = req.body || {};
    if (!origin || !destination) return res.status(400).json({ error: 'Bad payload' });

    // NOTE: тут должна быть интеграция с Lalamove REST (HMAC sign).
    // Для быстрого старта делаем геокод у Lalamove не вызывая:
    // 1) дергаем бесплатный Nominatim (или Google Geocoding, если есть ключ),
    // 2) считаем линию по прямой и применяем тариф как в ТЗ:
    const geocode = async (addr) => {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`, { headers: { 'User-Agent': '5oclock-shop' }});
      const j = await r.json();
      if (!j[0]) throw new Error('Geocode failed');
      return { lat: +j[0].lat, lng: +j[0].lon };
    };

    const [o, d] = await Promise.all([geocode(origin), geocode(destination)]);
    const R = 6371e3; // meters
    const toRad = x => x*Math.PI/180;
    const φ1 = toRad(o.lat), φ2 = toRad(d.lat);
    const Δφ = toRad(d.lat - o.lat), Δλ = toRad(d.lng - o.lng);
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    const distKm = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))) / 1000;

    // Тариф по твоей логике: base 50 + 0/10/15 THB/км (0–5 / 5–15 / 15+)
    let fare = 50;
    if (distKm > 15)      fare += (15 - 5) * 10 + (distKm - 15) * 15;
    else if (distKm > 5)  fare += (distKm - 5) * 10;
    // округлим к 5
    fare = Math.max(0, Math.round(fare / 5) * 5);

    return res.status(200).json({ price: fare, distanceKm: +distKm.toFixed(1) });
  } catch (e) {
    return res.status(500).json({ error: 'quote_error' });
  }
};
