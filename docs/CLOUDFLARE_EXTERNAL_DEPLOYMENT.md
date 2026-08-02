# Publicar o Arcadia na conta Cloudflare do proprietário

Este roteiro é para retirar a dependência do endereço `chatgpt.site`. O código
já é compilado como Cloudflare Worker e usa os mesmos nomes lógicos do ambiente
atual. A conta Cloudflare foi conectada em 2 de agosto de 2026.

## Estado atual da conta externa

- subdomínio gratuito: `criptomineracardia.workers.dev`;
- banco D1 criado e com as 19 migrações aplicadas:
  `crypto-miner-arcadia-production` (região ENAM);
- configuração pronta em `wrangler.production.jsonc`;
- R2 habilitado e bucket `crypto-miner-arcadia-recovery` criado na região ENAM;
- domínio `cryptominearcadia.com` ainda não aparece como zona da conta;
- Worker pode ser publicado com D1 e R2 vinculados, sem depender do ambiente Sites.

## Recursos Cloudflare

1. Worker `crypto-miner-arcadia`, criado na primeira publicação.
2. Banco D1 de produção já criado para progresso, livro-razão e auditoria.
3. Bucket R2 `crypto-miner-arcadia-recovery` já criado para recuperação.
4. Bindings do Worker:
   - `DB` → banco D1;
   - `RECOVERY_ARCHIVE` → bucket R2;
   - `ASSETS` → arquivos estáticos gerados pela publicação.
5. Variáveis públicas:
   - `PUBLIC_BASE_URL`;
   - `SUPABASE_URL`;
   - `SUPABASE_PUBLISHABLE_KEY`;
   - `PUBLIC_LOGIN_ENABLED=true` após o teste do SMTP;
   - `TURNSTILE_SITE_KEY` e `AUTH_CAPTCHA_REQUIRED=true` no login público.
6. Segredos, somente quando existirem:
   - `ARCADIA_OWNER_ACCOUNT_ID`, vínculo exclusivo da conta fundadora;
   - `TURNSTILE_SECRET`;
   - `BITPAY_TOKEN` ou token do provedor aprovado;
   - `COINGECKO_API_KEY`.

Nunca cadastrar `service_role`/secret key do Supabase no navegador. O Arcadia
usa somente a chave publicável para autenticação; o estado econômico continua
no D1 e a autorização ocorre no servidor.

## Ordem segura de publicação

1. Publicar primeiro no subdomínio gratuito
   `crypto-miner-arcadia.criptomineracardia.workers.dev`; após a compra do
   domínio, usar `beta.cryptominearcadia.com` para homologação.
2. Rodar as migrações do D1 antes de permitir contas reais.
3. Testar criação de conta, confirmação de e-mail, login, sair e recuperação.
4. Testar kit inicial, racks, compras, energia, pools, blocos e minigames.
5. Testar cópia R2 e recuperação em banco vazio.
6. Ativar Turnstile e limites de borda.
7. Só então apontar o domínio principal.
8. Manter `CRYPTO_DEPOSITS_ENABLED=false` e saques inexistentes no beta público.

## Custo inicial esperado

- domínio: custo anual variável;
- Cloudflare Workers/D1/R2: começar no Free dentro dos limites;
- Supabase Auth: Free durante a validação;
- Cloudflare Email Routing: gratuito para encaminhar o suporte;
- Resend: Free até 3 mil e-mails transacionais/mês e 100/dia;
- pagamento real: tarifa por transação somente depois de aprovado e ativado.

Quando o volume exigir, o primeiro upgrade provável é Workers Paid (mínimo de
US$ 5/mês) e depois Supabase Pro (a partir de US$ 25/mês). O painel de consumo
deve ter alertas antes de qualquer upgrade automático.

## Decisão sobre VPS

O beta permanece em Workers + D1 + R2. Uma VPS só passa a ser indicada quando
o jogo exigir processos continuamente ativos, software de servidor incompatível
com Workers, conexões persistentes específicas ou quando medições reais mostrarem
que o custo do Worker superou o de uma instância administrada. Antes disso, uma
VPS acrescentaria atualizações do sistema, firewall, proxy, TLS, backups,
monitoramento e recuperação sob responsabilidade direta do proprietário.

## Primeira cópia operacional

Em 2 de agosto de 2026, o banco D1 externo foi exportado integralmente e a
cópia SQL foi gravada no R2 em
`manual/d1/arcadia-d1-2026-08-02.sql`. A leitura de volta preservou exatamente
os 16.799 bytes e o SHA-256
`D661E03EA6CDB885244E5A1824EE165A32A0E38BEC3D2F787F98CA2AF7F92AB1`, cobrindo
32 tabelas. O teste foi somente leitura e não sobrescreveu nenhuma conta.

Essa cópia independente protege a infraestrutura externa. O pacote JSON do
painel do proprietário e seu ensaio lógico continuam como uma verificação
adicional, não como substituto deste backup SQL.

## Conta fundadora privada

Em 2 de agosto de 2026, a conta histórica do Sites foi verificada com saldo,
inventário, 12 racks na sala 2 e acesso à Central do Proprietário. Um pacote
completo de 204 KB e 452 registros foi criado no armazenamento separado; o
ensaio de reconstrução terminou aprovado em 4/4 portões. A conta pública ainda
não foi criada no D1 externo. O vínculo administrativo externo já está preso à
identidade fundadora e não pode ser reivindicado pelo primeiro visitante.
