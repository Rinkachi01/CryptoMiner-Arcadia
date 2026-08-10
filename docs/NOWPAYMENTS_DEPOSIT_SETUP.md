# Depósitos BTC e DOGE com NOWPayments

O Arcadia usa o NOWPayments somente como porta de entrada. Cada compra de saldo
gera uma fatura única. O usuário paga em BTC ou DOGE; o servidor recebe um IPN
assinado e credita a mesma moeda no livro-razão individual. O CMA continua
interno e não sacável.

## O que o proprietário precisa criar

1. Abrir uma conta comercial em `https://nowpayments.io` com os dados verdadeiros
   da operação.
2. Confirmar com o provedor que jogos de mineração virtual e venda de créditos
   internos são aceitos nos países atendidos.
3. Ativar 2FA e guardar os códigos de recuperação fora do computador do site.
4. Cadastrar carteiras externas próprias para recebimento de BTC e DOGE. O
   Arcadia nunca deve receber seed phrase ou chave privada.
5. Criar primeiro uma conta no sandbox e gerar uma chave de API e um segredo
   IPN exclusivos.

Não envie as chaves em conversa. Elas devem ser cadastradas diretamente como
segredos do Cloudflare:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

Durante os testes, manter:

```text
NOWPAYMENTS_API_BASE_URL=https://api-sandbox.nowpayments.io/v1
CRYPTO_DEPOSITS_ENABLED=false
```

O callback que deve ser autorizado no provedor é:

```text
https://crypto-miner-arcadia.criptomineracardia.workers.dev/api/wallet/nowpayments
```

## Teste obrigatório antes da ativação

- fatura criada e expirada sem crédito;
- pagamento parcial sem crédito completo;
- assinatura IPN adulterada recusada;
- repetição do mesmo IPN sem crédito duplicado;
- pagamento BTC creditado uma única vez;
- pagamento DOGE creditado uma única vez;
- conversão posterior para CMA registrada no ledger;
- reembolso e exceção encaminhados para revisão administrativa.

Somente depois desses testes o proprietário pode alterar
`CRYPTO_DEPOSITS_ENABLED` para `true`. A primeira ativação deve usar limites
baixos e poucas contas autorizadas.

## Saques manuais

O site não executa saques automaticamente. Uma fila administrativa pode servir
como solicitação e comprovante, mas a transferência externa feita pelo
proprietário continua sendo uma operação financeira real. Antes de liberar
essa fila para jogadores, definir verificação de identidade, endereço de
destino, limites, análise de risco, confirmação em duas etapas, reserva e
política de reembolso. "Manual" não significa livre de responsabilidade.

