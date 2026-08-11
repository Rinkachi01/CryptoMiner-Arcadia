# Crypto Miner Arcadia — retomada da próxima semana

Atualizado em 11 de agosto de 2026.

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
- depósitos reais estão em homologação exclusiva da conta fundadora; saques
  continuam totalmente desligados;
- cada depósito confirmado credita BTC ou DOGE no saldo interno, sem criar CMA;
- a compra de CMA agora parte de unidades inteiras (1, 2, 3...) e calcula a
  quantidade necessária de BTC ou DOGE pela cotação vigente;
- o front recebeu uma nova hierarquia visual, entrada pública mais clara,
  tipografia maior, cartões com mais contraste e navegação mais legível.
- o piso local fixo de US$ 5 foi removido; BTC e DOGE agora usam o mínimo atual
  informado pelo provedor, com validação repetida no servidor;
- o caminho Pix foi definido como compra direta de CMA inteiro, sem criar uma
  carteira BRL sacável dentro do jogo.

## Ordem de execução recomendada

### 1. Fechar a homologação financeira da conta fundadora

Objetivo: comprovar o caminho completo sem abrir depósitos para outras contas.

1. Criar uma fatura mínima de BTC e outra de DOGE pela conta fundadora.
2. Conferir expiração, pagamento parcial, pagamento concluído e repetição do IPN.
3. Confirmar que o depósito altera somente BTC/DOGE e mantém CMA inalterado.
4. Comprar 1, 2 e 3 CMA manualmente e conferir o débito exato da cripto.
5. Reconciliar o valor recebido na NOWPayments, a liquidação em USDT TRC20 e a
   obrigação interna registrada em BTC/DOGE.
6. Registrar divergências em uma fila administrativa, sem correção automática.

Pronto quando: duas moedas percorrem fatura → IPN → saldo cripto → compra inteira
de CMA, sem crédito duplicado ou diferença de livro-razão.

### 2. Tesouraria e fila operacional de saques

Objetivo: preparar controles sem ativar transferências para jogadores.

1. Criar visão de cobertura da tesouraria por ativo e em USDT.
2. Separar saldo disponível, saldo comprometido e divergência de liquidação.
3. Projetar solicitação de saque com revisão manual, 2FA, limites e auditoria.
4. Manter o botão público de saque bloqueado até KYC/AML, termos e operação
   estarem definidos.

### 3. E-mail transacional e domínio

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

### 4. Proteção humana nos minigames

Objetivo: impedir automação sem prejudicar jogadores legítimos.

1. Manter o Turnstile atual no acesso à conta.
2. Cadastrar o segredo correspondente no Worker por configuração protegida.
3. Emitir um desafio específico ao iniciar uma rodada do Arcade.
4. Validar no servidor ação, hostname, validade curta e uso único do token.
5. Combinar o desafio com limite por conta, sessão, jogo e janela de tempo.
6. Ativar primeiro em uma conta de teste; depois, no beta fechado.

Pronto quando: repetir token, finalizar rodada impossível ou enviar rajadas
automatizadas não concede poder nem altera o inventário.

### 5. Conversão BTC/DOGE para CMA

Objetivo: observar preços, arredondamento e reserva econômica durante a
homologação restrita.

Já existe: carteira interna, saldo atômico, compra inteira de CMA, prévia de
cotação, validade, taxa, execução autoritativa e faturas NOWPayments com IPN
assinado, idempotência e crédito confirmado pelo servidor. A produção está
restrita à conta fundadora.

Ainda falta:

1. validar fatura, pagamento parcial, expiração, confirmação e repetição de IPN;
2. reconciliar depósito, crédito cripto, compra de CMA, estorno e exceções;
3. decidir jurisdição, empresa, KYC/AML e política de reembolso;
4. executar revisão jurídica e operacional antes de liberar outras contas.

Regras fixas: CMA é saldo interno e não possui saque; depósito não guarda seed
phrase no Arcadia; nenhum crédito nasce de informação enviada pelo navegador.

### 6. Passagem de UX com contas reais de ensaio

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

### 7. Beta fechado antes de ampliar o dinheiro real

- pelo menos duas semanas sem depósito e sem saque;
- backups recentes e ensaio de recuperação aprovado;
- alertas de erro, abuso, emissão e divergência de ledger;
- revisão de acessibilidade em telas pequenas;
- termos, privacidade, cookies, suporte e classificação etária publicados;
- economia observada com contas comuns, sem usar saldo fundador como referência
  de progressão.

### 8. Pix em sandbox, depois da homologação cripto

1. Confirmar com o Mercado Pago que o modelo comercial é aceito.
2. Criar aplicação e chave Pix em conta vendedora verificada.
3. Implementar compra de CMA inteiro, QR Code, webhook assinado e reconciliação.
4. Manter CMA não sacável e impedir conversão reversa.
5. Não oferecer saque Pix no primeiro lançamento.

## O que o proprietário pode preparar

- manter a segunda conta exclusivamente para ensaio;
- anotar os problemas encontrados seguindo o roteiro acima;
- decidir o nome e o domínio definitivos, sem necessidade de comprar agora;
- criar a conta do Resend quando o domínio estiver decidido;
- não enviar segredos por chat nem salvar chaves privadas no projeto;
- não contratar provedor de depósito antes de confirmar que ele aceita o modelo
  global pretendido e oferece sandbox, webhooks assinados e conta comercial.

## Próximo ponto de retomada

Sem comprar o domínio ainda, concluir primeiro a fatura mínima da conta
fundadora, a reconciliação da tesouraria e a compra inteira de CMA. Depois,
avançar na fila operacional e no Turnstile dos minigames. Depósitos continuam
atrás do portão exclusivo do fundador e saques permanecem desligados.
