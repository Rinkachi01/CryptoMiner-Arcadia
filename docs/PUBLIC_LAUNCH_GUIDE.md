# Arcadia — guia de pré-lançamento público

Atualizado em 2 de agosto de 2026.

## Arquitetura escolhida nesta fase

- **Hospedagem e servidor:** manter Sites/Cloudflare. O projeto já usa Worker,
  D1 e R2; migrar para Firebase duplicaria ou substituiria essa estrutura sem
  benefício para o beta.
- **Cadastro público:** Supabase Auth para e-mail verificado, recuperação de
  senha e sessão. A conta do proprietário deve usar MFA e ficar separada.
- **Progresso do jogo:** continua no D1, sempre conferido pelo servidor.
- **Carteira:** livro-razão individual por jogador, com custódia e endereços
  administrados pelo provedor de pagamento. O Arcadia não guarda seed phrase ou
  chave privada.
- **Depósitos:** fatura única BTC/DOGE vinculada à conta; o navegador nunca
  confirma o crédito.
- **Saques:** etapa posterior. CMA não é sacável; BTC/DOGE exigem KYC, limites,
  reserva e provedor de payout aprovado.

## Decisão recomendada

Não abrir depósitos ou saques na primeira versão pública. O CMA é um crédito virtual fechado: não sacável e não transferível. Para a economia interna, 1 CMA usa US$ 1 como unidade de referência contábil, mas isso não é promessa de resgate, paridade financeira ou investimento. A conversão interna ativada no beta é somente BTC ou DOGE para CMA, nunca CMA para cripto. Esses saldos vêm das recompensas simuladas do jogo; depósitos externos continuam bloqueados até existir contrato com provedor, operação aprovada e revisão jurídica.

O caminho de menor risco e custo é:

1. terminar o beta privado no Sites;
2. comprar somente o domínio;
3. confirmar qual caminho de autenticação pública será suportado pela plataforma;
4. ativar Cloudflare Turnstile e limites de borda;
5. abrir um beta público sem dinheiro real;
6. adicionar compra de itens/CMA em sentido único por um processador aprovado;
7. estudar saque apenas depois de empresa, KYC/AML, jurídico e provedor regulado.

## Hospedagem, domínio e HTTPS

### Opção A — menor mudança

Manter o projeto no OpenAI Sites durante a validação privada. O projeto já usa banco D1 e arquivo R2 administrados pela plataforma. Antes de torná-lo público, confirmar no painel do Sites a disponibilidade de domínio próprio, autenticação externa, limites e preço do plano público. A abertura pública exige aprovação explícita do proprietário.

### Opção B — melhor custo-benefício para uma operação pública pequena

Migrar a mesma arquitetura para Cloudflare Workers com ativos estáticos, D1 e R2:

- Workers Free: até 100 mil requisições dinâmicas por dia; ativos estáticos são gratuitos e ilimitados;
- D1 Free: 5 milhões de leituras e 100 mil gravações de linhas por dia, com 5 GB totais;
- R2 Free: 10 GB/mês, 1 milhão de operações Classe A e 10 milhões Classe B; saída para internet sem cobrança;
- Universal SSL: certificado HTTPS público emitido e renovado sem custo em todos os planos;
- Turnstile: desafio humano integrado ao servidor;
- Workers Paid: começa em US$ 5/mês quando o volume dinâmico exigir.

O único gasto obrigatório tende a ser o domínio. O Cloudflare Registrar vende e renova a preço de custo do registro e inclui DNSSEC.

Fontes oficiais:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/
- https://developers.cloudflare.com/registrar/

### Login público

O login atual pertence ao ambiente privado do ChatGPT/Sites. Não tratar isso como login final do público. A plataforma de hospedagem deve confirmar primeiro o caminho de identidade externa.

Se for necessária uma identidade independente, uma opção econômica é Supabase Auth:

- Free: 50 mil usuários ativos mensais e 500 MB de banco;
- projetos gratuitos podem pausar após uma semana de inatividade;
- Pro começa em US$ 25/mês.

Fonte oficial: https://supabase.com/pricing

Para preparar o Arcadia serão usados `SUPABASE_URL` e
`SUPABASE_PUBLISHABLE_KEY`. A chave publicável identifica o projeto e pode ser
usada pelo cliente. `SUPABASE_SECRET_KEY`, `service_role` e qualquer segredo de
administração nunca devem ser colocados no navegador nem enviados em conversa.
Mesmo com os dois valores configurados, `PUBLIC_LOGIN_ENABLED` permanece falso
até os testes de migração de conta e recuperação de senha terminarem.

Requisitos mínimos do login público:

- e-mail verificado;
- redefinição de senha segura;
- MFA obrigatório para o proprietário;
- sessão revogável e cookies `Secure`, `HttpOnly` e `SameSite`;
- limite por conta e por borda;
- trilha de auditoria das ações administrativas;
- política de exclusão/exportação de dados compatível com LGPD.

## Anti-bot e anti-automação

### Já implementado no aplicativo

- sessão de jogo, nonce, semente, prazo e dificuldade criados no servidor;
- pontuação e recompensa recalculadas no servidor;
- proteção contra submissão duplicada e atualização concorrente;
- recarga e limites horários/diários por jogo;
- orçamento diário fixo de poder;
- limite transversal: 12 inícios e 160 ações de Arcade a cada 10 minutos por conta;
- detecção conservadora de intervalos impossíveis ou artificialmente uniformes;
- sessões suspeitas rejeitadas sem recompensa e enviadas à revisão administrativa;
- eventos de segurança sem armazenar IP, token do desafio ou impressão digital invasiva;
- eventos de segurança conservados por 30 dias e janelas temporárias removidas após expirar;
- Turnstile preparado, validado no servidor e com passe de 12 horas.

### Configuração antes do beta público

Criar um widget Turnstile e cadastrar o domínio. Configurar estes segredos/variáveis no ambiente:

```text
TURNSTILE_SITE_KEY=<chave pública>
TURNSTILE_SECRET=<segredo>
TURNSTILE_HOSTNAME=<domínio exato>
TURNSTILE_REQUIRED=true
```

O servidor valida a ação `arcade_access`, o hostname, uso único e validade do token. Nunca enviar `TURNSTILE_SECRET` ao navegador. A validação no servidor é obrigatória; o token dura cinco minutos e só pode ser usado uma vez.

Fonte oficial: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

Na borda, criar regras de limite para login, registro, recuperação de senha, início/finalização de partidas, compra e webhooks. Bot Fight Mode é gratuito, mas atua no domínio inteiro e não permite exceções; testar com cuidado porque pode afetar APIs.

Fontes oficiais:

- https://developers.cloudflare.com/waf/rate-limiting-rules/
- https://developers.cloudflare.com/bots/get-started/bot-fight-mode/

## Depósito, conversão, carteira e saque

### O que não fazer

- não criar uma carteira custodial própria;
- não gerar endereços de depósito diretamente no servidor do jogo;
- não guardar seed phrase ou chave privada;
- não creditar saldo apenas porque uma transação apareceu no mempool;
- não converter BTC/DOGE/LTC em CMA sem cotação de mercado válida, taxa transparente e confirmação autoritativa;
- não prometer “1 CMA = US$ 1” nem rentabilidade;
- não liberar saque com uma simples chamada de API do cliente.

### Primeira etapa financeira recomendada: compra em sentido único

```text
Jogador escolhe pacote → servidor cria invoice no provedor
→ jogador paga ao provedor → provedor confirma na blockchain
→ notificação chega ao servidor → servidor busca novamente a invoice na API
do provedor → valida estado final, moeda, valor, invoice e idempotência
→ razão contábil credita BTC/DOGE uma única vez
```

O navegador nunca confirma pagamento. No caso do BitPay, a notificação IPN não é assinada e deve ser usada apenas como gatilho: o servidor precisa consultar a invoice novamente na API e só aceitar `confirmed` ou `complete`. Reembolsos, pagamento insuficiente/excessivo e expiração precisam de estados próprios.

BitPay é um candidato porque suas invoices aceitam BTC e DOGE e seu produto de
payout documenta BTC e DOGE, conforme disponibilidade e aprovação da conta. A
tarifa pública de processamento está na faixa de 1% a 2% + US$ 0,25 por
transação; contas de produção passam por análise de conformidade. Confirmar se
a operação e o modelo Arcadia são aceitos no Brasil antes de integrar.

Fontes oficiais:

- https://www.bitpay.com/pricing
- https://developer.bitpay.com/docs/integration-1
- https://developer.bitpay.com/reference/payouts
- https://support.bitpay.com/hc/en-us/articles/203411543-What-cryptocurrencies-can-I-use-to-pay-a-BitPay-Invoice
- https://support.bitpay.com/hc/en-us/articles/201890513-What-are-my-options-for-settlement

### Modelo de carteira escolhido

O RollerCoin apresenta um endereço de depósito ligado à conta do jogador. Para o Arcadia, a interface será parecida, mas a arquitetura não terá chaves no servidor do jogo:

- cada jogador possui um livro-razão individual no D1, com saldos separados de CMA, BTC e DOGE;
- cada depósito real cria uma invoice/endereço único no processador, ligado ao identificador interno do jogador;
- o processador administra a recepção e liquidação em uma estrutura de custódia/conta comercial maior;
- o Arcadia credita o livro-razão apenas depois de consultar e validar o estado final da invoice;
- seed phrase, chave privada e carteira quente não entram no código, banco ou navegador do Arcadia.

As tabelas de contas de carteira, intenções de depósito e eventos do provedor já estão preparadas. A criação de invoices permanece desligada por configuração até o contrato e as credenciais de produção existirem.

### Conversão de BTC ou DOGE para CMA

A conversão interna já funciona no beta: o servidor consulta BTC/USD e DOGE/USD, fixa a cotação por cinco minutos e mostra CMA bruto, reserva econômica e CMA líquido. A confirmação debita o saldo interno da moeda, credita CMA, consome a cotação uma única vez e grava uma entrada imutável no histórico financeiro. Litecoin continua apenas na fonte de preço e não é conversível enquanto não existir pool/carteira LTC no jogo.

A regra econômica inicial da prévia é 1 CMA por US$ 1 de valor de mercado, com reserva de 3% e mínimo equivalente a US$ 1. Esses parâmetros devem ser revistos com os custos reais do processador antes da ativação.

Para os testes privados, a fonte pública sem chave do CoinGecko é suficiente. Antes do beta público, criar uma chave gratuita Demo e configurar `COINGECKO_API_KEY` no ambiente hospedado; a aplicação continuará consultando somente pelo servidor e nunca exporá a chave ao navegador. As prévias e execuções ficam registradas por até 30 dias para auditoria.

### Saque

Saque é a última etapa. Ele exige, no mínimo:

- identificação e verificação KYC;
- controles AML e sanções;
- limite diário/mensal e período de segurança;
- confirmação reforçada/MFA;
- revisão manual por risco;
- provedor de payout com contrato e aprovação para o Brasil;
- conciliação, impostos, suporte e política de contestação.

No Brasil, as Resoluções BCB 519, 520 e 521 passaram a produzir efeitos em 2 de fevereiro de 2026 e disciplinam autorização, AML, governança, segurança e transparência para prestadores de serviços de ativos virtuais. Antes de custódia, conversão ou saque, contratar advogado/contador especializados e usar instituição autorizada.

Fontes oficiais:

- https://www.bcb.gov.br/detalhenoticia/20918/nota?s=08
- https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=520&tipo=Resolu%C3%A7%C3%A3o+BCB

## Checklist do proprietário

- [ ] Definir nome empresarial, CNPJ e conta bancária empresarial.
- [ ] Comprar o domínio e proteger a conta do registrador com MFA.
- [ ] Publicar Termos, Privacidade, Cookies, regras do jogo e política de reembolso.
- [ ] Confirmar LGPD, classificação etária e implicações de loot boxes.
- [ ] Escolher e configurar login público; manter a conta do proprietário separada.
- [ ] Cadastrar Turnstile e ativar `TURNSTILE_REQUIRED=true` somente após teste.
- [ ] Configurar limites de borda, alertas e painel de erros.
- [ ] Rodar teste de carga e teste de abuso com contas de ensaio.
- [ ] Criar backup, baixar uma cópia e executar um ensaio de recuperação.
- [ ] Abrir beta público sem dinheiro real e observar pelo menos duas semanas.
- [ ] Escolher processador e concluir aprovação antes de programar depósitos.
- [ ] Manter depósito e saque desativados até parecer jurídico e provedor aprovado; liberar primeiro somente depósitos BTC/DOGE → saldo interno → CMA.

## Critério de abertura

O Arcadia só está pronto para ficar público quando domínio/HTTPS, login público, MFA administrativo, Turnstile obrigatório, limite de borda, termos/LGPD, monitoramento e ensaio de recuperação estiverem aprovados. Dinheiro real continua em um portão separado.
