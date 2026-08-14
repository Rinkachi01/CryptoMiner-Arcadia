# Auditoria de segurança — Arcadia

Data da revisão: 14/08/2026

Esta revisão cobriu autenticação, autorização, APIs, webhooks de pagamento, banco, jogos, dependências, cabeçalhos HTTP e exposição de segredos.

## Corrigido nesta revisão

- **Impersonação pelo login legado:** cabeçalhos `oai-authenticated-user-*` agora só são aceitos no host gerenciado do ChatGPT. No domínio público, a sessão verificada do Supabase é a única fonte de identidade.
- **Chave do Supabase:** a configuração pública rejeita chaves `sb_secret_`, `service_role` e equivalentes. Apenas a chave publicável ou um JWT legado com formato válido pode chegar ao navegador.
- **Proteção de APIs:** mutações vindas de outro site são recusadas no Worker quando `Origin`/`Sec-Fetch-Site` não pertencem ao próprio domínio.
- **Cabeçalhos:** CSP, HSTS em HTTPS, COOP, CORP, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy` passaram a ser aplicados de forma única e consistente.
- **Dependência:** a vulnerabilidade de alta severidade do `nanoid` foi atualizada; a auditoria de produção terminou sem vulnerabilidades.

## Controles verificados

- Não há uso de `eval`, `new Function`, `innerHTML` ou `dangerouslySetInnerHTML` no código auditado.
- Rotas administrativas exigem sessão autenticada e autorização do proprietário.
- Webhooks de pagamento validam assinatura, referência, valor, ativo e idempotência antes de creditar saldo.
- Jogos validam nonce, sessão, resultado e pontuação no servidor; o cliente não é a autoridade do prêmio.
- Limites de tamanho, rate limit, expiração e retenção de históricos já estão presentes nas rotas sensíveis.

## Ações externas recomendadas

1. Se alguma chave da NowPayments ou do Mercado Pago foi compartilhada em conversa, tela ou arquivo, revogue e gere outra no painel do provedor. Os valores não são armazenados neste repositório.
2. Mantenha MFA e proteção contra senhas vazadas ativadas no Supabase e revise RLS para qualquer tabela nova.
3. No Cloudflare, mantenha WAF, rate limits para `/auth`, `/api/*`, webhooks e jogos, e Turnstile ativo nas ações automatizáveis.
4. Monitore logs de 401/403, falhas de assinatura, tentativas de origem cruzada e picos de requisições; alertas devem ser tratados antes de creditar pagamentos.

## Validação

- `npm test`: 189/189 testes aprovados
- `npm run lint`: aprovado
- `npm run build`: aprovado
- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades
