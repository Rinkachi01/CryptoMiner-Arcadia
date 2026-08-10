# Gmail provisório do Arcadia — ativação segura

Este fluxo é somente para homologação e beta pequeno enquanto o domínio ainda
não foi comprado. O Gmail não deve ser publicado na interface: os jogadores
abrem protocolos dentro do Arcadia, e o servidor envia as cópias.

## 1. Confirmação e recuperação de conta no Supabase

1. Ative a verificação em duas etapas na conta Google do Arcadia.
2. Na Conta Google, crie uma **senha de app** exclusiva chamada
   `Supabase Arcadia`. Não use a senha normal do Gmail.
3. No Supabase, abra **Authentication > Emails > SMTP Settings**.
4. Ative SMTP personalizado e preencha:
   - remetente: o Gmail criado para o Arcadia;
   - nome do remetente: `Crypto Miner Arcadia`;
   - host: `smtp.gmail.com`;
   - porta: `465`;
   - usuário: o Gmail completo;
   - senha: a senha de app de 16 caracteres.
5. Mantenha confirmação de e-mail obrigatória.
6. Teste cadastro, reenvio de confirmação e recuperação de senha com uma conta
   diferente da conta fundadora.

Essa senha de app fica apenas no painel do Supabase. Não a envie em conversa,
não a coloque no repositório e não a reutilize na ponte de suporte.

## 2. Cópias e respostas dos protocolos pelo Gmail

1. Acesse `https://script.google.com` com o Gmail do Arcadia.
2. Crie um projeto chamado `Arcadia Mail Bridge`.
3. Substitua o conteúdo de `Code.gs` pelo arquivo
   `docs/google-apps-script/Code.gs` deste projeto.
4. Abra **Configurações do projeto > Propriedades do script** e crie:
   - `ARCADIA_SUPPORT_EMAIL`: o Gmail completo do Arcadia;
   - `ARCADIA_MAIL_SECRET`: uma frase aleatória com pelo menos 32 caracteres.
5. Execute `doGet` uma vez para autorizar o serviço de envio.
6. Clique em **Implantar > Nova implantação > Aplicativo da Web**:
   - executar como: **eu**;
   - acesso: **qualquer pessoa**;
   - use somente a URL final terminada em `/exec`.
7. No Cloudflare Worker, cadastre a mesma URL e o mesmo segredo como secrets.
   O segredo nunca entra em `wrangler.production.jsonc`.

Configuração do Worker:

```text
EMAIL_PROVIDER=google_apps_script
GOOGLE_MAIL_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
GOOGLE_MAIL_WEBHOOK_SECRET=<o mesmo segredo das propriedades do script>
SUPPORT_EMAIL_TO=<Gmail do Arcadia>
TRANSACTIONAL_EMAIL_ENABLED=true
```

A ponte aceita apenas requisições assinadas pelo Worker, rejeita mensagens
antigas, limita tamanho, evita reenvio da mesma resposta e deixa o protocolo no
banco mesmo se o Gmail estiver indisponível.

## 3. Teste de aceite

- criar uma conta nova e confirmar o endereço;
- solicitar recuperação de senha;
- abrir um protocolo na Central de Suporte;
- confirmar que a cópia chegou ao Gmail do Arcadia;
- responder pela Central do Proprietário;
- confirmar que a resposta apareceu no jogo e chegou ao jogador;
- conferir que nenhum e-mail contém senha, chave privada, seed phrase ou código
  de autenticação.

Quando o domínio for comprado, troque o Gmail provisório por Resend e endereços
do domínio. Os protocolos e respostas existentes não precisam ser migrados.
