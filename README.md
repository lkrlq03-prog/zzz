# VIP Exclusive + MisticPay

Landing page com checkout Pix integrado à MisticPay. O servidor gera a cobrança, exibe o QR Code/copia e cola e acompanha a confirmação.

## Publicar no Railway

1. Envie estes arquivos para um repositório GitHub e crie um projeto a partir dele no Railway.
2. Em **Variables**, cadastre `MISTICPAY_CLIENT_ID` e `MISTICPAY_CLIENT_SECRET` com a chave de acesso (`pk_…` / `sk_…`) criada no painel MisticPay.
3. Após o primeiro deploy, copie a URL pública do Railway e cadastre-a em `APP_URL`, por exemplo `https://meu-site.up.railway.app`.
4. Faça um novo deploy. O Railway detecta Node.js e executa `npm start` automaticamente.

Opcionalmente, defina `ACCESS_WEBHOOK_URL` para encaminhar as notificações recebidas para seu sistema de membros. Não coloque credenciais em `vip-exclusive-acesso-privado.html` nem envie o arquivo `.env` ao Git.

## Desenvolvimento

Copie `.env.example` para `.env`, preencha as chaves e execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

