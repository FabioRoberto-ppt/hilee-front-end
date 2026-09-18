// ===== Configuração =====
// URL do seu backend hospedado no Render
const API_BASE = 'https://hilee-backend.onrender.com';

// Public Key de TESTE do Mercado Pago (painel > Loja Hilee > Credenciais de teste).
// É segura de expor no frontend — é feita pra isso, ao contrário do Access Token.
const MP_PUBLIC_KEY = 'APP_USR-e565407d-e231-413d-80d7-0e5193a36cf3';

const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });

const colors = [
  { name: "Mirtilo",     hex: "#7d6bc4", img: "images/mirtilo.jpeg" },
  { name: "Melancia",    hex: "#e64f5a", img: "images/melancia.jpeg" },
  { name: "Verde Maçã",  hex: "#9ab93f", img: "images/verde_maca.jpeg" },
  { name: "Cereja",      hex: "#e6316f", img: "images/cereja.jpeg" },
  { name: "Banana",      hex: "#f2c94c", img: "images/banana.jpeg" },
  { name: "Toranja",     hex: "#f2994a", img: "images/toranja.jpeg" },
  { name: "Verde Pomelo",hex: "#95d5a8", img: "images/verde_pomelo.jpeg" },
];

const sizes = [
  { ml: "600ml",  price: 80 },
  { ml: "800ml",  price: 85 },
  { ml: "1000ml", price: 90 },
  { ml: "1300ml", price: 95 },
];

let state = { colorIdx: 0, sizeIdx: 0, qty: 1, cartCount: 0, method: 'pix' };

// controla o polling de status do Pix, pra poder cancelar ao fechar o modal
let pixPollInterval = null;

function renderSwatches(){
  const wrap = document.getElementById('swatches');
  wrap.innerHTML = colors.map((c,i)=>`
    <div class="swatch ${i===state.colorIdx?'active':''}" onclick="pickColor(${i})">
      <span class="dot" style="background:${c.hex}"></span>${c.name}
    </div>`).join('');
}

function renderSizes(){
  const wrap = document.getElementById('sizes');
  wrap.innerHTML = sizes.map((s,i)=>`
    <div class="size-opt ${i===state.sizeIdx?'active':''}" onclick="pickSize(${i})">
      <span class="ml">${s.ml}</span>
      <span class="pr">R$ ${s.price.toFixed(2).replace('.',',')}</span>
    </div>`).join('');
}

function renderCollection(){
  const wrap = document.getElementById('collection-grid');
  wrap.innerHTML = colors.map((c,i)=>`
    <div class="col-card" onclick="pickColor(${i}); document.getElementById('loja').scrollIntoView({behavior:'smooth'})">
      <img src="${c.img}" alt="Hilee sabor ${c.name}">
      <div class="name">${c.name}</div>
    </div>`).join('');
}

function pickColor(i){
  state.colorIdx = i;
  renderSwatches();
  document.getElementById('picked-color').textContent = colors[i].name;
  document.getElementById('visual-img').src = colors[i].img;
  document.getElementById('visual-cap').textContent = `Hilee sabor ${colors[i].name}, ${sizes[state.sizeIdx].ml}.`;
}

function pickSize(i){
  state.sizeIdx = i;
  renderSizes();
  document.getElementById('picked-size').textContent = sizes[i].ml;
  updateTotal();
  document.getElementById('visual-cap').textContent = `Hilee sabor ${colors[state.colorIdx].name}, ${sizes[i].ml}.`;
}

function changeQty(delta){
  state.qty = Math.max(1, state.qty + delta);
  document.getElementById('qty').textContent = state.qty;
  updateTotal();
}

function updateTotal(){
  const unit = sizes[state.sizeIdx].price;
  const total = unit * state.qty;
  document.getElementById('price-now').textContent = `R$ ${unit.toFixed(2).replace('.',',')}`;
  document.getElementById('total-val').textContent = `R$ ${total.toFixed(2).replace('.',',')}`;
}

function addToCart(){
  state.cartCount += state.qty;
  document.getElementById('cart-count').textContent = state.cartCount;
}

// ===== Checkout =====

function openCheckout(){
  const c = colors[state.colorIdx], s = sizes[state.sizeIdx];
  const total = (s.price * state.qty).toFixed(2).replace('.',',');
  document.getElementById('modal-summary').innerHTML =
    `<b>${state.qty}× Hilee ${c.name}</b> — ${s.ml}<br>Total: <b>R$ ${total}</b>`;
  showStep('step-method');
  document.getElementById('modal-overlay').classList.add('open');
}

function closeCheckout(){
  document.getElementById('modal-overlay').classList.remove('open');
  if (pixPollInterval) {
    clearInterval(pixPollInterval);
    pixPollInterval = null;
  }
}

function showStep(stepId){
  document.querySelectorAll('.checkout-step').forEach(el => el.classList.add('hidden'));
  document.getElementById(stepId).classList.remove('hidden');
}

function selectMethod(el){
  document.querySelectorAll('.pay-option').forEach(o=>o.classList.remove('active'));
  el.classList.add('active');
  state.method = el.dataset.method;
}

function finishCheckout(){
  if (state.method === 'pix') {
    iniciarPagamentoPix();
  } else if (state.method === 'cartao') {
    showStep('step-cartao');
  }
}

// ===== Pix =====

async function iniciarPagamentoPix(){
  showStep('step-pix');
  document.getElementById('pix-loading').classList.remove('hidden');
  document.getElementById('pix-qr-img').classList.add('hidden');
  document.getElementById('pix-copia-cola').classList.add('hidden');
  document.getElementById('pix-copy-btn').classList.add('hidden');
  document.getElementById('pix-status').classList.add('hidden');

  const c = colors[state.colorIdx], s = sizes[state.sizeIdx];

  try {
    const resposta = await fetch(`${API_BASE}/api/pagamentos/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colorName: c.name,
        sizeMl: s.ml,
        qty: state.qty,
        payer: {
          // Comprador de TESTE de verdade (painel > Contas de teste > Comprador).
          // Trocar por um formulário real quando for pra produção.
          email: 'TESTUSER1721023341713725270@testuser.com',
          firstName: 'Cliente',
          lastName: 'Teste',
          cpf: '12345678909', // CPF de teste documentado pelo Mercado Pago
        },
      }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      document.getElementById('pix-loading').textContent = dados.erro || 'Não foi possível gerar o Pix.';
      return;
    }

    document.getElementById('pix-loading').classList.add('hidden');
    document.getElementById('pix-qr-img').src = `data:image/png;base64,${dados.qrCodeBase64}`;
    document.getElementById('pix-qr-img').classList.remove('hidden');
    document.getElementById('pix-copia-cola').value = dados.qrCode;
    document.getElementById('pix-copia-cola').classList.remove('hidden');
    document.getElementById('pix-copy-btn').classList.remove('hidden');
    document.getElementById('pix-status').classList.remove('hidden');
    document.getElementById('pix-status').textContent = 'Aguardando pagamento…';

    monitorarStatusPix(dados.orderId);
  } catch (erro) {
    console.error(erro);
    document.getElementById('pix-loading').textContent = 'Erro de conexão com o backend. Ele está rodando em ' + API_BASE + '?';
  }
}

function copiarPix(){
  const campo = document.getElementById('pix-copia-cola');
  campo.select();
  navigator.clipboard.writeText(campo.value);
  const btn = document.getElementById('pix-copy-btn');
  const textoOriginal = btn.textContent;
  btn.textContent = 'Copiado!';
  setTimeout(() => { btn.textContent = textoOriginal; }, 1500);
}

function monitorarStatusPix(orderId){
  if (pixPollInterval) clearInterval(pixPollInterval);

  pixPollInterval = setInterval(async () => {
    try {
      const resposta = await fetch(`${API_BASE}/api/pagamentos/${orderId}/status`);
      const dados = await resposta.json();

      if (dados.status === 'approved') {
        document.getElementById('pix-status').textContent = '✅ Pagamento aprovado!';
        clearInterval(pixPollInterval);
        pixPollInterval = null;
      } else if (dados.status === 'rejected' || dados.status === 'cancelled') {
        document.getElementById('pix-status').textContent = '❌ Pagamento não aprovado.';
        clearInterval(pixPollInterval);
        pixPollInterval = null;
      }
      // se ainda "pending", segue esperando
    } catch (erro) {
      console.error('Erro ao consultar status:', erro);
    }
  }, 4000);
}

// ===== Cartão =====

async function pagarComCartao(){
  const btn = document.getElementById('card-submit-btn');
  const statusEl = document.getElementById('card-status');
  statusEl.textContent = '';

  const numero = document.getElementById('card-number').value.replace(/\s/g, '');
  const nome = document.getElementById('card-name').value.trim();
  const mes = document.getElementById('card-month').value.trim();
  const ano = document.getElementById('card-year').value.trim();
  const cvv = document.getElementById('card-cvv').value.trim();
  const cpf = document.getElementById('card-cpf').value.replace(/\D/g, '');
  const email = document.getElementById('card-email').value.trim();

  if (!numero || !nome || !mes || !ano || !cvv || !cpf || !email) {
    statusEl.textContent = 'Preencha todos os campos.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Processando…';

  try {
    // 1. Tokeniza o cartão no navegador — o número nunca vai pro nosso backend.
    const cardToken = await mp.createCardToken({
      cardNumber: numero,
      cardholderName: nome,
      cardExpirationMonth: mes,
      cardExpirationYear: ano,
      securityCode: cvv,
      identificationType: 'CPF',
      identificationNumber: cpf,
    });

    const c = colors[state.colorIdx], s = sizes[state.sizeIdx];

    // 2. Manda o token (não o cartão) pro nosso backend processar.
    const resposta = await fetch(`${API_BASE}/api/pagamentos/cartao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: cardToken.id,
        paymentMethodId: cardToken.payment_method_id,
        installments: 1,
        colorName: c.name,
        sizeMl: s.ml,
        qty: state.qty,
        payer: { email, cpf },
      }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      statusEl.textContent = dados.erro || 'Não foi possível processar o cartão.';
      btn.disabled = false;
      btn.textContent = 'Pagar';
      return;
    }

    if (dados.status === 'approved') {
      statusEl.textContent = '✅ Pagamento aprovado!';
    } else if (dados.status === 'in_process') {
      statusEl.textContent = '⏳ Pagamento em análise.';
    } else {
      statusEl.textContent = `Status: ${dados.status} (${dados.statusDetail || ''})`;
    }
    btn.textContent = 'Pagar';
    btn.disabled = false;
  } catch (erro) {
    console.error(erro);
    statusEl.textContent = 'Erro ao tokenizar o cartão. Confira os dados e tente novamente.';
    btn.disabled = false;
    btn.textContent = 'Pagar';
  }
}

renderSwatches();
renderSizes();
renderCollection();
pickColor(0);
updateTotal();