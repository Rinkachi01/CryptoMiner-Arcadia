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
O valor é arredondado para cima em centavos, recebe uma margem técnica de 2% e
é validado uma segunda vez no servidor. A margem evita que uma variação entre a
consulta e a abertura deixe a quantidade cripto abaixo do mínimo. Se a consulta
falhar, a fatura não é criada.

```text
NOWPAYMENTS_SETTLEMENT_ASSET=ltc
```

Só altere a variável depois de mudar a moeda principal no painel da NOWPayments;
as duas configurações precisam coincidir. O mínimo pertence ao provedor e à rede
e não pode ser forçado para baixo. O Arcadia usa taxa variável e não repassa todas
as taxas ao comprador, evitando o adicional do modo fixo.

### Diagnóstico do erro 400 na tela de e-mail

Em 11 de agosto de 2026, a fatura de LTC foi reproduzida e o checkout informou
`Crypto amount is less than minimal`. O e-mail não era a causa. A fatura havia
sido criada exatamente no piso e ficou abaixo dele quando o checkout tentou
gerar o pagamento. A margem de 2% corrige esse caso. Faturas anteriores precisam
ser descartadas e recriadas.

O jogador vê somente as oito faturas mais recentes dos últimos 30 dias. Links
vencidos são removidos imediatamente. Os registros antigos permanecem no banco
como trilha financeira e de auditoria; não são carregados na interface e,
portanto, não tornam a página progressivamente mais pesada.

## Moedas candidatas de baixo custo

Para uma próxima expansão, consultar primeiro XNO (Nano) e XLM (Stellar),
seguidas de LTC e DOGE. Taxa de rede baixa não garante depósito mínimo baixo: o
piso é calculado para o par entre a moeda paga e a moeda de liquidação da conta.
Antes de adicionar um novo saldo interno, comparar o endpoint `min-amount` no
mesmo dia e com a mesma liquidação usada em produção.

BTC permanece disponível por demanda, não por custo. Não ativar XNO ou XLM até
existirem livro-razão, conversão, validação de memo/tag quando aplicável, fila de
saque e reconciliação equivalentes às três moedas atuais.

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

A fila manual aceita BTC, DOGE e LTC. O pedido reserva imediatamente o saldo,
aparece apenas para a conta fundadora e não movimenta blockchain. Depois de pagar
fora do Arcadia, o fundador registra o hash ou ID da transferência. Se recusar,
o servidor estorna o valor reservado. CMA não entra nessa fila.

Ative somente no Worker público:

```text
MANUAL_WITHDRAWALS_ENABLED=true
```

"Manual" não significa livre de responsabilidade: antes do público, ainda é
necessário definir identidade, limites, análise de risco, 2FA e reconciliação.
