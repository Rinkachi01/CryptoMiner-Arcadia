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
- extrato Pix com estados de espera, análise, falha e crédito;
- conciliação manual segura pelo `GET /v1/orders/{id}` quando o webhook atrasar;
- produção ativada somente após a homologação do provedor e dos segredos.

## Estado atual

Em 11 de agosto de 2026, a integração de produção criou com sucesso uma
cobrança mínima de 1 CMA, retornou QR Code e link seguro do Mercado Pago e
persistiu o pedido como `waiting_transfer`. Nenhum CMA foi creditado durante o
teste, porque a cobrança não foi paga. O crédito continua condicionado ao
webhook assinado e à confirmação `processed`/`accredited` consultada novamente
no provedor.

Em 11 de agosto de 2026, a primeira compra real de 1 CMA foi recuperada pela
conciliação, creditada uma única vez e registrada no livro-razão com chave de
idempotência própria. Uma cobrança diferente, não paga, permaneceu aguardando
pagamento sem alterar o saldo.

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

### Caminho exato no Cloudflare

1. Abra **Workers & Pages** e selecione `crypto-miner-arcadia`.
2. Entre em **Settings** → **Variables and Secrets**.
3. Clique em **Add**, escolha o tipo **Secret** e crie
   `MERCADO_PAGO_ACCESS_TOKEN` com o Access Token do ambiente usado.
4. Crie `MERCADO_PAGO_WEBHOOK_SECRET` com a assinatura secreta mostrada ao
   cadastrar o webhook do tópico Order.
5. Salve e implante a nova versão. O valor fica mascarado e não deve ser
   incluído em `wrangler.production.jsonc`.

A Public Key pode aparecer no navegador em integrações que usam o SDK do
Mercado Pago. O fluxo atual do Arcadia cria Orders no servidor e, portanto,
usa o **Access Token** como segredo. Client Secret não substitui o Access Token.

O ambiente publicado usa `PIX_DEPOSITS_ENABLED=true` e
`MERCADO_PAGO_ENVIRONMENT=production`. Para interromper novas cobranças sem
remover segredos nem afetar o histórico, altere apenas
`PIX_DEPOSITS_ENABLED=false` e publique novamente o Worker.

## Regra financeira

O jogador paga em reais e recebe somente a quantidade inteira de CMA escolhida.
Pix não cria saldo BRL sacável. CMA continua sendo crédito interno e não pode
ser sacado. BTC, DOGE e LTC permanecem em saldos separados e seus saques entram
na fila manual do fundador.
