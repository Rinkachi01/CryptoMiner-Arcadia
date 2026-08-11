# Mercado Pago Pix — homologação segura

O Arcadia usa **Checkout Transparente com Orders API**. Não usa Assinaturas e
não credita CMA pela tela do navegador. O servidor cria a cobrança, valida a
assinatura do webhook, consulta novamente a ordem no Mercado Pago e só credita
quando o status for `processed` com detalhe `accredited`.

## O que já está pronto

- compra de 1 a 1.000 CMA em unidades inteiras;
- conversão de US$ 1 por CMA para BRL pela PTAX oficial do Banco Central;
- margem operacional configurável e exibida ao jogador (3% inicialmente);
- idempotência na criação e no crédito;
- QR Code/copia e cola devolvidos pelo Mercado Pago;
- webhook em `/api/wallet/mercadopago`;
- produção bloqueada por padrão.

## Passos no painel do Mercado Pago

1. Em **Suas integrações**, crie uma aplicação de pagamentos on-line.
2. Escolha **Checkout Transparente** e a integração pela **Orders API**.
3. Abra **Credenciais de teste** e copie o Access Token de teste.
4. Crie uma conta de comprador de teste. Para aprovação automática do Pix em
   homologação, o servidor já envia o nome de teste recomendado pelo provedor.
5. Em **Webhooks**, cadastre o tópico **Order** com a URL:

   `https://crypto-miner-arcadia.criptomineracardia.workers.dev/api/wallet/mercadopago`

6. Copie a assinatura secreta do webhook.

## Segredos do Worker

Nunca coloque os valores em arquivo, Git ou conversa. Salve no Cloudflare como
segredos do Worker:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`

Depois dos testes de criação, assinatura, repetição do webhook e crédito único,
altere `PIX_DEPOSITS_ENABLED` para `true`. A troca para produção exige novas
credenciais e `MERCADO_PAGO_ENVIRONMENT=production`.

## Regra financeira

O jogador paga em reais e recebe somente a quantidade inteira de CMA escolhida.
Pix não cria saldo BRL sacável. CMA continua sendo crédito interno e não pode
ser sacado. BTC, DOGE e LTC permanecem em saldos separados e seus saques entram
na fila manual do fundador.
