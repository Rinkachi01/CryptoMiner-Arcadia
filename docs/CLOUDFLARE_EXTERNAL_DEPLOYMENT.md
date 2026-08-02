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
   - `PUBLIC_LOGIN_ENABLED=true` após o teste do SMTP.
6. Segredos, somente quando existirem:
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
