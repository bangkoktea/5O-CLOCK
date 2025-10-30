const SITE = {
  currency: 'THB',
  freeShippingThreshold: 500,
  lineId: '@924uwcib',
  preorderNote: 'Preorder requires prepayment • ETA 7–10 days',
  qrNote: 'Payment by fixed QR — send screenshot in chat.'
};
const fmt = v => SITE.currency + ' ' + Number(v).toLocaleString('en-US');

let PRODUCTS = [];
let CART = []; // {id,name,variant,price,qty,img,preorder}

const $ = s => document.querySelector(s);
const grid = $('#productGrid');
const drawer = $('#drawer');
const cartItems = $('#cartItems');
const cartCount = $('#cartCount');
const cartSubtotal = $('#cartSubtotal');
const cartTotal = $('#cartTotal');
const shipCost = $('#shipCost');
const shipRow = $('#shipRow');
const checkoutBtn = $('#checkoutBtn');
const emailBtn = $('#emailBtn');

$('#year').textContent = new Date().getFullYear();

$('#openCart')?.addEventListener('click', ()=> drawer.classList.add('show'));
$('#closeCart')?.addEventListener('click', ()=> drawer.classList.remove('show'));
$('#closeBtn')?.addEventListener('click', ()=> drawer.classList.remove('show'));

async function loadProducts(){
  const r = await fetch('data/products.json', { cache: 'no-store' });
  PRODUCTS = await r.json();
}

function renderProducts(){
  grid.innerHTML = '';
  PRODUCTS.forEach(p => {
    const el = document.createElement('article');
    el.className = 'card prod';
    el.innerHTML = `
      <div class="figure">
        <img src="${p.img}" alt="${p.name}" onerror="this.src='https://placehold.co/600x400?text=${encodeURIComponent(p.name)}'">
      </div>
      <h3>${p.name}</h3>
      ${p.outOfStock ? '<div class="badge">Preorder only</div>' : ''}
      <p class="muted">${p.desc||''}</p>
      ${p.outOfStock ? `<p class="muted" style="font-size:12px">${SITE.preorderNote}</p>` : ''}
      <div class="row2">
        <label class="muted" style="font-size:14px">Size</label>
        <select class="sizeSel">
          ${(p.options||[]).map((o,i)=>`<option value="${i}">${o.label} — ${fmt(o.price)}</option>`).join('')}
        </select>
      </div>
      <button class="btn add addBtn" data-id="${p.id}">${p.outOfStock?'Preorder':'Add to cart'}</button>
    `;
    grid.appendChild(el);
  });
}

function addToCartById(id, variantIdx=0){
  const p = PRODUCTS.find(x=>x.id===id);
  const opt = p?.options?.[variantIdx];
  if (!p || !opt) return;
  const key = id+'::'+opt.label;
  const existing = CART.find(i=>i.key===key);
  if (existing) existing.qty += 1;
  else CART.push({ key, id, name:p.name, variant:opt.label, price:opt.price, qty:1, img:p.img, preorder:!!p.outOfStock });
  updateCart();
  drawer.classList.add('show');
}

document.addEventListener('click', e => {
  const add = e.target.closest('.addBtn');
  if (add){
    const card = add.closest('.prod');
    const sel = card.querySelector('.sizeSel');
    addToCartById(add.dataset.id, parseInt(sel?.value||'0',10));
  }
  const ctrl = e.target.closest('[data-act]');
  if (ctrl){
    const idx = parseInt(ctrl.dataset.idx,10);
    const act = ctrl.dataset.act;
    if (!isNaN(idx) && CART[idx]){
      if (act==='inc') CART[idx].qty += 1;
      if (act==='dec') CART[idx].qty = Math.max(1, CART[idx].qty-1);
      if (act==='del') CART.splice(idx,1);
      updateCart();
    }
  }
});

function estimateShipping(subtotal){
  if (subtotal >= SITE.freeShippingThreshold) return 0;
  return 70; // placeholder (swap for Lalamove quote later)
}

function updateCart(){
  let subtotal = 0;
  cartItems.innerHTML = '';
  CART.forEach((item,i)=>{
    subtotal += item.price * item.qty;
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <img src="${item.img}" alt="">
      <div style="flex:1">
        <div style="font-weight:600">${item.name}${item.variant?' — '+item.variant:''}${item.preorder?' <span class="badge">PREORDER</span>':''}</div>
        <div class="muted" style="font-size:14px">${fmt(item.price)} × ${item.qty}</div>
      </div>
      <div class="qty" style="display:flex;gap:6px">
        <button data-act="dec" data-idx="${i}">−</button>
        <button data-act="inc" data-idx="${i}">+</button>
        <button data-act="del" data-idx="${i}">✕</button>
      </div>
    `;
    cartItems.appendChild(row);
  });
  const itemsCount = CART.reduce((s,i)=>s+i.qty,0);
  cartCount.textContent = itemsCount;

  const shipping = estimateShipping(subtotal);
  const total = subtotal + (shipping||0);
  cartSubtotal.textContent = fmt(subtotal);
  shipCost.textContent = fmt(shipping||0);
  cartTotal.textContent = fmt(total);
  shipRow.style.display = (shipping||0)===0 ? 'none':'flex';

  const name = ($('#custName')?.value||'').trim();
  const phone = ($('#custPhone')?.value||'').trim();
  const address = ($('#custAddress')?.value||'').trim();
  checkoutBtn.disabled = !(itemsCount>0 && name && phone && address);

  const msg = buildOrderMessage(subtotal, shipping, total, name, phone, address);
  emailBtn.href = "mailto:5OCLOCK@GMAIL.COM?subject=" +
                  encodeURIComponent("Order — 5 o'clock Tea ("+fmt(total)+")") +
                  "&body=" + encodeURIComponent(msg);
}

['#custName','#custPhone','#custAddress'].forEach(s=>{
  const el = $(s); if (el) el.addEventListener('input', updateCart);
});

function buildOrderMessage(subtotal, shipping, total, name, phone, address){
  const lines = CART.map(i => `• ${i.name}${i.variant?' ('+i.variant+')':''}${i.preorder?' [PREORDER]':''} x${i.qty} — ${SITE.currency} ${i.price}`).join('\n');
  const preorderExists = CART.some(i=>i.preorder);
  const notes = [
    preorderExists ? SITE.preorderNote : null,
    SITE.qrNote,
    'Service area: Bangkok / Nonthaburi / Samut Prakan'
  ].filter(Boolean).join('\n');

  return `Order from 5 o'clock Tea
${lines}

Subtotal: ${fmt(subtotal)}
${shipping>0 ? 'Delivery: ' + fmt(shipping) + '\n' : ''}Total: ${fmt(total)}

Name: ${name}
Phone: ${phone}
Address: ${address}

${notes}`;
}

async function openLineWithMessage(){
  const subtotal = CART.reduce((s,i)=>s+i.price*i.qty,0);
  const shipping = estimateShipping(subtotal);
  const total = subtotal + (shipping||0);
  const name = ($('#custName')?.value||'').trim();
  const phone = ($('#custPhone')?.value||'').trim();
  const address = ($('#custAddress')?.value||'').trim();

  const text = buildOrderMessage(subtotal, shipping, total, name, phone, address);
  const encoded = encodeURIComponent(text).replace(/%0A/g, '%0A');
  const deep1 = 'line://oaMessage/' + encodeURIComponent(SITE.lineId) + '/?' + encoded;
  const deep2 = 'https://line.me/R/oaMessage/' + encodeURIComponent(SITE.lineId) + '/?' + encoded;

  let opened = false;
  try { opened = !!window.open(deep1, '_blank'); } catch(_) {}
  if (!opened) { try { opened = !!window.open(deep2, '_blank'); } catch(_) {} }
  if (!opened) {
    try { await navigator.clipboard.writeText(text); } catch(_){}
    alert('Order text copied. Paste it into the LINE chat.');
    window.open('https://line.me/R/ti/p/' + encodeURIComponent(SITE.lineId), '_blank');
  }
}
$('#checkoutBtn')?.addEventListener('click', openLineWithMessage);

(async function boot(){
  await loadProducts();
  renderProducts();
  updateCart();
})();