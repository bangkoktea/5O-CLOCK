const CONFIG = {
  currency: 'THB',
  lineId: '@924uwcib',
  freeShippingThreshold: 500,
  // адрес отправления (по ТЗ)
  originAddress: '38/71 Indy Ramkhamhaeng 2, Dokmai, Prawet, 10250',
  api: {
    quoteUrl: '/.netlify/functions/lalamove-quote' // если будешь на Vercel, замени на /api/lalamove/quote
  },
  areas: [/bangkok/i, /nonthaburi/i, /samut\s*prakan/i]
};
const $ = s => document.querySelector(s);
const fmt = v => `${CONFIG.currency} ${Number(v).toLocaleString('en-US')}`;

const els = {
  grid: $('#productGrid'),
  openCart: $('#openCart'),
  cartDrawer: $('#cartDrawer'),
  closeCart: $('#closeCart'),
  closeCartBtn: $('#closeCartBtn'),
  cartItems: $('#cartItems'),
  cartCount: $('#cartCount'),
  cartSubtotal: $('#cartSubtotal'),
  cartTotal: $('#cartTotal'),
  shippingCost: $('#shippingCost'),
  checkoutBtn: $('#checkoutBtn'),
  showQR: $('#showQR'),
  year: $('#year'),
  qrModal: $('#qrModal'),
  payInfo: $('#payInfo')
};

let products = [];
let cart = [];
let shipEstimate = null;

async function loadProducts(){
  const r = await fetch('data/products.json');
  products = await r.json();
}

function renderProducts(){
  els.grid.innerHTML = '';
  products.forEach(p=>{
    const card = document.createElement('article');
    card.className = 'card bg-white overflow-hidden flex flex-col';
    card.innerHTML = `
      <div class="w-full h-[320px] bg-[#f9f6ef] flex items-center justify-center">
        <img src="${p.img}" alt="${p.name}" class="w-full h-full object-contain p-2" onerror="this.src='images/delivery.png'">
      </div>
      <div class="p-5 flex flex-col gap-2">
        <h3 class="logo text-lg">${p.name}</h3>
        ${p.preorder ? '<div class="text-purple-700 text-sm font-semibold">Preorder · ETA 7–10 days</div>' : ''}
        <p class="text-sm text-zinc-600">${p.desc||''}</p>
        <label class="text-sm mt-1">Size</label>
        <select class="border rounded-full px-3 py-2 text-sm">
          ${p.options.map((o,i)=>`<option value="${i}">${o.label} — ${fmt(o.price)}</option>`).join('')}
        </select>
        <button class="mt-2 px-4 py-3 rounded-full text-sm font-semibold ${p.preorder?'bg-purple-600 text-white':'bg-black text-white'}"> ${p.preorder?'Preorder':'Add to cart'} </button>
      </div>`;
    const sel = card.querySelector('select');
    card.querySelector('button').addEventListener('click', ()=>{
      const opt = p.options[parseInt(sel.value,10)];
      const ex = cart.find(i=>i.id===p.id && i.variant===opt.label);
      if (ex) ex.qty += 1;
      else cart.push({ id:p.id, name:p.name, variant:opt.label, price:opt.price, qty:1, img:p.img, preorder: !!p.preorder });
      updateCart();
      openCart();
    });
    els.grid.appendChild(card);
  });
}

function openCart(){ els.cartDrawer.classList.remove('hidden'); }
function closeCart(){ els.cartDrawer.classList.add('hidden'); }

function allowedArea(address=''){
  return CONFIG.areas.some(re => re.test(address || ''));
}

// очень простой «парсер» почтового (для правила 10xxx)
function extractZip(addr=''){
  const m = addr.match(/\b\d{5}\b/);
  return m ? m[0] : '';
}

async function quoteShipping(address){
  // если адрес вне зон — не считаем
  if (!allowedArea(address)) { shipEstimate = null; return; }

  // пробуем вызвать нашу serverless-функцию (Lalamove logics)
  try{
    const res = await fetch(CONFIG.api.quoteUrl, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ origin: CONFIG.originAddress, destination: address })
    });
    if (!res.ok) throw new Error('quote fail');
    const d = await res.json(); // { price, distanceKm }
    shipEstimate = Math.round(d.price/5)*5; // округление до 5
  }catch(e){
    // fallback: грубая оценка «как у Lalamove» по радиусам
    // (пригодится на GitHub Pages без функций)
    const zip = extractZip(address);
    let base = 50; // минималка
    if (!zip.startsWith('10')) { shipEstimate = null; return; }
    // грубая логика — подправим после реальных котировок
    shipEstimate = base + 10; 
  }
}

function updateCart(){
  els.cartItems.innerHTML = '';
  let subtotal = 0;
  cart.forEach((item, idx)=>{
    subtotal += item.price * item.qty;
    const row = document.createElement('div');
    row.className = 'py-3 flex items-center gap-3';
    row.innerHTML = `
      <img src="${item.img}" class="w-16 h-16 object-cover rounded-lg" onerror="this.src='images/delivery.png'">
      <div class="flex-1">
        <div class="font-medium">${item.name} — ${item.variant} ${item.preorder?'<span class="text-xs text-purple-700 font-semibold">[PREORDER]</span>':''}</div>
        <div class="text-sm text-zinc-600">${fmt(item.price)} × ${item.qty}</div>
      </div>
      <div class="flex items-center gap-2">
        <button data-act="dec" data-idx="${idx}" class="px-3 py-2 rounded border">−</button>
        <button data-act="inc" data-idx="${idx}" class="px-3 py-2 rounded border">+</button>
        <button data-act="del" data-idx="${idx}" class="px-3 py-2 rounded bg-zinc-100">✕</button>
      </div>`;
    els.cartItems.appendChild(row);
  });

  const itemsCount = cart.reduce((s,i)=>s+i.qty,0);
  els.cartCount.textContent = itemsCount;
  els.cartSubtotal.textContent = fmt(subtotal);

  const address = document.getElementById('address').value.trim();
  const shipping = (subtotal >= CONFIG.freeShippingThreshold) ? 0 : (shipEstimate ?? null);
  els.shippingCost.textContent = (shipping===0) ? fmt(0) : (shipping==null ? '—' : fmt(shipping));
  const total = subtotal + (shipping || 0);
  els.cartTotal.textContent = fmt(total);

  const canCheckout = itemsCount>0 && $('#custName').value.trim() && $('#custPhone').value.trim() && address;
  els.checkoutBtn.disabled = !canCheckout;

  // сборка текста заказа для LINE
  const lines = cart.map(i=>`• ${i.name} (${i.variant})${i.preorder?' [PREORDER]':''} x${i.qty} — ${CONFIG.currency} ${i.price}`).join('\n');
  let msg = `Order from 5 o'clock Tea
${lines}

Subtotal: ${fmt(subtotal)}${shipping>0?`\nDelivery: ${fmt(shipping)}`:''}
Total: ${fmt(total)}
Name: ${$('#custName').value.trim()}
Phone: ${$('#custPhone').value.trim()}
Address: ${address}`;
  els.checkoutBtn.onclick = ()=>openLineWithMessage(msg);
}

function openLineWithMessage(text){
  const id = CONFIG.lineId;
  const encoded = encodeURIComponent(text).replace(/%0A/g,'%0A');
  const deep1 = `line://oaMessage/${encodeURIComponent(id)}/?${encoded}`;
  const deep2 = `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encoded}`;
  let ok=false;
  try{ ok = !!window.open(deep1,'_blank'); }catch(_){}
  if (ok) return;
  try{ ok = !!window.open(deep2,'_blank'); }catch(_){}
  if (ok) return;
  navigator.clipboard?.writeText(text).catch(()=>{});
  window.open(`https://line.me/R/ti/p/${encodeURIComponent(id)}`,'_blank');
}

// события
document.addEventListener('click', e=>{
  const act = e.target.getAttribute('data-act'); if(!act) return;
  const idx = +e.target.getAttribute('data-idx'); if (isNaN(idx)) return;
  if (act==='inc') cart[idx].qty++;
  if (act==='dec') cart[idx].qty = Math.max(1, cart[idx].qty-1);
  if (act==='del') cart.splice(idx,1);
  updateCart();
});

$('#address').addEventListener('input', async (e)=>{ await quoteShipping(e.target.value); updateCart(); });

els.openCart.addEventListener('click', openCart);
els.closeCart?.addEventListener('click', closeCart);
els.closeCartBtn?.addEventListener('click', closeCart);

$('#showQR').addEventListener('click', ()=> els.qrModal.classList.remove('hidden'));
$('#payInfo').addEventListener('click', ()=> els.qrModal.classList.remove('hidden'));
els.qrModal.addEventListener('click', (e)=>{ if(e.target.hasAttribute('data-close')) els.qrModal.classList.add('hidden'); });

els.year.textContent = new Date().getFullYear();

// init
(async function(){
  await loadProducts();
  renderProducts();
  updateCart();
})();
