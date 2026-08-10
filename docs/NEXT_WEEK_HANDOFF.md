# Crypto Miner Arcadia — retomada da próxima semana

Atualizado em 9 de agosto de 2026.

## Estado seguro deixado nesta rodada

- cadastro, confirmação de e-mail, login, saída e recuperação estão ligados ao
  Supabase;
- Turnstile já protege cadastro, login e recuperação de senha;
- confirmação e recuperação agora possuem tela de envio, reenvio protegido
  e espera de 60 segundos;
- a Central de Suporte registra protocolos por conta, mostra o histórico recente
  e limita abuso mesmo sem um domínio comprado;
- respostas novas aparecem como aviso na navegação, são confirmadas como lidas
  por conta e continuam funcionando sem publicar um e-mail pessoal;
- a segunda conta confirmou o kit inicial correto: um rack e um minerador, sem
  CMA, bateria ou energia gratuita;
- mineração, inventário, energia, compras, blocos e minigames continuam
  autoritativos no servidor;
- a conta fundadora foi migrada e permanece separada das contas de teste;
- depósitos e saques continuam desligados;
- o front recebeu uma nova hierarquia visual, entrada pública mais clara,
  tipografia maior, cartões com mais contraste e navegação mais legível.

## Ordem de execução recomendada

### 1. E-mail transacional e domínio

Objetivo: substituir o envio limitado de teste do Supabase por e-mails próprios.

1. Comprar o domínio somente depois de confirmar o nome definitivo.
2. Criar o domínio no Cloudflare e ativar MFA no registrador e no Cloudflare.
3. Configurar `support@`, `privacy@` e `security@` pelo Email Routing.
4. Validar o domínio no Resend com SPF, DKIM e DMARC.
5. Cadastrar as credenciais SMTP do Resend no Supabase.
6. Testar cadastro, confirmação, recuperação e troca de senha em uma conta de
   ensaio.

Pronto quando: os quatro fluxos chegam em Gmail e Outlook, sem cair em spam, e
nenhuma credencial aparece no navegador ou no repositório.

### 2. Proteção humana nos minigames

Objetivo: impedir automação sem prejudicar jogadores legítimos.

1. Manter o Turnstile atual no acesso à conta.
2. Cadastrar o segredo correspondente no Worker por configuração protegida.
3. Emitir um desafio específico ao iniciar uma rodada do Arcade.
4. Validar no servidor ação, hostname, validade curta e uso único do token.
5. Combinar o desafio com limite por conta, sessão, jogo e janela de tempo.
6. Ativar primeiro em uma conta de teste; depois, no beta fechado.

Pronto quando: repetir token, finalizar rodada impossível ou enviar rajadas
automatizadas não concede poder nem altera o inventário.

### 3. Conversão BTC/DOGE para CMA

Objetivo: concluir o livro-razão e a cotação antes de aceitar dinheiro real.

Já existe: carteira interna, saldo atômico, prévia de cotação, validade, taxa,
execução autoritativa de conversão e adaptador NOWPayments para faturas
BTC/DOGE com IPN assinado, idempotência e crédito confirmado pelo servidor. O
adaptador permanece desligado até a aprovação comercial e o ensaio no sandbox.

Ainda falta:

1. abrir e obter aprovação da conta comercial NOWPayments;
2. decidir jurisdição, empresa, KYC/AML e política de reembolso;
3. cadastrar as credenciais do sandbox diretamente como segredos do Worker;
4. validar fatura, pagamento parcial, expiração, confirmação e repetição de IPN;
5. reconciliar depósito, crédito, conversão, estorno e exceções;
6. executar revisão jurídica e operacional antes de qualquer credencial real.

Regras fixas: CMA é saldo interno e não possui saque; depósito não guarda seed
phrase no Arcadia; nenhum crédito nasce de informação enviada pelo navegador.

### 4. Passagem de UX com contas reais de ensaio

Roteiro mínimo em desktop e celular:

1. criar conta e confirmar e-mail;
2. abrir o rack inicial e instalar o minerador;
3. jogar os três minigames e observar recarga/dificuldade;
4. obter e usar uma bateria;
5. dividir poder entre as três pools;
6. acompanhar um bloco completo de dez minutos;
7. comprar rack, minerador e segunda sala com saldo de ensaio controlado;
8. revisar carteira, inventário, loja, tarefas, carreira e suporte.

Registrar para cada problema: tela, ação, resultado esperado, resultado atual,
dispositivo e uma captura. Não usar a conta fundadora para testes destrutivos.

### 5. Beta fechado antes do dinheiro real

- pelo menos duas semanas sem depósito e sem saque;
- backups recentes e ensaio de recuperação aprovado;
- alertas de erro, abuso, emissão e divergência de ledger;
- revisão de acessibilidade em telas pequenas;
- termos, privacidade, cookies, suporte e classificação etária publicados;
- economia observada com contas comuns, sem usar saldo fundador como referência
  de progressão.

## O que o proprietário pode preparar

- manter a segunda conta exclusivamente para ensaio;
- anotar os problemas encontrados seguindo o roteiro acima;
- decidir o nome e o domínio definitivos, sem necessidade de comprar agora;
- criar a conta do Resend quando o domínio estiver decidido;
- não enviar segredos por chat nem salvar chaves privadas no projeto;
- não contratar provedor de depósito antes de confirmar que ele aceita o modelo
  global pretendido e oferece sandbox, webhooks assinados e conta comercial.

## Próximo ponto de retomada

Sem comprar o domínio ainda, avançar na fila administrativa dos protocolos e no
Turnstile dos minigames. Quando o nome definitivo estiver decidido, seguir o
checklist de `docs/EMAIL_AND_SUPPORT_SETUP.md` para SMTP, DNS e testes. Conversão
real e depósito permanecem atrás de um portão separado.
