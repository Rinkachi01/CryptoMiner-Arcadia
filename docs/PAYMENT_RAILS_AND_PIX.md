# Trilhos de pagamento, taxas e Pix

Atualizado em 11 de agosto de 2026.

## Decisão para depósitos cripto pequenos

O valor mínimo não deve ser fixado pelo front-end. A NOWPayments calcula um
mínimo diferente para cada par, rede, taxa e momento. O Arcadia agora consulta
`/v1/min-amount` antes de mostrar o valor e consulta novamente antes de criar a
fatura. Se o provedor não responder, a fatura fica bloqueada; o sistema não
arrisca criar um pagamento abaixo do mínimo.

Prioridade recomendada para a futura expansão:

| Ativo/rede | Vantagem | Cuidado | Decisão sugerida |
| --- | --- | --- | --- |
| LTC | Taxa baixa, rede madura e fluxo simples | O preço continua volátil | Primeiro ativo novo de depósito/saque |
| DOGE | Já existe no jogo e costuma custar menos que BTC | Taxa e mínimo variam | Manter disponível |
| XLM | Taxa de rede muito baixa | Exige memo/tag correto | Adicionar somente com UX e validação de memo |
| USDT TRC20 | Valor estável e já é usado na liquidação | Taxa de retirada da corretora do cliente pode ser alta | Usar na tesouraria; avaliar depósito depois |
| NANO | Taxa de rede zero | Menor disponibilidade e operação adicional | Não priorizar no lançamento |
| BTC | Maior reconhecimento | Inadequado para micropagamentos em períodos caros | Manter, mas avisar o custo |

Não existe uma moeda sempre mais barata para todos: além da taxa da rede, o
cliente pode pagar a tarifa de retirada da corretora e o provedor pode cobrar
conversão. O valor exibido na fatura é a fonte final antes do pagamento.

Fontes oficiais consultadas:

- https://nowpayments.io/help/payments/common
- https://documenter.getpostman.com/view/7907941/2s93JusNJt
- https://nowpayments.io/blog/top-10-cryptos-with-lowest-transaction-fees
- https://nowpayments.io/blog/crypto-fees-explained-what-you-pay-and-how-to-pay-less

## Erro 400 visto na fatura

Na captura de teste, o e-mail foi digitado como `gmail.cor`. O domínio correto é
`gmail.com`. Esse campo pertence à página hospedada pela NOWPayments e não faz
parte da API de criação de fatura do Arcadia. O site pode orientar o usuário,
mas não consegue corrigir um e-mail digitado dentro da página externa.

## Modelo recomendado para Pix

Pix deve começar como **compra direta de unidades inteiras de CMA**, não como
uma carteira em reais dentro do Arcadia:

1. o jogador escolhe 1, 2, 3 ou mais CMA;
2. o servidor calcula o preço em BRL pela referência de USD/BRL, a taxa e uma
   validade curta;
3. o servidor cria uma ordem Pix no Mercado Pago com referência única e chave
   de idempotência;
4. a tela exibe QR Code e código copia e cola retornados pelo provedor;
5. o webhook assinado informa `approved` e o servidor consulta a ordem outra vez;
6. uma transação idempotente credita exatamente a quantidade comprada de CMA;
7. CMA compra itens, mas não pode ser sacado nem convertido de volta;
8. a mineração futura gera saldo interno de BTC/DOGE de blocos fixos;
9. no primeiro lançamento, o jogador solicita saque cripto para carteira externa.

Não implementar inicialmente `cripto -> BRL -> Pix` dentro do Arcadia. Esse
fluxo aumenta substancialmente fraude, chargeback, verificação de identidade,
reserva, reconciliação e obrigações regulatórias. A conversão para reais pode
ser feita pelo jogador em uma plataforma externa até existir empresa, revisão
jurídica/contábil e um provedor que aprove expressamente o modelo.

## Pré-requisitos do Mercado Pago

- conta vendedora verificada e chave Pix cadastrada;
- aplicação criada no painel de desenvolvedores;
- credenciais de teste e, depois da homologação, credenciais de produção;
- `Access Token` guardado somente como segredo no Cloudflare Worker;
- webhook HTTPS com validação de `x-signature` e reconsulta da ordem;
- URL de teste separada da produção;
- confirmação prévia de que o Mercado Pago aceita a venda dos créditos e o
  modelo do jogo.

O Pix é um meio de pagamento brasileiro. Mesmo que o Arcadia seja global, o
fluxo Pix e a conta do vendedor continuam sujeitos às regras aplicáveis e aos
termos do Mercado Pago.

Fontes oficiais consultadas:

- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- https://www.mercadopago.com.br/developers/pt/reference

## Próximo passo técnico

Criar a integração primeiro em teste, atrás de `PIX_DEPOSITS_ENABLED=false`.
Somente após receber as credenciais pelo painel de segredos do Cloudflare serão
implementados criação da ordem, consulta, webhook, reconciliação e painel do
proprietário. Nenhum segredo deve ser enviado por conversa ou salvo no Git.
