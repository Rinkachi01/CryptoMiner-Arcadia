# Pix no Arcadia com Mercado Pago

## Escolha no painel

Escolher **Checkouts → Checkout Transparente**. Não escolher **Assinaturas**:
o depósito para comprar CMA é uma cobrança única, não recorrente. Entre as três
opções da tela:

- Checkout Pro é o mais simples, mas redireciona o jogador;
- Checkout Bricks fornece componentes prontos;
- Checkout Transparente permite manter a experiência do Arcadia e usar Pix por
  QR Code ou link, com valor e protocolo definidos pelo servidor.

Para este projeto, usar Checkout Transparente pela **Orders API**, que é o fluxo
recomendado atualmente pelo Mercado Pago.

## Fluxo financeiro correto

1. O jogador escolhe uma quantidade inteira de CMA.
2. O servidor calcula o preço em BRL usando uma cotação USD/BRL vigente e cria
   uma order Pix com referência única.
3. O navegador exibe QR Code e copia-e-cola devolvidos pelo Mercado Pago.
4. O webhook chega ao Worker.
5. O Worker consulta a order diretamente no Mercado Pago e confere referência,
   valor, moeda e status aprovado.
6. Somente então o livro-razão credita CMA uma única vez.

O navegador nunca confirma pagamento e o CMA não é creditado ao criar o QR Code.

## O que preparar

1. Criar uma aplicação de teste em **Suas integrações**.
2. Cadastrar uma chave Pix válida na conta vendedora.
3. Usar as credenciais de teste e duas contas separadas: vendedor e comprador.
4. Configurar notificações para a futura rota
   `/api/wallet/mercadopago`.
5. Guardar o Access Token exclusivamente como segredo do Cloudflare.

Variáveis planejadas:

```text
PIX_DEPOSITS_ENABLED=false
MERCADO_PAGO_ACCESS_TOKEN=<segredo do Cloudflare>
MERCADO_PAGO_WEBHOOK_SECRET=<segredo do Cloudflare>
MERCADO_PAGO_ENVIRONMENT=test
```

Não enviar essas credenciais em conversa e não colocá-las no repositório. A
integração deve permanecer desativada até passar pelos testes de webhook
duplicado, valor divergente, order expirada, reembolso e chargeback.

Fontes oficiais:

- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-model
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/test-accounts
