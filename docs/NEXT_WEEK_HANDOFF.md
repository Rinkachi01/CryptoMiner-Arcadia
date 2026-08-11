# Crypto Miner Arcadia — próxima fase

Atualizado em 11 de agosto de 2026.

## Estado atual

- login público, confirmação e recuperação usam Supabase;
- Turnstile protege autenticação e os minigames possuem validação,
  limites e revisão no servidor;
- mineração, blocos, energia, inventário, compras e recompensas são
  autoritativos;
- novos jogadores recebem somente um rack e o minerador inicial;
- BTC, DOGE e LTC possuem saldos separados, conversão manual para CMA e
  solicitação de saque manual;
- CMA é crédito interno, comprado em unidades inteiras e não sacável;
- depósitos cripto usam NOWPayments e permanecem restritos à conta fundadora;
- o mínimo de cada fatura vem dinamicamente do provedor;
- Pix via Mercado Pago Orders API está implementado, mas bloqueado em modo de
  homologação até receber credenciais de teste e validar o webhook;
- Central do Proprietário foi dividida em visão geral, economia, tesouraria,
  jogadores e operações;
- protocolos de suporte permanecem visíveis e os guias extensos ficam recolhidos.

## Prioridade 1 — testar Pix sem dinheiro real

1. Criar uma aplicação **Checkout Transparente / Orders API** no Mercado Pago.
2. Obter Access Token de teste e segredo do webhook pelo painel.
3. Cadastrar o tópico Order na URL `/api/wallet/mercadopago`.
4. Salvar os dois valores como segredos do Worker, nunca em Git ou conversa.
5. Testar 1, 2 e 3 CMA; conferir QR Code, aprovação, webhook repetido e um
   único crédito no livro-razão.
6. Somente depois ativar `PIX_DEPOSITS_ENABLED=true` ainda em modo de teste.

## Prioridade 2 — reduzir o piso cripto corretamente

1. Pedir acesso ao modo Custody da NOWPayments, se disponível para a conta.
2. Comparar o mínimo real de LTC, DOGE e BTC com a mesma liquidação.
3. Evitar conversão automática quando possível; ela acrescenta custo.
4. Se a conta exigir uma moeda principal, testar LTC como liquidação.
5. Alterar `NOWPAYMENTS_SETTLEMENT_ASSET` somente depois de mudar a configuração
   no provedor e validar uma fatura completa.

## Prioridade 3 — ensaio de tesouraria

1. Depositar o menor valor aceito em LTC, DOGE e BTC na conta fundadora.
2. Conferir pagamento parcial, expiração, confirmação e IPN repetido.
3. Converter apenas parte do saldo para 1, 2 e 3 CMA.
4. Solicitar saques manuais em LTC, DOGE e BTC para endereços de ensaio.
5. Conferir reserva, pagamento externo, registro do hash, recusa e estorno.
6. Nunca usar o botão “pago” antes de concluir a transferência externa.

## Prioridade 4 — abertura pública

- comprar o domínio somente quando nome e modelo estiverem definidos;
- trocar o Gmail provisório por e-mail de domínio e provedor transacional;
- revisar termos, privacidade, reembolso, idade mínima e obrigações de
  pagamento com profissionais da jurisdição aplicável;
- executar teste de carga, restauração do backup e beta fechado;
- liberar depósitos a jogadores comuns por etapas e com limites baixos;
- manter Pix, CMA e cripto claramente separados no histórico e na tesouraria.

## Roteiro de UX

Em desktop e celular: criar conta, confirmar e-mail, abrir rack, instalar o
minerador inicial, jogar os quatro minigames, obter energia, dividir poder,
acompanhar um bloco, comprar outra sala, abrir carteira, gerar uma prévia Pix,
converter cripto parcialmente e abrir um protocolo de suporte.

Registrar cada falha com dispositivo, tela, ação, resultado esperado, resultado
obtido e captura. Não usar a conta fundadora em testes destrutivos.
