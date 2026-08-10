# Depósitos BTC e DOGE com NOWPayments

O Arcadia usa o NOWPayments somente como porta de entrada. Cada compra de saldo
gera uma fatura única. O usuário paga em BTC ou DOGE; o provedor liquida a
tesouraria em USDT TRC20 e envia um IPN assinado. Depois dessas conferências, o
servidor credita exatamente BTC ou DOGE no livro-razão individual. O jogador
decide depois quantas unidades inteiras de CMA quer comprar. O CMA continua
interno e não sacável.

## O que o proprietário precisa criar

1. Abrir uma conta comercial em `https://nowpayments.io` com os dados verdadeiros
   da operação.
2. Confirmar com o provedor que jogos de mineração virtual e venda de créditos
   internos são aceitos nos países atendidos.
3. Ativar 2FA e guardar os códigos de recuperação fora do computador do site.
4. Manter `USDTTRC20` como moeda principal de liquidação e cadastrar uma
   carteira externa própria quando a política da conta exigir retirada. O
   Arcadia nunca deve receber seed phrase ou chave privada.
5. Criar primeiro uma conta no sandbox e gerar uma chave de API e um segredo
   IPN exclusivos.

Se uma chave aparecer em conversa, captura de tela, repositório ou log, ela deve
ser revogada imediatamente e substituída. As credenciais do sandbox e da
produção precisam ser diferentes.

Não envie as chaves em conversa. Elas devem ser cadastradas diretamente como
segredos do Cloudflare:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

Na homologação atual, a produção permanece restrita à conta fundadora:

```text
NOWPAYMENTS_API_BASE_URL=https://api.nowpayments.io/v1
CRYPTO_DEPOSITS_ENABLED=true
CRYPTO_LIVE_DEPOSITS_ENABLED=true
CRYPTO_LIVE_DEPOSITS_OWNER_ONLY=true
CRYPTO_SANDBOX_ENABLED=false
```

O callback que deve ser autorizado no provedor é:

```text
https://crypto-miner-arcadia.criptomineracardia.workers.dev/api/wallet/nowpayments
```

No painel do Cloudflare, abra o Worker `crypto-miner-arcadia`, entre em
**Settings > Variables and Secrets** e cadastre os dois valores como
**Secret/Encrypted**, nunca como texto visível. Não é necessário informar
seed phrase ou chave privada ao Arcadia.

## Teste obrigatório antes da ativação

- fatura criada e expirada sem crédito;
- pagamento parcial sem crédito completo;
- assinatura IPN adulterada recusada;
- repetição do mesmo IPN sem crédito duplicado;
- pagamento BTC liquidado em USDT TRC20 e creditado uma única vez em BTC;
- pagamento DOGE liquidado em USDT TRC20 e creditado uma única vez em DOGE;
- depósito confirmado não cria CMA automaticamente;
- compra manual de 1, 2 e 3 CMA debita somente a cripto calculada na cotação;
- valor liquidado divergente encaminhado para revisão, sem crédito indevido;
- reembolso e exceção encaminhados para revisão administrativa.

Somente depois desses testes e de revisão jurídica/contábil o proprietário pode
retirar `CRYPTO_LIVE_DEPOSITS_OWNER_ONLY`. A ampliação deve usar limites baixos,
poucas contas autorizadas e reconciliação diária da tesouraria.

## Saques manuais

O site não executa saques automaticamente. Uma fila administrativa pode servir
como solicitação e comprovante, mas a transferência externa feita pelo
proprietário continua sendo uma operação financeira real. Antes de liberar
essa fila para jogadores, definir verificação de identidade, endereço de
destino, limites, análise de risco, confirmação em duas etapas, reserva e
política de reembolso. "Manual" não significa livre de responsabilidade.
