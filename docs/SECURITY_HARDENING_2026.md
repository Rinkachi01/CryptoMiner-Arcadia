# Arcadia — hardening e próximos controles

## O que foi reforçado nesta atualização

- Mutações de navegador em `/api/*` agora precisam trazer `Origin` e passar
  pela comparação de origem. Isso reduz o risco de CSRF por formulários ou
  chamadas forjadas que omitem os cabeçalhos de navegação.
- Os callbacks assinados do Mercado Pago e da NowPayments continuam aceitando
  requisições sem `Origin`, porque são servidor-para-servidor. Eles permanecem
  protegidos por assinatura, referência, idempotência e validação do valor.
- O Worker passou a enviar `X-DNS-Prefetch-Control: off`,
  `X-Download-Options: noopen` e `Origin-Agent-Cluster: ?1`.
- O HSTS agora inclui subdomínios por um ano. Isso deve permanecer ativo somente
  enquanto todos os subdomínios da zona estiverem em HTTPS.

## Checklist operacional

1. Manter MFA obrigatório para a conta fundadora e para qualquer conta de
   suporte com acesso administrativo.
2. Manter Turnstile obrigatório em produção para cadastro, login, recuperação
   de senha e início de partidas. O segredo fica apenas em `wrangler secret`.
3. Criar regras de Rate Limiting no Cloudflare para `/auth*`, `/api/game`,
   `/api/games/*`, `/api/wallet/*` e `/api/support`. Os webhooks devem ter uma
   regra própria, com limite mais alto e monitoramento de respostas 401/403.
4. Revisar semanalmente os eventos de falha de assinatura, 401/403, picos de
   partidas e créditos manuais. Nenhum alerta deve ser ignorado antes de
   creditar saldo.
5. Manter RLS no Supabase e nunca enviar `service_role`, segredos de pagamento
   ou IPN secret para o navegador.
6. Testar restauração do D1/R2 e manter uma cópia do plano de resposta a
   incidentes fora do repositório.

## Ideias priorizadas para o público

### 1. Arcade semanal rotativo

Um desafio curto muda toda semana. A pontuação e o poder temporário são
calculados no servidor, têm teto por conta e expiram; o prêmio visual pode ser
um selo ou tema de sala. Isso cria retorno frequente sem emitir CMA ilimitado.

### 2. Tour de primeiro acesso

Um tour de quatro passos explica sala, rack, energia e pools. O usuário pode
reabrir o tour pelo menu de ajuda. O tour não entrega CMA: apenas orienta e
registra a conclusão.

### 3. Perfil e sala compartilhável

Permitir um link público opcional com nome, tema e mineradores escolhidos pelo
jogador. Saldos, e-mail, carteira e histórico financeiro permanecem privados.

### 4. Conquistas de carreira

Marcos como “primeiro rack”, “primeiro bloco” e “sete dias ativos” rendem selos
cosméticos e progresso de temporada. Recompensas econômicas continuam sujeitas
às cotas já existentes.

### 5. Alertas operacionais do fundador

O cockpit deve destacar apenas eventos que exigem ação: suporte, feedback,
depósitos, saques e antifraude. Liquidações de bloco permanecem no histórico
econômico, mas não geram notificações visuais repetitivas.

### 6. Central de suporte enxuta

Adicionar busca por protocolo, filtros “aberto”, “em análise” e “resolvido”,
SLA visível e anexos limitados. Registros resolvidos podem ser arquivados após
30 dias; pendências nunca somem automaticamente.

### Ordem sugerida

1. Tour de primeiro acesso e alertas operacionais.
2. Arcade semanal e conquistas cosméticas.
3. Perfil compartilhável com privacidade por padrão.
4. Monetização publicitária somente depois de medir retenção, erros e custo de
   infraestrutura por usuário.
