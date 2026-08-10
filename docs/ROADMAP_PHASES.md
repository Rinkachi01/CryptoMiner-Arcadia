# Crypto Miner Arcadia — roadmap por fases

Este roadmap reorganiza os documentos do projeto em entregas pequenas,
verificáveis e com menor risco econômico.

## Fase 0 — regras do produto e economia

Status: concluída.

- três pools iniciais: CMA, Bitcoin e Dogecoin;
- blocos simulados de 10 minutos;
- economia virtual sem saque ou depósito;
- racks com oito slots e salas com 12 posições gratuitas;
- energia em ciclos de 12 horas;
- sem pacotes, passe de batalha ou marketplace nesta etapa.

Critério de saída: regras centrais documentadas e testáveis.

## Fase 1 — fundação jogável local

Status: concluída.

- sala principal, inventário e loja;
- compra e instalação de rack;
- instalação, remoção e troca de mineradores;
- mineradores de uma e duas fans respeitando um ou dois slots;
- energia por baterias, loja e Arcade, além da segunda sala;
- estado persistido no navegador.

Critério de saída: fluxo completo de comprar, instalar, energizar e minerar.

## Fase 2 — multi-mineração e clareza de interface

Status: concluída nesta atualização.

- poder dividido em percentuais entre CMA, BTC e DOGE;
- validação obrigatória de 100%;
- cálculo independente por pool;
- carteira com moeda favorita fixável no topo;
- painel compacto de mineração e próximo bloco no canto;
- preços recalibrados e textos essenciais maiores;
- mineradores alinhados às prateleiras dos racks;
- gerenciamento do rack em tela interna, sem modal ou sobreposição escura;
- conceito visual dos três minigames.

Critério de saída: distribuição, saldo e status compreensíveis sem depender de
explicações externas.

## Fase 3 — servidor autoritativo

Status: concluída nesta atualização.

- entrada e saída com conta ChatGPT;
- inventário, energia, compras e alocações salvos no servidor;
- ledger imutável para todo crédito e débito;
- fechamento de blocos no servidor;
- idempotência para impedir recompensa ou compra duplicada;
- importação de inventário local desativada para novas contas;
- versão de estado para detectar sessões desatualizadas;
- trilha de auditoria por conta.

Critério de saída: o navegador deixa de ser a fonte da verdade.

## Fase 4 — minigames

Status: sétima entrega concluída.

Ordem de execução:

1. Packet Catch;
2. Hash Match;
3. Circuit Rush.

Cada jogo passa por três portões:

- diversão e dificuldade testadas sem recompensa;
- sessão assinada e pontuação validada no servidor;
- poder temporário com limite diário.

Baterias e fragmentos de CMA entram apenas depois de medir abuso, retenção e
emissão por jogador.

Critério de saída: nenhuma pontuação ou prêmio pode ser criado apenas pelo
cliente.

Entregas concluídas no Packet Catch:

- doze moedas do acervo visual, cada uma com pontuação própria;
- bomba fatal que encerra a partida sem pontos ou poder;
- dez níveis de dificuldade com queda mais rápida e mais bombas;
- sessão de partida criada e encerrada pelo servidor;
- nonce de uso único e prazo curto;
- pontuação validada com regras reproduzíveis;
- recarga crescente conforme nível e vitórias recentes;
- limite adicional por hora e por janela de 24 horas;
- poder temporário salvo com início e expiração;
- marcação de partidas suspeitas para revisão;
- recompensas de bateria e CMA continuam desativadas nessa primeira entrega.

Entregas concluídas no Hash Match:

- jogo da memória usando as mesmas doze moedas;
- cartas reveladas individualmente pelo servidor;
- quatro a oito pares conforme o nível;
- menos tempo nos níveis mais altos;
- recompensa reduzida quando o jogador usa jogadas extras;
- recarga e progresso independentes do Packet Catch.

Entregas concluídas no Circuit Rush:

- tabuleiro de reação com dez níveis;
- sete a treze pulsos conforme a dificuldade;
- bloqueios vermelhos que encerram a corrida sem recompensa;
- tempo menor e mais bloqueios nos níveis altos;
- sequência, velocidade e resultado validados no servidor;
- recarga e progresso independentes dos outros minigames.

Entregas de telemetria concluídas:

- painel pessoal com tentativas, vitórias, sequência e taxa de vitória;
- nível global do operador calculado no servidor;
- missões de telemetria de 24 horas sem recompensa econômica;
- sessões suspeitas permanecem marcadas para revisão;
- sincronização de blocos protegida contra chamadas simultâneas.
- tour diário que exige uma partida encerrada em cada minigame;
- resgate de uma bateria por conta e por dia UTC;
- recompensa validada no servidor, idempotente e registrada no ledger;
- CMA permanece desativada como prêmio de missão.

Próxima atualização:

- painel administrativo de revisão com acesso exclusivo do proprietário;
- ajustes de recompensa com base nos dados acumulados;
- nível do computador para ampliar a duração do poder temporário, somente
  depois de confirmar que a progressão não cria emissão excessiva.

## Fase 4.5 — conta externa

Status: autenticação implementada e ambiente público em homologação.

- manter a entrada com ChatGPT durante o teste privado;
- escolher um provedor de identidade para cadastro público;
- cadastro, login, verificação de e-mail e recuperação de senha;
- sessões seguras, limitação de tentativas e proteção contra contas múltiplas;
- identidade fundadora pública presa ao mesmo e-mail verificado;
- migração única do inventário e ledger privado após a criação da conta no
  Supabase, sempre a partir de uma cópia aprovada.

Critério de saída: o jogo funciona fora do ChatGPT sem armazenar senhas de forma
improvisada.

## Fase 5 — beta econômico

Status: quinta entrega concluída.

- nível do operador e progressão por experiência;
- liga do operador com doze divisões, de Recruta a Diamante;
- conquistas permanentes de carreira calculadas pelo servidor;
- missão diária controlada com uma bateria após jogar os três minigames;
- limite de um resgate por conta e por ciclo UTC;
- resgate concorrente protegido por versão de estado e chave idempotente;
- painel de desempenho separado por minigame;
- dados de vitórias, tentativas, sequência e taxa de conclusão;
- proteção visual para que uma falha isolada nunca apague a interface inteira;
- orçamento global de 5.000 GH/s temporários por conta e dia;
- reserva concorrente de emissão para impedir que partidas simultâneas
  ultrapassem o orçamento;
- painel de saúde econômica com uso, saldo restante e reinício do ciclo;
- recompensas de liga e fragmentos de CMA continuam futuras;
- dificuldade dinâmica e orçamento de emissão;
- limites por conta, dispositivo e comportamento;
- telemetria de fontes, sumidouros, concentração e tempo de progressão;
- testes controlados de preço, recompensa e onboarding;
- alertas de inflação e fraude.

Entregas concluídas nesta quinta etapa:

- Caixas Arcadia em três faixas de preço: 0,90, 3,50 e 12 CMA;
- compra, sorteio e crédito do item processados pelo servidor;
- probabilidades públicas que totalizam exatamente 100% em cada caixa;
- proteção de azar que garante item raro ou superior na décima abertura;
- prêmios limitados a baterias, racks e mineradores, sem devolver CMA;
- cada compra registrada no ledger com chave idempotente;
- Packet Catch com três vidas e perda de uma vida quando uma moeda toca o chão;
- bomba continua encerrando a partida imediatamente e sem recompensa;
- transmissão visual do resultado entre o computador e o servidor;
- Hash Match com revelação e comparação de cartas mais rápidas;
- animações dos minigames isoladas para reduzir travamentos.

Entregas concluídas nesta sexta etapa:

- Central do Proprietário protegida pela conta autenticada;
- proprietário do site privado preservado e identidade fundadora pública
  configurada no servidor; um banco vazio não permite que o primeiro visitante
  reivindique o painel;
- métricas de jogadores, partidas, vitórias, poder, caixas e baterias em 24h;
- desempenho individual dos três minigames;
- concentração de mineradores, racks instalados e estoque de baterias;
- fila de partidas suspeitas com resolução liberada ou confirmada;
- observações e decisões mantidas em histórico administrativo;
- controles reversíveis para pausar Caixas Arcadia, poder temporário dos
  minigames e bateria diária;
- toda mudança de controle registrada em trilha de auditoria;
- pausas não removem inventário, saldo ou progresso já existente.

Entregas concluídas nesta sétima etapa:

- quatro alertas automáticos para emissão de poder, fila antifraude, volume de
  caixas e concentração de mineradores;
- limites ajustáveis pelo proprietário e persistidos no servidor;
- faixas estável, atenção e crítica calculadas sem pausar o jogo
  automaticamente;
- relatório CSV protegido com controles, minigames, movimento CMA, inventário e
  revisões dos últimos 30 dias;
- simulador de preços, dificuldade da rede e poder temporário;
- projeção de progressão virtual, orçamento diário e índice de sumidouro;
- comparação de preços projetados para mineradores e Caixas Arcadia;
- laboratório isolado que nunca aplica o cenário simulado ao estado real;
- aviso explícito de que a projeção não representa retorno financeiro.

Próxima entrega:

- painel de temporadas com data de início, encerramento e metas;
- snapshots econômicos para comparar períodos sem alterar o histórico;
- ranking competitivo sem prêmio financeiro;
- teste fechado dos controles administrativos e da economia completa.

Entregas concluídas na oitava e nona etapas:

- painel de temporadas com início, encerramento e metas operacionais;
- snapshots econômicos preservados para comparação entre ciclos;
- ranking competitivo calculado pelo servidor e sem prêmio financeiro;
- três escalas de leitura compartilhadas entre o jogo e o painel do proprietário;
- Arcade reorganizado para abrir diretamente na lista de minigames;
- Central do Operador separada em visão geral, temporada, missões e histórico;
- histórico pessoal de 30 dias com mineração, partidas, compras, energia e
  equipamentos;
- totais pessoais de CMA recebido e utilizado, poder temporário e desempenho do
  Arcade;
- linha do tempo filtrável construída a partir do ledger e das sessões
  autoritativas, sem permitir alterações pelo navegador.

Entregas concluídas na décima etapa:

- rede viva separada em poder dos jogadores e base simulada configurável;
- modo de teste que zera somente a base artificial das três redes;
- piso econômico independente que preserva a progressão virtual conservadora
  quando o poder vivo ainda é baixo;
- crédito exclusivo do proprietário que completa a carteira até 10.000 CMA,
  com lançamento no ledger e auditoria administrativa;
- restauração reversível das bases CMA, BTC e DOGE;
- histórico de blocos com os valores exatos recebidos em CMA, BTC e DOGE;
- consulta pessoal limitada aos últimos 30 dias e a 80 itens, sem carregar o
  ledger econômico completo no navegador;
- guia de entrada com rack, minerador, Tour do Arcade, energia, pools e
  primeiro bloco;
- avisos pessoais derivados do servidor sobre energia, missão e próximo bloco;
- painel lateral de orientação sem sobreposição escura sobre a sala.

Entregas concluídas na décima primeira etapa:

- recompensa total predeterminada para cada bloco CMA, BTC e DOGE;
- divisão proporcional somente pelo poder ativo dos jogadores na pool;
- orçamento inicial reduzido, com teto diário de rede previsível;
- painel do jogador separando bloco fixo e participação pessoal estimada;
- controles exclusivos do proprietário para alterar os três valores dentro de
  faixas seguras;
- eventos auditados de 125%, 150% e 200%, com duração limitada e encerramento
  automático;
- liquidações registrando o valor do bloco, o bônus e o poder da rede usado no
  cálculo;
- plano de monetização separado da economia, sem anúncios recompensando moedas
  ou poder nesta fase.

Entregas concluídas na décima segunda etapa:

- Central de Tarefas adicionada como área própria na navegação principal;
- separação visual entre missões internas, pesquisas futuras, instruções e
  feedback do beta;
- nenhuma pesquisa, anúncio de terceiros ou promessa de recompensa fictícia
  ativada;
- Tour do Arcade e feedback conectados a ações reais do jogo;
- feedback estruturado por categoria, nota e comentário, salvo por conta no
  servidor;
- limite entre envios repetidos e histórico pessoal recente;
- resumo de nota e respostas recentes disponível somente na Central do
  Proprietário;
- energia movida para o início do painel operacional da sala;
- atividade recente decorativa removida da sala de mineração;
- cartão de poder instalado reorganizado para impedir números cortados em
  resoluções estreitas e escalas maiores de leitura.

Entregas concluídas na décima terceira etapa:

- complexo ampliado para seis salas permanentes;
- Oficina Neon preservada como sala inicial gratuita;
- cinco Laboratórios Noturnos numerados, usando a identidade visual do segundo
  cenário;
- preços progressivos de 20, 50, 100, 200 e 400 CMA;
- compra sequencial e autoritativa, sem possibilidade de pular uma sala;
- confirmação mostra preço e saldo restante antes do débito;
- cada laboratório mantém 12 posições gratuitas e um layout de racks
  independente;
- limite de equipamentos ampliado para comportar o complexo completo;
- histórico de compra identifica sala e preço real;
- painel do proprietário compara teto diário de cada pool com os créditos
  efetivamente processados nas últimas 24 horas;
- feedbacks do beta agora podem avançar entre recebido, em análise, planejado e
  resolvido, com cada alteração registrada na auditoria administrativa.

Entregas concluídas na décima quarta etapa:

- painel de beta observável com jogadores novos, ativos e retornando em sete
  dias;
- quatro coortes semanais separando entrada, retorno, uso do Arcade e uso de
  energia;
- comparação entre comportamento do primeiro dia e retorno nos dias 2–7,
  exibida como sinal observacional e não como relação causal;
- indicação explícita de amostra pequena até existirem ao menos cinco contas
  em cada grupo de comparação;
- preferência revogável por conta para pedir autorização futura ou manter
  tarefas parceiras desativadas;
- histórico append-only das mudanças de preferência, sem conectar provedor,
  anúncio ou compartilhamento externo;
- manutenção exclusiva do proprietário para compactar comprovantes detalhados
  de partidas normais encerradas há mais de 30 dias;
- confirmação em duas etapas, auditoria administrativa e preservação do
  resultado, recompensa, sessão resumida e ledger econômico;
- revisão de preços e recompensas adiada até o encerramento de uma temporada
  completa, evitando decisões com amostra insuficiente.

Próxima entrega segura:

- relatório comparativo da primeira temporada completa;
- funil do onboarding, da primeira energia até o primeiro bloco creditado;
- validação de acessibilidade por tarefa com usuários do beta;
- avaliação de provedor de pesquisas somente se consentimento, antifraude e
  estabilidade econômica estiverem comprovados.

Critério de saída: economia estável em uma temporada fechada.

## Ponto de retomada — próxima semana

Status: retomada concluída; jornada inicial e rede global preparadas para o
teste fechado ampliado.

Entregas concluídas na retomada:

- teste automatizado do percurso completo do kit ao primeiro bloco;
- passagem direta da bateria conquistada para a ativação da sala;
- identidade do Arcadia centralizada, mantendo ChatGPT no beta privado e o
  mesmo vínculo de progresso para uma futura conta com e-mail verificado;
- tela de entrada informa claramente o estágio privado e a futura migração;
- índice incremental de poder por conta substitui a leitura limitada a 5.000
  estados completos;
- contas existentes entram no novo índice por lotes, sem resetar inventário,
  energia, pools ou saldos;
- potência instalada e temporária continuam contando somente enquanto a sala
  estiver energizada.

Entregas concluídas na etapa de validação da temporada:

- relatório econômico do ciclo disponível somente na Central do Proprietário;
- totais do período para jogadores, Arcade, poder temporário, baterias, caixas,
  CMA de blocos, sumidouros e créditos administrativos de teste;
- BTC e DOGE creditados exibidos separadamente a partir do ledger do servidor;
- cinco portões impedem recomendar rebalanceamento com temporada ativa, amostra
  pequena, pouca atividade, snapshots insuficientes ou revisão antifraude
  pendente;
- comparação automática entre o primeiro e o último snapshot preservado;
- relatório permanece somente informativo e nunca altera preço, recompensa ou
  valor de bloco;
- guia do primeiro dia em celular usa cartões horizontais, etapa atual marcada
  e ação principal com leitura ampliada.

Entregas concluídas na etapa de operações e integridade:

- Central de Operações exclusiva do proprietário, separada dos alertas
  econômicos;
- validação de estados persistidos, índice global de poder, sessões expiradas,
  resgates interrompidos e fila antifraude;
- checkpoints de integridade auditáveis para comparar diagnósticos ao longo do
  tempo, identificados claramente como fotografias e não como backups;
- simulação de quatro incidentes com gatilho, impacto e resposta segura, sem
  executar reparos ou alterar dados reais;
- nenhum saldo, preço, bloco ou recompensa é modificado pelo diagnóstico;
- histórico recente de checkpoints preservado no banco do servidor.

Entregas concluídas na etapa de recuperação e continuidade:

- armazenamento de recuperação separado do banco operacional;
- pacote completo e versionado com contas, inventários, ledger, partidas,
  energia, rede, temporadas e configurações administrativas;
- checksum SHA-256 calculado antes da gravação externa;
- limite explícito de 24 MB e limites por tabela para impedir exportações
  incompletas silenciosas;
- histórico persistente de cópias concluídas e falhas;
- download exclusivo e auditado para o proprietário;
- ensaio de restauração que relê a cópia externa e valida checksum, versão,
  tabelas essenciais, estados de conta, ledger e índice da rede;
- nenhuma conta é sobrescrita durante o ensaio;
- painel de prontidão reúne integridade, recuperação, temporada econômica,
  autenticação futura e validação com jogadores reais.

Decisões consolidadas:

- conta nova recebe somente um rack instalado e um Byte Spark no inventário;
- saldo inicial de CMA, BTC e DOGE é zero;
- bateria inicial e energia inicial são zero;
- recarga gratuita automática está desativada;
- o jogador precisa concluir o Tour do Arcade, resgatar a bateria diária e
  ativar a sala;
- as três pools compartilham o poder de todos os jogadores energizados;
- cada rede possui um único bloco global de dez minutos, fechado no servidor;
- o valor total do bloco é fixo e somente a participação proporcional muda;
- navegador não cria saldo, inventário, energia, poder ou recompensa.

Ordem recomendada das próximas entregas:

1. coletar uma temporada completa até os cinco portões ficarem verdes;
2. testar o onboarding em celulares reais com jogadores do beta;
3. ~~escolher a hospedagem e o provedor da autenticação pública;~~ concluído
   com Cloudflare Workers, D1, R2 e Supabase Auth;
4. ~~implementar cadastro, e-mail verificado, recuperação de senha e migração
   do progresso atual;~~ fluxo implementado, URLs externas autorizadas e conta
   fundadora migrada com 429 registros auditados;
5. criar a primeira cópia externa e executar o ensaio controlado na Central do
   Proprietário;
6. avaliar tarefas e publicidade somente com consentimento, antifraude e
   orçamento separado da recompensa dos blocos.

### Fase 5.5 — endurecimento do acesso público

Status: estrutura implementada; ativação do Turnstile aguarda a criação das
chaves pelo proprietário.

- cadastro, entrada e recuperação aceitam token Turnstile validado pelo
  próprio Supabase;
- o formulário falha fechado se a proteção for exigida sem chave pública;
- mutações da API vindas de outra origem são recusadas antes de alcançar a
  economia do jogo;
- respostas recebem proteção contra iframe, interpretação incorreta de tipo,
  vazamento excessivo de referência e acesso a câmera, microfone, localização,
  pagamento e USB;
- HTTPS recebe HSTS sem reivindicar os demais subdomínios de `workers.dev`;
- a prévia externa permanece fora da indexação dos buscadores até o domínio e
  o beta público serem aprovados.

Polimentos ainda recomendados:

- teste real de toque e leitura em celulares pequenos;
- validação visual final dos quatro níveis do rack em aparelhos reais;
- comparação do funil do primeiro dia por dispositivo e tamanho de tela;
- revisão jurídica antes de usar linguagem de investimento, ROI, saque ou
  rendimento.

Entrega de clareza do Arcade concluída:

- tutorial rápido sempre visível e adaptado ao Packet Catch, Hash Match e
  Circuit Rush;
- motivo explícito para bloqueios por recarga, limite da hora e limite de 24
  horas;
- contagem de recarga em minutos e segundos quando necessário;
- aviso uniforme de que o servidor valida o resultado antes de liberar poder.

Entrega visual da sala e dos racks concluída:

- faixa de acesso rápido aos racks em telas pequenas, sem depender de acertar a
  sprite dentro da sala;
- miniatura de cada rack preservando o mesmo mapa proporcional de oito slots;
- catálogo, mapa de slots e botões do gerenciador reorganizados para toque e
  leitura em celulares;
- sprites dos mineradores renderizadas de forma consistente na sala, na faixa
  móvel e na prévia do gerenciador.

## Laboratório do Beta — dispositivo e acessibilidade

Status: implementado para o beta privado.

- perfil técnico mínimo por conta, limitado a tela pequena, média ou grande,
  controle por toque, ponteiro ou híbrido e escala de texto escolhida;
- nenhuma coleta de IP, localização, modelo do aparelho, impressão digital ou
  rastreador de terceiros;
- funil do primeiro dia separado por tamanho de tela e forma de controle na
  Central do Proprietário;
- cobertura dos perfis exibida para impedir conclusões com dados incompletos;
- teste voluntário de leitura, controles, movimento e montagem dos racks;
- observação opcional limitada a 500 caracteres e uma resposta atualizável por
  conta a cada dia;
- respostas do teste não entregam CMA, BTC, DOGE, energia, bateria ou poder;
- painel agregado de aprovação dos quatro critérios nos últimos 30 dias;
- tabelas do laboratório incluídas na cópia externa de recuperação.

Critério de saída: testar com jogadores reais em celulares e computadores,
investigar as etapas com maior abandono e corrigir problemas confirmados antes
de ampliar o beta.

## Fase 6 — recursos financeiros reais

Status: bloqueada até decisão formal.

- análise jurídica e tributária;
- política de KYC/AML quando aplicável;
- custódia, reservas, limites e segurança;
- termos de uso e comunicação de risco;
- auditoria independente;
- decisão explícita de ativar ou não depósitos e saques.

Critério de saída: aprovação jurídica, operacional e financeira. Nenhuma
promessa de ROI deve aparecer antes disso.
