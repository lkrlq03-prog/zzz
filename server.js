import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const app = express();
const port = process.env.PORT || 3000;
const root = path.dirname(fileURLToPath(import.meta.url));

const plans = {
  degustacao: { name: 'Degustação', amount: 9.90 },
  vip_gold: { name: 'VIP Gold', amount: 17.90 },
  vitalicio: { name: 'VIP Premium', amount: 25.00 }
};

app.use(express.json({ limit: '20kb' }));
app.use(express.static(root, { index: 'vip-exclusive-acesso-privado.html' }));

function cleanDocument(value = '') {
  return String(value).replace(/\D/g, '');
}

function validCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length) => {
    let sum = 0;
    for (let index = 0; index < length - 1; index++) sum += Number(cpf[index]) * (length - index);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(10) === Number(cpf[9]) && digit(11) === Number(cpf[10]);
}

function authHeaders() {
  const clientId = process.env.MISTICPAY_CLIENT_ID;
  const clientSecret = process.env.MISTICPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('MISTIC_NOT_CONFIGURED');
  return {
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    'Content-Type': 'application/json'
  };
}

function externalBaseUrl(req) {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

app.post('/api/pix', async (req, res) => {
  const { planId, name, cpf } = req.body || {};
  const plan = plans[planId];
  const payerName = String(name || '').trim().replace(/\s+/g, ' ');
  const payerDocument = cleanDocument(cpf);

  if (!plan) return res.status(400).json({ error: 'Plano inválido.' });
  if (payerName.length < 3 || payerName.length > 120) return res.status(400).json({ error: 'Informe seu nome completo.' });
  if (!validCpf(payerDocument)) return res.status(400).json({ error: 'Informe um CPF válido.' });

  const clientTransactionId = `vip-${planId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const projectWebhook = `${externalBaseUrl(req)}/api/misticpay/webhook`;

  try {
    const response = await fetch('https://api.misticpay.com/api/transactions/create', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount: plan.amount,
        payerName,
        payerDocument,
        transactionId: clientTransactionId,
        description: `VIP Exclusive — ${plan.name}`,
        projectWebhook
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('MisticPay create error:', response.status, payload);
      return res.status(502).json({ error: payload.message || 'Não foi possível gerar o Pix. Tente novamente.' });
    }
    const data = payload.data || {};
    return res.status(201).json({
      transactionId: data.transactionId,
      copyPaste: data.copyPaste,
      qrCode: data.qrCodeBase64 || data.qrcodeUrl,
      plan: plan.name,
      amount: plan.amount
    });
  } catch (error) {
    if (error.message === 'MISTIC_NOT_CONFIGURED') return res.status(503).json({ error: 'Pagamento ainda não configurado. Tente novamente mais tarde.' });
    console.error('MisticPay request error:', error);
    return res.status(502).json({ error: 'Falha ao conectar ao pagamento. Tente novamente.' });
  }
});

app.get('/api/pix/:transactionId', async (req, res) => {
  try {
    const response = await fetch('https://api.misticpay.com/api/transactions/check', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ transactionId: req.params.transactionId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: payload.message || 'Não foi possível consultar o pagamento.' });
    const transaction = payload.transaction || payload.data || {};
    return res.json({ status: transaction.transactionState || 'PENDENTE' });
  } catch (error) {
    console.error('MisticPay check error:', error);
    return res.status(502).json({ error: 'Falha ao consultar o pagamento.' });
  }
});

app.post('/api/misticpay/webhook', (req, res) => {
  // A MisticPay envia a atualizacao para esta URL. Nao libere acesso somente pelo browser;
  // integre ACCESS_WEBHOOK_URL ao seu sistema de membros/entrega caso precise de automacao.
  console.info('MisticPay webhook received:', JSON.stringify(req.body));
  if (process.env.ACCESS_WEBHOOK_URL) {
    fetch(process.env.ACCESS_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) }).catch((error) => console.error('Access webhook error:', error));
  }
  res.sendStatus(200);
});

app.listen(port, () => console.log(`VIP Exclusive running on port ${port}`));

