// /api/lalamove-quote.js
import { estimateQuote } from "../functions/lib/quote.js";

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try{
    const { pickup, dropoff, serviceType } = req.body || {};
    const result = estimateQuote({ pickup, dropoff, serviceType });
    return res.status(200).json(result);
  }catch(e){
    return res.status(500).json({ ok:false, error: e.message || "Internal error" });
  }
}
