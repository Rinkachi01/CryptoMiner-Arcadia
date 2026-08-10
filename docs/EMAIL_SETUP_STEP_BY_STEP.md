# E-mails do Arcadia — passo a passo do proprietário

Atualizado em 9 de agosto de 2026.

## Estrutura recomendada

Não é necessário pagar por várias caixas postais no início. O plano mais
econômico separa cada responsabilidade:

- **Supabase Auth** envia confirmação de cadastro, recuperação de senha e
  alertas de conta.
- **Resend** entrega os e-mails automáticos com o domínio do Arcadia.
- **Cloudflare Email Routing** recebe os endereços públicos e encaminha para a
  caixa particular verificada do proprietário.
- **Central do Proprietário** organiza e responde aos protocolos sem expor o
  e-mail particular. A resposta também fica visível dentro do jogo.

Enquanto o domínio não for comprado, o cadastro pode continuar em homologação.
O Gmail separado criado para o Arcadia pode ser usado provisoriamente conforme
`docs/GMAIL_BETA_SETUP.md`; ele não substitui o domínio no lançamento.

## Antes de comprar o domínio

- O suporte funciona integralmente por protocolos dentro do Arcadia.
- O jogador recebe um aviso no menu quando existe resposta nova.
- A Central do Proprietário mostra se a resposta ainda aguarda leitura.
- O Gmail separado do Arcadia pode enviar confirmação e recuperação no beta por
  SMTP personalizado do Supabase.
- O suporte pode usar a ponte assinada do Google Apps Script sem publicar o
  endereço na interface.
- Não use uma conta pessoal: a conta deve pertencer somente à operação do jogo,
  ter MFA e senha de app exclusiva.

Quando o domínio for comprado, os protocolos existentes continuam no mesmo
banco. Ativar o Resend apenas adiciona uma cópia por e-mail; nenhum chamado
precisa ser migrado ou recriado.

## Endereços a criar

Depois de comprar o domínio, criar no Cloudflare Email Routing:

| Endereço | Uso | Publicar? |
| --- | --- | --- |
| `support@seudominio.com` | Dúvidas e protocolos de jogadores | Sim |
| `contact@seudominio.com` | Contato geral; pode encaminhar ao suporte | Sim |
| `security@seudominio.com` | Relatos de fraude ou vulnerabilidade | Sim |
| `privacy@seudominio.com` | Privacidade e solicitações de dados | Sim |
| `admin@seudominio.com` | Recuperação e operação interna | Não |

Todos podem encaminhar inicialmente para a caixa particular já protegida por
MFA. Não criar uma caixa para `no-reply`: esse endereço é somente remetente
automático e não deve ser usado para suporte.

## Configuração em seis etapas

1. **Domínio e segurança:** comprar o domínio, colocá-lo no DNS do Cloudflare e
   ativar MFA na conta do Cloudflare, do e-mail particular, do Supabase e do
   Resend.
2. **Recebimento:** no Cloudflare Email Routing, verificar a caixa particular de
   destino e criar os cinco endereços acima.
3. **Envio do cadastro:** no Resend, verificar o subdomínio
   `auth.seudominio.com`. Publicar no Cloudflare os registros SPF e DKIM
   fornecidos e adicionar DMARC. Desativar rastreamento de abertura e de clique
   para mensagens de autenticação.
4. **Supabase Auth:** conectar o Resend pela integração de e-mail do Supabase
   (ou SMTP personalizado, se a integração não estiver disponível no plano).
   Usar `Crypto Miner Arcadia <no-reply@auth.seudominio.com>` e aplicar os
   modelos de `docs/email-templates`.
5. **Respostas do suporte:** verificar também `mail.seudominio.com` no Resend.
   Guardar apenas no servidor `RESEND_API_KEY`, definir
   `EMAIL_FROM=Crypto Miner Arcadia <support@mail.seudominio.com>` e
   `SUPPORT_EMAIL_TO=support@seudominio.com`.
6. **Ativação gradual:** testar cadastro, confirmação, recuperação e uma
   resposta de protocolo em Gmail e Outlook. Somente depois definir
   `TRANSACTIONAL_EMAIL_ENABLED=true`.

## Como o suporte funciona no jogo

1. O jogador autenticado abre um chamado e recebe um protocolo `CMA-XXXXXXXX`.
2. O chamado fica no banco mesmo que o provedor de e-mail esteja indisponível.
3. Somente a conta fundadora vê a fila na Central do Proprietário.
4. O proprietário altera a etapa, escreve a resposta e a salva.
5. O jogador vê a resposta no Arcadia. Com o Resend ativo, recebe também por
   e-mail e pode responder para `support@seudominio.com`.

O proprietário não deve responder manualmente pela caixa particular
encaminhada, pois isso revelaria o endereço particular. A resposta normal deve
sair da Central do Proprietário.

## Checklist antes do beta

- [ ] Todos os serviços administrativos usam MFA.
- [ ] SPF e DKIM estão aprovados e DMARC foi publicado.
- [ ] Confirmação de cadastro retorna ao endereço HTTPS correto.
- [ ] Recuperação de senha não revela se a conta existe.
- [ ] Uma resposta da Central do Proprietário chega e também aparece no jogo.
- [ ] Nenhum segredo aparece no navegador, repositório ou conversa.
- [ ] O Arcadia nunca pede senha, seed phrase, chave privada ou código MFA.
