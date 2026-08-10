# Laboratório financeiro do Arcadia

O laboratório existe para validar interface, limites e histórico antes da
contratação de um provedor. Ele não cria endereço blockchain, não recebe
criptomoeda, não debita saldo e não concede CMA.

## O que já pode ser testado

- criação de uma fatura simulada de BTC ou DOGE entre US$ 1 e US$ 1.000;
- prévia de solicitação de saque em BTC ou DOGE sem débito;
- limite de cinco simulações de cada tipo por conta a cada hora;
- histórico individual no servidor e inclusão nas cópias de recuperação;
- visão operacional no painel do proprietário.

## O que permanece bloqueado

- endereço real de depósito;
- webhook ou confirmação de blockchain;
- crédito de BTC, DOGE ou CMA;
- qualquer saque ou transferência;
- custódia de seed phrase ou chave privada.

## Portões para dinheiro real

Antes de trocar o laboratório por um provedor, o proprietário precisa concluir
contrato com uma empresa de pagamentos/custódia, KYC/AML, limites, política de
reembolso, reserva, revisão jurídica e testes de webhook idempotente. O CMA
continua sendo crédito interno não sacável.
