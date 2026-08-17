# Ambiente de homologação

O Arcadia agora possui ambientes independentes de publicação:

- **Oficial:** https://cryptominerarcadia.com
- **Homologação Cloudflare:** https://staging.cryptominerarcadia.com
- **Homologação Cloudflare alternativa:** https://crypto-miner-arcadia-staging.criptomineracardia.workers.dev
- **Prévia visual privada:** https://crypto-miner-arcadia-staging.mateusmoraes12345678.chatgpt.site

O histórico de correções e melhorias que podem virar anúncios fica em
[`STAGING_CHANGELOG.md`](./STAGING_CHANGELOG.md). Ele é separado do domínio
oficial e deve ser atualizado a cada nova alteração validada em staging.

## Como usar

1. Toda alteração nova deve ser validada primeiro na homologação.
2. Abra a homologação Cloudflare pelo subdomínio `staging.cryptominerarcadia.com`.
3. Teste navegação, responsividade, salas, racks, temporada, jogos e telas administrativas.
4. Registre qualquer ajuste necessário e só publique no domínio oficial depois da revisão.

## Proteções atuais

- A homologação usa um Worker Cloudflare separado do Worker oficial.
- O banco D1 e o armazenamento R2 da homologação são recursos separados dos recursos de produção.
- `PUBLIC_INDEXING_ENABLED=false` impede indexação da homologação.
- Pix, depósitos cripto, saques manuais e pagamentos reais ficam desativados nesse ambiente.
- O Mercado Pago está em modo de teste e o provedor cripto está em modo sandbox.
- A publicação oficial continua apontando exclusivamente para `cryptominerarcadia.com`.

O endereço `workers.dev` é uma URL pública por padrão. Antes de compartilhar a homologação com terceiros, proteja `staging.cryptominerarcadia.com` no Cloudflare Access, permitindo somente o seu e-mail. A URL `workers.dev` pode ser desativada no painel depois que o subdomínio estiver validado.

## Regra de dados e pagamentos

Não use credenciais de produção na homologação. Para testar autenticação e fluxos persistentes com segurança, o próximo passo é criar um projeto Supabase de teste e credenciais sandbox separadas. A homologação deve usar apenas dados fictícios; saldos, webhooks, chaves de pagamento e saques reais nunca devem ser compartilhados entre os ambientes.

## Fluxo de publicação

**Editar → validar na homologação → revisar → aprovar → publicar no oficial.**

Se um teste falhar, o domínio oficial não é alterado. Se uma publicação oficial apresentar problema, a versão anterior permanece disponível para retorno controlado.
