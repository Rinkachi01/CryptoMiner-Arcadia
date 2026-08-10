# E-mail e suporte — ativacao segura

Atualizado em 9 de agosto de 2026.

## O que ja funciona

- Cadastro com confirmacao de e-mail pelo Supabase Auth.
- Reenvio da confirmacao, com espera de 60 segundos e Turnstile quando exigido.
- Recuperacao e troca de senha sem revelar se um e-mail existe.
- Chamado autenticado, protocolo individual e historico recente dentro do Arcadia.
- Limite de um chamado por minuto e cinco chamados em 24 horas por conta.
- Preparacao para notificar o suporte pelo Resend sem enviar a chave ao navegador.

Os chamados ficam registrados no banco mesmo enquanto o envio corporativo estiver desligado. Nesta fase, `TRANSACTIONAL_EMAIL_ENABLED` deve continuar como `false`.

## Depois de comprar o dominio

1. Escolher o dominio principal e um subdominio de envio, por exemplo `auth.seudominio.com`.
2. Verificar o subdominio no Resend e publicar os registros DNS solicitados: SPF e DKIM. Adicionar DMARC com politica gradual.
3. Criar `support@seudominio.com` como endereco de atendimento. O remetente pode ser `Arcadia <no-reply@auth.seudominio.com>`.
4. No Supabase, abrir **Authentication > Emails > SMTP Settings** e configurar o SMTP personalizado do Resend.
5. Conferir **Site URL** e **Redirect URLs** para o endereco publico definitivo, sempre com HTTPS.
6. Aplicar os modelos da pasta `docs/email-templates` e enviar testes para Gmail e Outlook.
7. Salvar no servidor, nunca no codigo ou navegador:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `SUPPORT_EMAIL_TO`
8. Somente depois dos testes, definir `TRANSACTIONAL_EMAIL_ENABLED=true` e publicar novamente.

## Matriz de verificacao

- Cadastro novo recebe confirmacao e o link retorna ao Arcadia.
- Reenvio respeita a espera e nao revela contas existentes.
- Recuperacao permite definir uma nova senha e invalida o fluxo antigo.
- Mensagens possuem apenas um objetivo e um botao principal.
- Remetente, resposta e dominio pertencem ao Arcadia.
- Chamado aparece no historico mesmo se o provedor de e-mail ficar indisponivel.
- Chaves, senhas, seed phrases e codigos de autenticacao nunca sao pedidos.

## Retencao e operacao

O jogador visualiza os 10 protocolos mais recentes. Protocolos resolvidos ou encerrados podem ser removidos automaticamente depois de 180 dias. Antes do beta publico, a Central do Proprietario deve receber uma fila para responder, alterar status e registrar notas internas.

## Limites desta fase

- O endereco `support@cryptominearcadia.com` e apenas uma reserva visual enquanto o dominio nao pertence ao projeto.
- Nao existe envio corporativo ativo sem dominio verificado e segredo do Resend.
- Esta entrega nao ativa deposito, saque nem conversao com dinheiro real.

