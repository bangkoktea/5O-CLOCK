// public/scripts/app.js
const CONFIG = {
  currency: "THB",
  freeShippingThreshold: 500,
  pickup: { lat: 13.6948, lng: 100.7186 },
  lineId: "@924uwcib",
  products: [
    { id: "wild-cherry", name: "Wild Cherry", img: "./images/wild-cherry.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea with cherry notes — bright and aromatic." },
    { id: "taiga-blend", name: "Taiga Blend", img: "./images/taiga-blend.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea, berries & forest vibes. Cozy and bold." },
    { id: "rose-strawberry", name: "Rose Strawberry Fruit Tea", img: "./images/rose-strawberry.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea with apples, chokeberry, strawberry & rose petals." },
    { id: "rose-hibiscus", name: "Rose Hibiscus Fruit Tea", img: "./images/rose-hibiscus.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Hibiscus, rose petals & berries for a ruby‑red infusion.", outOfStock: true },
    { id: "citrus-orange", name: "Citrus Orange Fruit Tea", img: "./images/citrus-orange.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Sun‑dried oranges, apples & hibiscus for a refreshing citrus aroma.", outOfStock: true },
    { id: "strawberries-cream", name: "Strawberries & Cream", img: "./images/strawberries-cream.jpg", options: [{label:"50 g", price:195},{label:"75 g", price:250}], desc: "Black tea with strawberry pieces, goji berries & candied pineapple." },
    { id: "tea-sampler", name: "Tea Sampler (3×20g)", img: "./images/wild-cherry.jpg", options: [{label:"Set", price:195}], desc: "Taiga + Strawberries & Cream + Wild Cherry (3×20g). Perfect to try." }
  ]
};
function fmt(v){ return CONFIG.currency + " " + Number(v).toLocaleString("en-US"); }

const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const closeCart = document.getElementById("closeCart");
const closeCartBtn = document.getElementById("closeCartBtn");
const openCart = document.getElementById("openCart");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartSubtotal = document.getElementById("cartSubtotal");
const shippingCostEl = document.getElementById("shippingCost");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const addrEl = document.getElementById("address");
const nameEl = document.getElementById("custName");
const phoneEl = document.getElementById("custPhone");

let cart = [];
let lastQuote = null;

function renderProducts(){
  CONFIG.products.forEach(p => {
    const art = document.createElement("article");
    art.className = "card bg-white overflow-hidden flex flex-col h-full p-4";
    art.innerHTML = `
      <img src="${p.img}" alt="${p.name}" class="w-full h-56 object-cover rounded-xl"/>
      <h3 class="logo text-lg mt-3">${p.name}</h3>
      ${p.outOfStock ? '<p class="text-purple-700 text-sm mt-1 font-semibold">Preorder only (ETA 7–10 days)</p>' : ""}
      <p class="mt-1 text-sm text-zinc-600">${p.desc}</p>
      <div class="mt-3 flex items-center gap-3">
        <label class="text-sm">Size</label>
        <select class="sizeSel border rounded-full px-3 py-2 text-sm">
          ${p.options.map((o,i)=>`<option value="${i}">${o.label} — ${fmt(o.price)}</option>`).join("")}
        </select>
      </div>
      <button data-id="${p.id}" class="addBtn mt-3 w-full px-4 py-3 rounded-full text-sm font-semibold ${p.outOfStock?'bg-purple-600 text-white':'bg-black text-white'}">
        ${p.outOfStock ? "Preorder" : "Add to cart"}
      </button>
    `;
    grid.appendChild(art);
  });
}

function estimateFromApi(pickup, dropoff){
  const body = JSON.stringify({ pickup, dropoff, serviceType: "MOTORCYCLE" });
  return fetch("/api/lalamove-quote", { method:"POST", headers:{ "Content-Type":"application/json" }, body })
    .then(r => { if (r.ok) return r.json(); throw new Error("vercel route failed"); })
    .catch(_ => fetch("/.netlify/functions/lalamove-quote", { method:"POST", headers:{ "Content-Type":"application/json" }, body }).then(r=>r.json()));
}

function parseZipFromAddress(text){
  const m = (text||"").match(/10\d{3}\b/);
  return m ? m[0] : "";
}
function isBangkokArea(text){
  return /(bangkok|krung thep|nonthaburi|samut\s*prakan)/i.test(text || "");
}
function buildOrderMessage(){
  const lines = cart.map(i => `• ${i.name}${i.variant?` (${i.variant})`:""}${i.preorder?" [PREORDER]":""} x${i.qty} — ${CONFIG.currency} ${i.price}`).join("\n");
  const subtotal = cart.filter(i => i.id!=="delivery").reduce((s,i)=>s+i.price*i.qty,0);
  const shipping = (lastQuote && typeof lastQuote.priceTHB === "number") ? lastQuote.priceTHB : (subtotal >= CONFIG.freeShippingThreshold ? 0 : 70);
  const total = subtotal + (shipping||0);
  const distanceNote = lastQuote ? `\nDistance (approx): ${lastQuote.distanceKm} km` : "";
  const text =
    "Order from 5 o'clock Tea\n" + lines +
    `\n\nSubtotal: ${fmt(subtotal)}` +
    (shipping?`\nDelivery: ${fmt(shipping)}`:"") +
    `\nTotal: ${fmt(total)}${distanceNote}` +
    `\n\nName: ${(nameEl.value||"").trim()}` +
    `\nPhone: ${(phoneEl.value||"").trim()}` +
    `\nAddress: ${(addrEl.value||"").trim()}`;
  return text;
}

function updateCart(){
  cartItems.innerHTML = "";
  let subtotal = 0;
  for (const i of cart){ if (i.id!=="delivery") subtotal += i.price * i.qty; }

  cart.forEach((item,idx)=>{
    const row = document.createElement("div");
    row.className = "py-3 flex items-center gap-3";
    row.innerHTML = `
      <img src="${item.img}" class="w-16 h-16 object-cover rounded-lg"/>
      <div class="flex-1">
        <div class="font-medium">${item.name}${item.variant?` — ${item.variant}`:""}${item.preorder?` <span class="text-xs text-purple-700 font-semibold">PREORDER</span>`:""}</div>
        <div class="text-sm text-zinc-600">${fmt(item.price)} × ${item.qty}</div>
      </div>
      ${item.id==="delivery" ? "" : `<div class="flex items-center gap-2">
        <button class="px-3 py-2 rounded border" data-act="dec" data-idx="${idx}">−</button>
        <button class="px-3 py-2 rounded border" data-act="inc" data-idx="${idx}">+</button>
        <button class="px-3 py-2 rounded bg-zinc-100" data-act="del" data-idx="${idx}">✕</button>
      </div>`}
    `;
    cartItems.appendChild(row);
  });

  const address = (addrEl.value||"").trim();
  const canQuote = parseZipFromAddress(address).startsWith("10") && isBangkokArea(address);

  let latlng = null;
  const at = address.match(/@(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
  if (at){ latlng = { lat: parseFloat(at[1]), lng: parseFloat(at[3]) }; }

  const doQuote = async ()=>{
    if (!canQuote || !latlng){ lastQuote = null; finishTotals(); return; }
    try{
      lastQuote = await estimateFromApi(CONFIG.pickup, latlng);
    }catch(_){ lastQuote = null; }
    finishTotals();
  };

  function finishTotals(){
    const shipping = (lastQuote && lastQuote.ok && typeof lastQuote.priceTHB==="number")
      ? lastQuote.priceTHB
      : (subtotal >= CONFIG.freeShippingThreshold ? 0 : 70);
    const dIdx = cart.findIndex(i => i.id==="delivery");
    if (shipping > 0){
      const deliveryItem = { id:"delivery", name:"Delivery", variant:"Local courier (estimate)", price:shipping, qty:1, img:"./images/delivery.png" };
      if (dIdx>-1) cart[dIdx] = deliveryItem; else cart.push(deliveryItem);
    } else if (dIdx>-1){
      cart.splice(dIdx,1);
    }
    const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
    cartSubtotal.textContent = fmt(subtotal);
    shippingCostEl.textContent = fmt(shipping);
    cartTotal.textContent = fmt(total);
    const itemsCount = cart.filter(i=>i.id!=="delivery").reduce((s,i)=>s+i.qty,0);
    cartCount.textContent = itemsCount;
    checkoutBtn.disabled = !(itemsCount>0 && nameEl.value.trim() && phoneEl.value.trim() && addrEl.value.trim());
  }

  doQuote();
}

document.addEventListener("click", e => {
  const act = e.target.getAttribute("data-act");
  if (act){
    const idx = parseInt(e.target.getAttribute("data-idx"),10);
    if (act==="inc") cart[idx].qty += 1;
    if (act==="dec") cart[idx].qty = Math.max(1, cart[idx].qty - 1);
    if (act==="del"){ if (cart[idx].id!=="delivery") cart.splice(idx,1); }
    updateCart();
    return;
  }
  if (e.target.classList.contains("addBtn")){
    const card = e.target.closest("article");
    const sel = card.querySelector(".sizeSel");
    const pid = e.target.getAttribute("data-id");
    const p = CONFIG.products.find(x=>x.id===pid);
    const opt = p.options[parseInt(sel.value,10)];
    const existing = cart.find(i=>i.id===pid && i.variant===opt.label);
    if (existing) existing.qty += 1;
    else cart.push({ id:pid, name:p.name, variant:opt.label, price:opt.price, qty:1, img:p.img, preorder: !!p.outOfStock });
    updateCart();
    cartDrawer.classList.remove("hidden");
  }
});

openCart.addEventListener("click", ()=> cartDrawer.classList.remove("hidden"));
closeCart.addEventListener("click", ()=> cartDrawer.classList.add("hidden"));
closeCartBtn.addEventListener("click", ()=> cartDrawer.classList.add("hidden"));
["input","change","blur"].forEach(ev=> addrEl.addEventListener(ev, updateCart));
["input","change","blur"].forEach(ev=> nameEl.addEventListener(ev, updateCart));
["input","change","blur"].forEach(ev=> phoneEl.addEventListener(ev, updateCart));

function renderProductsInit(){ renderProducts(); updateCart(); }
renderProductsInit();

checkoutBtn.addEventListener("click", async () => {
  const text = buildOrderMessage();
  const encoded = encodeURIComponent(text).replace(/%0A/g, '%0A');
  const deep1 = 'line://oaMessage/' + encodeURIComponent(CONFIG.lineId) + '/?' + encoded;
  const deep2 = 'https://line.me/R/oaMessage/' + encodeURIComponent(CONFIG.lineId) + '/?' + encoded;
  let opened = false;
  try { opened = !!window.open(deep1, '_blank'); } catch(_) {}
  if (!opened){ try { opened = !!window.open(deep2, '_blank'); } catch(_) {} }
  if (!opened){
    try { await navigator.clipboard.writeText(text); } catch(_){}
    alert('Order text copied. Paste it into the LINE chat.');
    window.open('https://line.me/R/ti/p/' + encodeURIComponent(CONFIG.lineId), '_blank');
  }
});
