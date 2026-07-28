# Crypto Miner Arcadia — economia inicial v3

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
recompensa = recompensa_do_bloco × poder_alocado / poder_total_da_pool
```

- A CMA inicia com 8 CMA por bloco e rede simulada de 60.000.000 GH/s.
- A estimativa é informativa, nunca um retorno garantido. Poder de rede,
  recompensa e orçamento diário poderão ser rebalanceados.

## Catálogo recalibrado

Os preços foram reduzidos tomando como referência as capturas fornecidas de
jogos semelhantes. A dificuldade da rede CMA foi ajustada em conjunto para
manter uma progressão virtual conservadora, próxima de 294 a 313 dias no
estado inicial da rede.

| Minerador | Fans | Slots | Poder | Preço |
|---|---:|---:|---:|---:|
| Byte Spark | 1 | 1 | 100 GH/s | 0,60 CMA |
| Amber Core | 1 | 1 | 260 GH/s | 1,50 CMA |
| Violet Bit | 1 | 1 | 620 GH/s | 3,60 CMA |
| Dual Nova | 2 | 2 | 1.250 GH/s | 7,20 CMA |
| Cryo Twin | 2 | 2 | 2.800 GH/s | 16 CMA |
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
- mineradores.

Antes de ativar qualquer recompensa resgatável, o servidor deverá aplicar
orçamento diário de emissão, limites por conta, telemetria antifraude e
controle de reserva.

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
- minigames poderão conceder baterias posteriormente;
- sem energia, mineradores deixam de produzir, mas permanecem instalados.

## Racks e posições

- cada sala possui 12 posições gratuitas e predeterminadas;
- o jogador compra apenas o rack, nunca o espaço da sala;
- racks comprados entram no inventário antes da instalação;
- cada rack básico possui quatro prateleiras e oito slots;
- mineradores de uma fan ocupam um slot;
- mineradores de duas fans ocupam dois slots contínuos da mesma prateleira.

## Minigames

Os três conceitos iniciais são Packet Catch, Hash Match e Circuit Rush. Primeiro
serão testados sem recompensa. Depois receberão sessões assinadas, pontuação
validada no servidor, limite diário e poder temporário. Baterias e fragmentos de
CMA só serão ativados com teto de emissão.

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
- Capturas de preço e interface fornecidas pelo proprietário do projeto.
