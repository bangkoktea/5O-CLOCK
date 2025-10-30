# 5 o’clock Tea — Minimal Shop

Concise premium one‑pager for Bangkok area (Bangkok / Nonthaburi / Samut Prakan). English‑only. THB (VAT included).

## Structure
- `index.html` — static page, vanilla CSS, minimal JS hooks.
- `app.js` — loads products, renders grid, manages cart & checkout (LINE / Email).
- `data/products.json` — single source of truth for SKUs (incl. Sampler).
- `images/` — product photos, logo, fixed QR placeholder (`qr-fixed.png`).

## Prices
- All SKUs except Sampler: **50 g = THB 195**, **75 g = THB 250**
- **Tea Sampler (3×20 g)** = **THB 195**
- Preorder items show **“Preorder only”** and note **“Preorder requires prepayment · ETA 7–10 days.”**

## Shipping
- Placeholder flat estimate (THB 70; free ≥ THB 500). Replace `estimateShipping()` with Lalamove quote later.

## Run locally
Just open `index.html` or use a simple server:
```bash
python -m http.server 8080
```

## Deploy
- GitHub Pages (static) or Netlify (recommended for adding Lalamove quotes via serverless function).
