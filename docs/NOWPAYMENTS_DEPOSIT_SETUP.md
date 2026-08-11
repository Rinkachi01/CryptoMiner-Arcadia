# Depósitos LTC, DOGE e BTC com NOWPayments

O Arcadia usa o NOWPayments somente como porta de entrada. Cada compra de saldo
gera uma fatura única. O usuário paga em LTC, DOGE ou BTC; o provedor envia um
IPN assinado e informa a moeda de liquidação configurada. Depois dessas conferências, o
servidor credita exatamente a moeda paga no livro-razão individual. O jogador
decide depois quantas unidades inteiras de CMA quer comprar. O CMA continua
interno e não sacável.

## O que o proprietário precisa criar

1. Abrir uma conta comercial em `https://nowpayments.io` com os dados verdadeiros
   da operação.
2. Confirmar com o provedor que jogos de mineração virtual e venda de créditos
   internos são aceitos nos países atendidos.
3. Ativar 2FA e guardar os códigos de recuperação fora do computador do site.
4. Solicitar o modo Custody para evitar uma transferência de saída a cada
   depósito. Se o provedor exigir uma única moeda principal, usar LTC reduz o
   custo de rede; manter USDT TRC20 exige conversão e costuma elevar o mínimo.
   O Arcadia nunca deve receber seed phrase ou chave privada.
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

## Valor mínimo dinâmico

O Arcadia não mantém mais um piso fixo de US$ 5. Antes de criar a fatura, o
servidor consulta o mínimo atual de LTC, DOGE ou BTC para a liquidação configurada.
O valor é arredondado para cima em centavos e validado uma segunda vez no
servidor. Se a consulta falhar, a fatura não é criada.

```text
NOWPAYMENTS_SETTLEMENT_ASSET=ltc
```

Só altere a variável depois de mudar a moeda principal no painel da NOWPayments;
as duas configurações precisam coincidir. O mínimo pertence ao provedor e à rede
e não pode ser forçado para baixo. O Arcadia usa taxa variável e não repassa todas
as taxas ao comprador, evitando o adicional do modo fixo.

## Teste obrigatório antes da ativação

- fatura criada e expirada sem crédito;
- pagamento parcial sem crédito completo;
- assinatura IPN adulterada recusada;
- repetição do mesmo IPN sem crédito duplicado;
- pagamento BTC liquidado na moeda configurada e creditado uma única vez em BTC;
- pagamento DOGE liquidado na moeda configurada e creditado uma única vez em DOGE;
- pagamento LTC liquidado na moeda configurada e creditado uma única vez em LTC;
- depósito confirmado não cria CMA automaticamente;
- compra manual de 1, 2 e 3 CMA debita somente a cripto calculada na cotação;
- valor liquidado divergente encaminhado para revisão, sem crédito indevido;
- reembolso e exceção encaminhados para revisão administrativa.

Somente depois desses testes e de revisão jurídica/contábil o proprietário pode
retirar `CRYPTO_LIVE_DEPOSITS_OWNER_ONLY`. A ampliação deve usar limites baixos,
poucas contas autorizadas e reconciliação diária da tesouraria.

## Saques manuais

A fila manual aceita somente BTC e DOGE. O pedido reserva imediatamente o saldo,
aparece apenas para a conta fundadora e não movimenta blockchain. Depois de pagar
fora do Arcadia, o fundador registra o hash ou ID da transferência. Se recusar,
o servidor estorna o valor reservado. LTC e CMA não entram nessa fila.

Ative somente no Worker público:

```text
MANUAL_WITHDRAWALS_ENABLED=true
```

"Manual" não significa livre de responsabilidade: antes do público, ainda é
necessário definir identidade, limites, análise de risco, 2FA e reconciliação.
