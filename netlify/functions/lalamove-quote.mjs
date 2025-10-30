// netlify/functions/lalamove-quote.mjs
import { estimateQuote } from "../../functions/lib/quote.js";

export async function handler(event, context){
  if (event.httpMethod === "OPTIONS"){
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    };
  }
  if (event.httpMethod !== "POST"){
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok:false, error:"Method not allowed" })
    };
  }
  try{
    const body = JSON.parse(event.body || "{}");
    const { pickup, dropoff, serviceType } = body;
    const res = estimateQuote({ pickup, dropoff, serviceType });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(res)
    };
  }catch(e){
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok:false, error: e.message || "Internal error" })
    };
  }
}
