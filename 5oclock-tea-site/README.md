# 5 o’clock Tea — minimal shop (dual-host)

- **Front-end:** static (`/public`), deployable to GitHub Pages/Netlify/Vercel.
- **Delivery quote API:** works on **both** platforms:
  - Netlify: `/.netlify/functions/lalamove-quote` (file at `netlify/functions/lalamove-quote.mjs`)
  - Vercel:  `/api/lalamove-quote` (file at `api/lalamove-quote.js`)
- The API uses a **local tiered estimator** (no external keys needed). You can replace it later with live Lalamove.

## Deploy

### Netlify
1. Import Git repo in Netlify → set **Publish directory** to `public`.
2. Deploy. The redirect in `netlify.toml` exposes `/api/lalamove-quote` too.

### Vercel
1. Import repo in Vercel.
2. Set **Output Directory** = `public`. Vercel serves `/public` as static.
3. API route `/api/lalamove-quote` is available automatically.

## Usage
- Open the site → add items → in the cart enter **address**. If you paste a Google Maps URL that contains `@lat,lng`, shipping will be estimated using your Bangkok tiers.
- Preorder items show **ETA 7–10 days** label.
- 75g option price is **THB 250** (all except sampler).

## Notes
- The estimator accepts Bangkok + Nonthaburi + Samut Prakan addresses (ZIP `10xxx` + keywords). If no coords found, it falls back to a default price.
- To switch to real Lalamove later, replace `estimateQuote` in `functions/lib/quote.js` with the signed API call.
