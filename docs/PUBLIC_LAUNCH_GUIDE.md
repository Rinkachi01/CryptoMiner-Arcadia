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
3. validar o cadastro Supabase já implementado, o SMTP e os redirecionamentos;
4. ativar Cloudflare Turnstile e limites de borda;
5. abrir um beta público sem dinheiro real;
6. adicionar compra de itens/CMA em sentido único por um processador aprovado;
7. estudar saque apenas depois de empresa, KYC/AML, jurídico e provedor regulado.

## Hospedagem, domínio e HTTPS

### Opção A — menor mudança

Manter o projeto no OpenAI Sites durante a validação privada. O projeto já usa banco D1 e arquivo R2 administrados pela plataforma. Antes de torná-lo público, confirmar no painel do Sites a disponibilidade de domínio próprio, autenticação externa, limites e preço do plano público. A abertura pública exige aprovação explícita do proprietário.

### Opção B — recomendada para a operação pública

Migrar a mesma arquitetura para Cloudflare Workers com ativos estáticos, D1 e R2:

- Workers Free: até 100 mil requisições dinâmicas por dia; ativos estáticos são gratuitos e ilimitados;
- D1 Free: 5 milhões de leituras e 100 mil gravações de linhas por dia, com 5 GB totais;
- R2 Free: 10 GB/mês, 1 milhão de operações Classe A e 10 milhões Classe B; saída para internet sem cobrança;
- Universal SSL: certificado HTTPS público emitido e renovado sem custo em todos os planos;
- Turnstile: desafio humano integrado ao servidor;
- Workers Paid: começa em US$ 5/mês quando o volume dinâmico exigir.

O único gasto obrigatório tende a ser o domínio. O Cloudflare Registrar vende e renova a preço de custo do registro e inclui DNSSEC.

Cloudflare não é apenas proteção. Neste projeto ele pode exercer cinco papéis:

1. **DNS:** publica o domínio e os registros de e-mail;
2. **CDN/proxy:** aproxima os arquivos do usuário e absorve tráfego malicioso;
3. **segurança:** HTTPS, DDoS, WAF, Turnstile e limites de frequência;
4. **hospedagem:** o Worker executa o site e as APIs na borda;
5. **dados:** D1 guarda o jogo e R2 guarda arquivos de recuperação.

O Supabase permanece separado e cuida somente de identidade. Firebase Hosting
não é necessário: ele repetiria a hospedagem e exigiria migração da estrutura
Cloudflare já usada pelo servidor autoritativo.

Fontes oficiais:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/
- https://developers.cloudflare.com/registrar/

### Login público

O login atual do site privado continua aceitando a identidade do ChatGPT. Para
o domínio público, o fluxo de e-mail e senha do Supabase já foi implementado com
cookies de sessão, renovação no servidor, confirmação de e-mail, recuperação de
senha e vínculo por e-mail verificado. Assim, o mesmo e-mail usado na beta
preserva o progresso.

Se for necessária uma identidade independente, uma opção econômica é Supabase Auth:

- Free: 50 mil usuários ativos mensais e 500 MB de banco;
- projetos gratuitos podem pausar após uma semana de inatividade;
- Pro começa em US$ 25/mês.

Fonte oficial: https://supabase.com/pricing

Para preparar o Arcadia serão usados `SUPABASE_URL` e
`SUPABASE_PUBLISHABLE_KEY`. A chave publicável identifica o projeto e pode ser
usada pelo cliente. `SUPABASE_SECRET_KEY`, `service_role` e qualquer segredo de
administração nunca devem ser colocados no navegador nem enviados em conversa.
Os valores públicos enviados pelo proprietário foram validados no endpoint de
configuração do projeto. E-mail está habilitado, cadastro está permitido e a
confirmação de e-mail é obrigatória. `PUBLIC_LOGIN_ENABLED=true` pode ser usado
na homologação; o acesso público ainda depende de SMTP e URLs de redirecionamento.

Requisitos mínimos do login público:

- e-mail verificado;
- redefinição de senha segura;
- MFA obrigatório para o proprietário;
- sessão revogável, cookies `Secure`/`SameSite` e validação do token no servidor;
- limite por conta e por borda;
- trilha de auditoria das ações administrativas;
- política de exclusão/exportação compatível com as leis aplicáveis aos usuários.

### Configuração obrigatória no painel do Supabase

Status em 2 de agosto de 2026: Site URL e as duas Redirect URLs do endereço
`crypto-miner-arcadia.criptomineracardia.workers.dev` foram configuradas pelo
proprietário. O endpoint público confirma cadastro por e-mail habilitado,
cadastro aberto e confirmação automática desabilitada.

Em **Authentication → URL Configuration**:

- Site URL de homologação: URL privada atual;
- Site URL de produção: `https://cryptominearcadia.com` depois de o domínio existir;
- Redirect URLs: adicionar a origem de homologação e produção com
  `/auth/callback` e `/auth/update-password`;
- não usar curingas amplos em produção.

Em **Authentication → Email**:

- manter confirmação de e-mail ativada;
- personalizar confirmação e recuperação com a marca Arcadia;
- conectar SMTP próprio antes de convidar o público.

O SMTP padrão do Supabase serve apenas para testes com endereços autorizados da
equipe e possui limite muito baixo. A opção inicial recomendada é Resend Free:
3 mil e-mails/mês e 100/dia. Para receber suporte sem pagar caixa postal,
Cloudflare Email Routing pode encaminhar `support@cryptominearcadia.com` para
uma caixa pessoal verificada. Envio transacional continua no Resend/Supabase.

Fontes oficiais:

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
- https://resend.com/docs/knowledge-base/what-is-resend-pricing
- https://developers.cloudflare.com/email-service/

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
- Turnstile preparado, validado no servidor e com passe de 4 horas.

### Configuração antes do beta público

Criar um widget Turnstile e cadastrar o domínio. Configurar estes segredos/variáveis no ambiente:

```text
TURNSTILE_SITE_KEY=<chave pública>
TURNSTILE_SECRET=<segredo>
TURNSTILE_HOSTNAME=<domínio exato>
AUTH_CAPTCHA_REQUIRED=true
TURNSTILE_REQUIRED=true
```

O servidor valida a ação `arcade_access`, o hostname, uso único e validade do token. Nunca enviar `TURNSTILE_SECRET` ao navegador. A validação no servidor é obrigatória; o token dura cinco minutos e só pode ser usado uma vez.

O roteiro de ativação sem interromper os jogos está em
`docs/ANTI_BOT_ACTIVATION.md`.

Em 2 de agosto de 2026, a chave pública do widget foi instalada no Worker e
`AUTH_CAPTCHA_REQUIRED=true` foi ativado para cadastro, login e recuperação do
Supabase. `TURNSTILE_REQUIRED` permanece desligado nos minigames até o segredo
também ser cadastrado como segredo do Worker e o desafio do Arcade ser testado.

### Continuidade da conta fundadora

- a conta antiga do preview privado continua no D1 do Sites e não é removida
  por uma nova publicação;
- a identidade fundadora é vinculada no servidor pelo hash do mesmo e-mail
  verificado, armazenado como `ARCADIA_OWNER_ACCOUNT_ID`;
- nenhuma outra conta pode ocupar o painel quando o banco público ainda está
  vazio;
- o D1 público e o D1 privado são bancos diferentes. Criar o usuário no
  Supabase com o mesmo e-mail libera a identidade do fundador;
- em 2 de agosto de 2026, a conta fundadora foi migrada uma única vez para o
  D1 público: 429 registros verificados, versão 370, 2.433,840661 CMA, duas
  salas, 24 racks no total e 1.335.760 GH/s instalados. A cópia privada foi
  preservada;
- a migração usa pacote compactado, assinatura HMAC, validade de 24 horas,
  vínculo à mesma identidade e bloqueio de repetição. O destino precisa estar
  no estado inicial para impedir sobrescrita de progresso;
- poder-base de rede é não remunerado e deve continuar existindo no servidor
  para que o primeiro jogador público não receba sozinho todos os blocos.

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
- usar o laboratório financeiro apenas para simular protocolos: ele não gera
  endereço real, não altera saldo e não representa depósito ou saque ativo.

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

Comparação prática:

- **BitPay:** melhor encaixe técnico atual para BTC e DOGE e para o modelo de
  fatura sob custódia do provedor; no menor volume cobra 2% + US$ 0,25 e exige
  aprovação comercial/compliance.
- **CoinGate:** tarifa pública de 1%, mas suporte aos países, ao modelo de jogo,
  moedas, liquidação e payout precisa ser confirmado na aprovação da empresa.
- **NOWPayments:** tarifa pública menor (0,5% em pagamento sem conversão), porém
  o fluxo padrão é não custodial e envia para carteira do comerciante. Isso
  transfere mais responsabilidade de chaves e conciliação para o Arcadia e não é
  a primeira escolha de segurança.

Escolher pelo contrato e pela aprovação da operação, não apenas pela menor taxa.
Nenhuma credencial financeira deve ser criada em nome pessoal para produção.

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

“Operar globalmente” não torna o projeto livre de regulação. A empresa continua
sujeita ao país em que é constituída, aos países de onde é administrada, aos
termos dos provedores e às regras dos locais onde aceita usuários. Isso pode
exigir bloqueio de países, KYC, AML, sanções, proteção de dados, idade mínima,
tributação e licenças. Escolher uma jurisdição apenas para evitar regras não
elimina o risco e pode criar obrigações em vários países ao mesmo tempo.

Se a operação for administrada do Brasil ou atender o mercado brasileiro, as
Resoluções BCB 519, 520 e 521, com efeitos desde 2 de fevereiro de 2026, podem
ser relevantes para serviços de ativos virtuais. Antes de custódia, conversão
ou saque, contratar advogado/contador especializados e usar instituição aprovada.

Fontes oficiais:

- https://www.bcb.gov.br/detalhenoticia/20918/nota?s=08
- https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=520&tipo=Resolu%C3%A7%C3%A3o+BCB

## Checklist do proprietário

- [ ] Definir nome empresarial, CNPJ e conta bancária empresarial.
- [ ] Comprar o domínio e proteger a conta do registrador com MFA.
- [ ] Confirmar se `cryptominearcadia.com` foi realmente registrado; hoje não foi detectado DNS ativo.
- [ ] Criar `support@`, `privacy@` e `security@` no Email Routing.
- [ ] Criar domínio no Resend e configurar SPF, DKIM e DMARC no Cloudflare.
- [ ] Configurar SMTP do Resend no Supabase e testar confirmação/recuperação.
- [ ] Publicar Termos, Privacidade, Cookies, regras do jogo e política de reembolso.
- [ ] Confirmar LGPD, classificação etária e implicações de loot boxes.
- [x] Escolher e configurar login público; manter a conta do proprietário separada.
- [x] Cadastrar a chave pública do Turnstile e proteger o fluxo do Supabase.
- [ ] Cadastrar o segredo também no Worker e ativar `TURNSTILE_REQUIRED=true` nos jogos somente após teste.
- [ ] Configurar limites de borda, alertas e painel de erros.
- [ ] Rodar teste de carga e teste de abuso com contas de ensaio.
- [x] Criar backup completo do ambiente privado e executar um ensaio de recuperação.
- [x] Migrar a conta fundadora verificada para o D1 público e validar saldo,
      inventário, rede e auditoria.
- [ ] Abrir beta público sem dinheiro real e observar pelo menos duas semanas.
- [ ] Escolher processador e concluir aprovação antes de programar depósitos.
- [ ] Manter depósito e saque desativados até parecer jurídico e provedor aprovado; liberar primeiro somente depósitos BTC/DOGE → saldo interno → CMA.

## Critério de abertura

O Arcadia só está pronto para ficar público quando domínio/HTTPS, login público, MFA administrativo, Turnstile obrigatório, limite de borda, termos/LGPD, monitoramento e ensaio de recuperação estiverem aprovados. Dinheiro real continua em um portão separado.

## Sequência exata para o proprietário

1. No Cloudflare, adicionar ou registrar `cryptominearcadia.com` e ativar MFA.
   A conta já possui `criptomineracardia.workers.dev`; o D1 de produção foi
   criado e migrado, e o bucket R2 de recuperação já está habilitado.
2. No Cloudflare Email Routing, verificar uma caixa de destino e criar
   `support@cryptominearcadia.com`, `privacy@...` e `security@...`.
3. No Resend, adicionar o domínio, copiar os registros SPF/DKIM/DMARC para o
   DNS do Cloudflare e obter as credenciais SMTP.
4. No Supabase, configurar SMTP, Site URL e Redirect URLs; testar cadastro,
   confirmação, login, sair e recuperação usando uma conta de ensaio.
5. Criar no Cloudflare um Worker, um banco D1 e um bucket R2. Conectar os
   bindings `DB` e `RECOVERY_ARCHIVE` e cadastrar as variáveis públicas do
   Supabase. Segredos são cadastrados no painel, nunca no código.
6. Conectar `cryptominearcadia.com` ao Worker. O Cloudflare cria DNS e HTTPS.
7. Ativar Turnstile e regras de frequência somente após testar login e jogos.
8. Abrir primeiro um beta público sem depósito e sem saque.
9. Criar uma empresa e solicitar conta comercial no provedor financeiro.
10. Somente depois de aprovação, revisão jurídica e testes de reconciliação,
    cadastrar o token secreto do provedor e ativar depósitos gradualmente.
