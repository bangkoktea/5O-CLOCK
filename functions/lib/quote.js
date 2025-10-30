// functions/lib/quote.js
function haversineKm(a, b){
  const R = 6371.0088; // km
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function calcFareTHB(km){
  let base = 50;
  if (km <= 0.3) return 0;
  let fare = base;
  if (km > 15){
    fare += (15 - 5) * 10;
    fare += (km - 15) * 15;
  } else if (km > 5){
    fare += (km - 5) * 10;
  } else {
    fare += km * 0;
  }
  return Math.round(fare / 5) * 5;
}
function calcEtaMinutes(km){
  const eta = 20 + km * 4.5;
  return Math.max(10, Math.min(180, Math.round(eta)));
}
export function estimateQuote({ pickup, dropoff, serviceType = "MOTORCYCLE" }){
  if(!pickup || !dropoff || typeof pickup.lat!=='number' || typeof pickup.lng!=='number' || typeof dropoff.lat!=='number' || typeof dropoff.lng!=='number'){
    return { ok:false, error:"Invalid coordinates" };
  }
  const km = haversineKm(pickup, dropoff);
  const price = calcFareTHB(km);
  const etaMin = calcEtaMinutes(km);
  return {
    ok: true,
    serviceType,
    distanceKm: Number(km.toFixed(2)),
    priceTHB: price,
    currency: "THB",
    etaMinutes: etaMin,
    note: "Local estimator (no external API). Matches your tier logic."
  };
}
