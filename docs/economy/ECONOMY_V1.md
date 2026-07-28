# Crypto Miner Arcadia — economia inicial v4

## Escopo

Esta versão continua sendo uma simulação virtual. CMA, BTC e DOGE exibidos no
jogo não possuem saque, depósito nem promessa de conversão. A unidade contábil
interna da CMA não aparece na interface do jogador.

## Multi-mineração e blocos

- CMA, Bitcoin e Dogecoin fecham blocos simulados a cada 10 minutos: 144 blocos
  por dia.
- O jogador distribui o próprio poder em percentuais inteiros entre as três
  pools.
- A distribuição só pode ser aplicada quando a soma fecha exatamente 100%.
- Cada pool calcula sua recompensa de forma independente:

```text
poder_alocado = poder_total_do_jogador × percentual_da_pool
participação = poder_alocado / poder_ativo_dos_jogadores_na_pool
recompensa_pessoal = bloco_fixo × participação
```

- O valor total do bloco não depende do poder instalado por um jogador.
- O orçamento-base inicial é 0,005 CMA, 5 satoshis e 0,01 DOGE por bloco.
- O teto de rede em 24 horas é, respectivamente, 0,72 CMA, 720 satoshis e
  1,44 DOGE.
- Se um jogador estiver sozinho em uma pool, recebe o bloco fixo inteiro;
  aumentar apenas o próprio poder não aumenta seu pagamento.
- Com vários jogadores, o poder altera somente a porcentagem disputada. A soma
  distribuída nunca ultrapassa o valor fixo do bloco.
- O proprietário pode ajustar os três orçamentos dentro de faixas limitadas e
  auditadas: 0,001–0,05 CMA, 1–100 satoshis e 0,001–0,1 DOGE.
- Eventos temporários permitem 125%, 150% ou 200% do bloco-base por até 24
  horas. O vencimento é automático e o evento pode ser encerrado antes.
- Poderes-base antigos permanecem apenas como dado legado de teste e não entram
  no cálculo da recompensa.
- A estimativa é informativa, nunca um retorno garantido. Poder de rede,
  recompensa e orçamento diário poderão ser rebalanceados.

## Catálogo recalibrado

Os preços foram reduzidos tomando como referência as capturas fornecidas de
jogos semelhantes. Eles continuam sendo preços de progressão virtual, sem
promessa de prazo de retorno: o resultado depende da participação do jogador
na rede viva e do orçamento fixo vigente.

| Minerador | Fans | Slots | Poder | Preço |
|---|---:|---:|---:|---:|
| Byte Spark | 1 | 1 | 100 GH/s | 0,60 CMA |
| Amber Core | 1 | 1 | 260 GH/s | 1,50 CMA |
| Dual Nova | 2 | 2 | 1.250 GH/s | 7,20 CMA |
| Cryo Twin | 2 | 2 | 2.800 GH/s | 16 CMA |
| Violet Bit | 1 | 1 | 4.500 GH/s | 26 CMA |
| Magenta Flux | 2 | 2 | 6.200 GH/s | 35 CMA |
| Helix Gold | 2 | 2 | 14.500 GH/s | 84 CMA |

## Fontes e sumidouros

Fontes previstas:

- recompensa de bloco;
- bônus de onboarding limitado;
- poder temporário de minigames;
- baterias de baixa frequência em minigames;
- eventos controlados.

Sumidouros atuais:

- rack básico: 0,35 CMA;
- segunda sala: 8 CMA;
- bateria de 12 horas: 0,05 CMA;
- mineradores;
- Caixas Arcadia de 0,90, 3,50 e 12 CMA.

Antes de ativar qualquer recompensa resgatável, o servidor deverá aplicar
orçamento diário de emissão, limites por conta, telemetria antifraude e
controle de reserva.

### Caixas Arcadia

As caixas são um sumidouro opcional de CMA virtual. Nenhuma delas devolve CMA,
BTC ou DOGE: o prêmio é sempre um item utilizável dentro do jogo.

| Caixa | Preço | Conteúdo possível |
|---|---:|---|
| Cache de Sinal | 0,90 CMA | baterias, rack básico, Byte Spark ou Amber Core |
| Cache de Rede | 3,50 CMA | baterias, racks, Amber Core, Dual Nova ou Violet Bit |
| Cache Quântico | 12 CMA | baterias, racks, Cryo Twin, Violet Bit, Magenta Flux ou Helix Gold |

- todas as probabilidades são exibidas antes da compra e fecham em 100%;
- o servidor produz o resultado com aleatoriedade segura e ignora qualquer
  resultado enviado pelo navegador;
- após nove aberturas sem item raro, a décima usa somente a faixa rara ou
  superior;
- a proteção é independente para cada tipo de caixa;
- saldo, capacidade do inventário e versão do estado são validados antes do
  débito;
- cada abertura é registrada no ledger para auditoria e rebalanceamento;
- preços e chances devem permanecer configuráveis antes do beta público.

## Autoridade e liquidação

- toda ação econômica é validada no servidor;
- compras usam identificadores idempotentes para não serem cobradas duas vezes;
- o estado possui versão para detectar concorrência entre sessões;
- blocos são liquidados pelo relógio do servidor, nunca pelo cronômetro visual;
- inventário, energia, salas, racks, mineradores, saldos e alocações ficam em
  armazenamento persistente por conta;
- cada ação gera uma entrada de auditoria;
- a importação do estado antigo do navegador acontece apenas na criação da
  conta e aplica limites de saldo, energia, baterias e equipamentos.

## Energia

- oito células de 12 horas;
- resgate gratuito de 12 horas a cada 12 horas;
- cada bateria adiciona mais 12 horas;
- máximo inicial de 96 horas;
- baterias podem ser compradas com CMA;
- o tour diário dos três minigames concede uma bateria por conta e por dia UTC;
- sem energia, mineradores deixam de produzir, mas permanecem instalados.

## Racks e posições

- cada sala possui 12 posições gratuitas e predeterminadas;
- o jogador compra apenas o rack, nunca o espaço da sala;
- racks comprados entram no inventário antes da instalação;
- cada rack básico possui quatro prateleiras e oito slots;
- mineradores de uma fan ocupam um slot;
- mineradores de duas fans ocupam dois slots contínuos da mesma prateleira.

## Minigames

Os três conceitos iniciais são Packet Catch, Hash Match e Circuit Rush.

Calibração do Packet Catch:

- partida de 30 segundos;
- doze moedas com valores entre 4 e 18 pontos;
- três vidas; cada moeda que toca o chão remove uma vida;
- a terceira moeda perdida encerra a partida sem recompensa;
- tocar uma bomba encerra a partida e zera pontos e poder;
- dez níveis: a queda acelera e a frequência de bombas cresce;
- poder calculado por pontuação e dificuldade, sem faixas publicadas na tela;
- máximo de 320 GH/s por vitória;
- limite de 8 partidas por hora e 24 por janela de 24 horas;
- recarga de 45 a 372 segundos conforme atividade e dificuldade.

Calibração do Hash Match:

- quatro pares no nível inicial e até oito nos níveis avançados;
- duração de 68 segundos no nível inicial e 39,2 segundos no nível máximo;
- máximo de 300 GH/s por vitória;
- jogadas extras reduzem o poder concedido;
- limite de 6 partidas por hora e 18 por janela de 24 horas;
- cartas e combinações ficam guardadas no servidor.

Calibração do Circuit Rush:

- sete pulsos no nível inicial e até treze nos níveis avançados;
- duração de 29 segundos no nível inicial e 18,2 segundos no nível máximo;
- dois bloqueios no início e até seis nos níveis mais altos;
- tocar um bloqueio encerra a corrida sem recompensa;
- máximo de 300 GH/s por vitória;
- limite de 6 partidas por hora e 18 por janela de 24 horas;
- ordem, tempo e cliques são conferidos pelo servidor.

Nos três jogos, o poder dura 6 horas e ainda depende de energia para participar
dos blocos. CMA continua desativada como prêmio. Uma bateria pode ser resgatada
ao encerrar ao menos uma partida em cada minigame no mesmo dia UTC. Recarga,
limites e dificuldade poderão ser reduzidos ou ampliados somente depois de medir
pontuação, abandono, bombas, excesso de jogadas, bloqueios e abuso.

Ao terminar uma partida, a interface mostra o envio da prova do computador para
o servidor. A animação não decide o resultado: pontuação, vidas, tempo e
recompensa continuam sendo recalculados no servidor.

### Orçamento global de poder temporário

- cada conta pode receber no máximo 5.000 GH/s de poder temporário por dia UTC;
- os três minigames compartilham o mesmo orçamento;
- o servidor reserva cada recompensa com controle de concorrência;
- se uma vitória ultrapassar o saldo restante, apenas a parcela disponível é
  concedida;
- pontuação, nível, liga e conquistas continuam avançando mesmo quando o
  orçamento diário já foi consumido;
- o painel do Arcade mostra uso, saldo restante e horário de reinício;
- esse teto limita inflação de poder sem criar CMA ou baterias.

## Progressão do operador e telemetria

- cada partida concede 18 XP de atividade;
- cada vitória adiciona 120 XP;
- a experiência necessária cresce a cada nível;
- a liga competitiva possui doze divisões entre Recruta e Diamante;
- conquistas de carreira registram marcos sem criar recompensa econômica;
- nível, taxa de vitória, sequência e missões são calculados a partir dos
  registros autoritativos do servidor;
- as missões continuam medindo comportamento por ciclo UTC;
- o Tour do Arcade é a primeira missão com prêmio econômico controlado:
  uma bateria por conta e por dia, sem CMA;
- o servidor exige os três jogos encerrados, registra o resgate no ledger e
  impede crédito duplicado mesmo com chamadas concorrentes;
- novas recompensas só poderão ser ativadas depois de medir o impacto desta
  primeira missão sobre retenção, estoque de energia e abuso.

## Controle administrativo

- a Central do Proprietário é protegida no servidor e não confia em um botão
  escondido no navegador;
- a primeira conta autenticada que acessa o painel no site privado torna-se o
  proprietário registrado;
- outras contas recebem acesso negado, mesmo que conheçam o endereço do painel;
- Caixas Arcadia, poder temporário e bateria diária possuem chaves de pausa
  independentes;
- pausar uma fonte impede novas emissões, mas preserva saldos, inventário,
  partidas e itens já concedidos;
- partidas com risco ficam em uma fila separada e recebem uma resolução
  auditável, sem apagar a sessão original;
- métricas de 24 horas mostram fontes, sumidouros, emissão e concentração de
  equipamentos;
- toda alteração administrativa fica registrada com autor, horário e
  parâmetros;
- um único controle de teste pode completar somente a carteira do proprietário
  até 10.000 CMA virtuais; ele não altera contas de jogadores, não acumula
  créditos repetidos e registra o delta no ledger e na auditoria;
- o orçamento fixo e cada evento temporário são configurados no servidor,
  limitados por faixas seguras e registrados na auditoria;
- a carteira de teste do proprietário pode ser completada até 10.000 CMA sem
  alterar a recompensa de bloco dos demais jogadores.

### Histórico e retenção

- a tela pessoal consulta somente os últimos 30 dias e entrega no máximo 80
  itens recentes;
- cada fechamento mostra separadamente quanto entrou em CMA, BTC e DOGE;
- o ledger econômico é preservado como trilha completa de auditoria, com
  consultas indexadas e limitadas, em vez de ser carregado inteiro;
- comprovantes volumosos de partidas podem ser compactados depois de 30 dias em
  uma rotina futura, mas compras, créditos e débitos não devem ser apagados.

### Alertas, relatório e laboratório

- emissão de poder, revisões abertas, caixas em 24 horas e concentração de
  mineradores possuem limites independentes;
- alcançar um limite gera atenção e superar 125% do limite gera estado crítico;
- alertas não pausam o jogo automaticamente; a decisão continua sendo do
  proprietário;
- o relatório da temporada reúne 30 dias de minigames, ledger, inventário e
  antifraude em CSV;
- a exportação exige a mesma autorização exclusiva da Central do Proprietário;
- o simulador aceita percentuais de preço de mineradores, preço de caixas,
  dificuldade da rede e poder dos minigames;
- o simulador de catálogo permanece isolado da emissão real; antes do beta
  público ele deverá usar dados observados de participação e retenção;
- nenhuma simulação grava configurações, altera preços ou modifica o estado de
  uma conta;
- projeções internas não podem ser apresentadas ao jogador como ROI, promessa
  financeira ou garantia de retorno.

## Referências analisadas

- RollerCoin, Multi Mining:
  https://rollercoin.com/how-it-works/multi-mining
- RollerCoin, Multi-mining release:
  https://rollercoin.com/blog/multi-mining-has-been-released
- RollerCoin, Mining Power:
  https://rollercoin.com/blog/rolleracademy-2-0-mining-power
- RollerCoin, Energy Batteries:
  https://rollercoin.com/blog/dev-diaries-part-7
- RollerCoin, Economics Update:
  https://rollercoin.com/blog/rollercoin-universes-economics-update-doge-withdrawals-consensus-balancing-and-new-algorithms
- RollerCoin, Game Cooldown:
  https://faq.rollercoin.com/rollercoin/f.a.q./games/5.-why-do-games-take-so-much-time-to-load
- Capturas de preço e interface fornecidas pelo proprietário do projeto.
