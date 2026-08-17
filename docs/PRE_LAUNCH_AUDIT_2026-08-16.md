# Arcadia — auditoria pré-publicação (16/08/2026)

## Resultado

- Build de produção: **passou**.
- TypeScript (`tsc --noEmit`): **passou após as correções**.
- Testes autoritativos: **203 passaram, 0 falharam**.
- Dependências de produção (`npm audit --omit=dev`): **0 vulnerabilidades conhecidas**.
- Lint: **0 erros**, 5 avisos não bloqueantes de hooks/imagens.

## Correções aplicadas nesta auditoria

1. O painel de segurança agora encontra fatores TOTP pendentes na lista correta do Supabase (`all`). Isso reativa o botão de continuar/recuperar uma configuração interrompida.
2. O fluxo de indicação recebeu um tipo de resultado discriminado. O TypeScript agora protege as ramificações de conflito e evita que um estado incompleto seja usado para creditar mineração.
3. O endpoint de jogo passou a responder 503 quando o estado autoritativo não pode ser criado/lido, em vez de continuar com um estado possivelmente nulo.
4. As notificações de drop dos três jogos aceitam tanto o formato legado numérico quanto o objeto de recompensa atual.
5. A allowlist opcional de staging deixou de quebrar a tipagem do ambiente de produção; o domínio canônico continua sendo decidido pela política de host.

## O que foi verificado

- Login por e-mail, confirmação, recuperação, Google OAuth e preservação da conta por e-mail verificado.
- MFA/TOTP, AAL2 e bloqueio de rotas sensíveis quando a sessão não atende ao nível exigido.
- Turnstile, limites de tentativa, sessões de minigame, replay e cálculo de recompensas somente no servidor.
- CSRF/origem, host canônico, redirecionamento de `www`, cabeçalhos defensivos, CSP, HSTS e respostas sem cache para APIs.
- Pix/Mercado Pago: assinatura, idempotência, status e crédito autoritativo.
- NOWPayments: assinatura IPN, referência da fatura, moeda paga, valor USD, liquidação configurada, idempotência e crédito somente da moeda recebida; a conversão para CMA continua manual.
- Saques: reserva de saldo, fila manual, revisão, pagamento, recusa e estorno concorrente.
- Economia: emissão fixa por bloco, limites de poder, energia, baterias, indicação e recompensas dos jogos.
- Mobile, racks, temporada, idioma, suporte, tarefas e histórico.

## Pendências externas antes do lançamento público

### 1. Subdomínio `www`

O domínio principal respondeu `200` com os cabeçalhos de segurança esperados. O `www.cryptominerarcadia.com` respondeu **Cloudflare 1101**, antes de chegar à aplicação. Isso indica que o hostname ainda não está ligado à mesma implantação do Worker (ou está apontando para uma implantação quebrada). No Cloudflare, o `www` precisa ser um Custom Domain/route do mesmo Worker de produção ou ser redirecionado por uma regra de redirecionamento para `https://cryptominerarcadia.com/$1`.

O hostname de staging respondeu com `302` para o Cloudflare Access, comportamento esperado para ambiente privado.

### 2. Pagamentos reais

Os fluxos e os webhooks foram validados por testes assinados, mas não foi possível executar um pagamento real sem movimentar fundos. Antes da divulgação, faça um teste de baixo valor para cada provedor e confirme no painel:

- criação da cobrança;
- recebimento do webhook assinado;
- uma única creditação;
- atualização do extrato;
- conversão manual somente após o saldo recebido;
- rejeição de moeda/valor incorreto.

Nunca credite um pedido apenas porque o navegador voltou da página do provedor.

### 3. Segredos e configuração

Confirme no Worker de produção, como **Secrets** (não como código ou variável pública): `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, token do Mercado Pago e `TURNSTILE_SECRET`. A chave `SUPABASE_PUBLISHABLE_KEY` pode permanecer pública; não publique `service_role`, `sb_secret_` ou chaves privadas.

### 4. Avisos de lint

Os cinco avisos atuais não bloqueiam o build: dois hooks com inicialização intencional de sessão e três imagens de QR/código que não usam o otimizador de imagens. Podem ser tratados numa rodada de performance, mas não impedem a publicação.

## Decisão de publicação

O código está tecnicamente pronto para uma **publicação controlada**. Recomenda-se corrigir o `www`, confirmar os Secrets de produção e executar o teste real mínimo de Pix e cripto antes de abrir a divulgação. A publicação definitiva não deve ser feita automaticamente sem confirmar esses três itens.
