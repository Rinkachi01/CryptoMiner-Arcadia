# Crypto Miner Arcadia — economia inicial v1

## Escopo

Esta versão é uma simulação virtual. CMA, BTC e DOGE exibidos no jogo não
possuem saque, depósito ou garantia de conversão. A relação `1 CMA = US$ 1` é
uma unidade contábil interna para precificação e não uma promessa de resgate.

## Decisões da primeira calibração

- Todas as pools fecham blocos a cada 10 minutos: 144 blocos por dia.
- O jogador aloca 100% do poder em uma única pool.
- Recompensa individual:

```text
recompensa = recompensa_do_bloco × poder_do_jogador / poder_total_da_pool
```

- CMA inicia com recompensa de 8 CMA por bloco e rede simulada de
  15.000.000 GH/s.
- O preço por TH melhora gradualmente nos equipamentos avançados. O ganho não é
  linear porque equipamentos maiores também economizam espaço de rack.
- A faixa de retorno virtual de teste dos equipamentos fica aproximadamente
  entre 250 e 370 dias no estado inicial da rede. Isso não é ROI financeiro:
  dificuldade, recompensa, reserva e poder global podem mudar.

## Catálogo inicial

| Minerador | Fans | Slots | Poder | Preço |
|---|---:|---:|---:|---:|
| Byte Spark | 1 | 1 | 100 GH/s | 3 CMA |
| Amber Core | 1 | 1 | 260 GH/s | 7,5 CMA |
| Violet Bit | 1 | 1 | 620 GH/s | 16 CMA |
| Dual Nova | 2 | 2 | 1.250 GH/s | 30 CMA |
| Cryo Twin | 2 | 2 | 2.800 GH/s | 62 CMA |
| Magenta Flux | 2 | 2 | 6.200 GH/s | 128 CMA |
| Helix Gold | 2 | 2 | 14.500 GH/s | 280 CMA |

## Fontes e sumidouros

Fontes iniciais:

- recompensa de bloco;
- bônus de onboarding;
- poder temporário de minigames;
- eventos controlados.

Sumidouros iniciais:

- racks: 5 CMA;
- segunda sala: 20 CMA;
- baterias: 0,5 CMA;
- mineradores.

Antes de qualquer recompensa resgatável, o servidor deverá limitar a emissão
por um orçamento diário de reserva. Se o poder da rede crescer, a recompensa
individual cai automaticamente. A administração deve monitorar emissão,
compras, concentração de poder, saldo mediano e tempo de progressão.

## Energia

- quatro células de 24 horas;
- cada bateria recarrega uma célula;
- máximo inicial de 96 horas;
- baterias podem ser compradas com CMA;
- minigames poderão conceder baterias posteriormente;
- sem energia, mineradores deixam de produzir, mas permanecem instalados.

## Minigames

O poder de minigames deve ser temporário, ter limite diário e validação no
servidor. Jogos mais fáceis ou mais explorados recebem menos poder. Baterias
podem ser uma recompensa de baixa frequência, sem substituir a principal
utilidade do CMA.

## Referências analisadas

- RollerCoin, Mining Basics:
  https://rollercoin.com/how-it-works/basics
- RollerCoin, Mining Power:
  https://rollercoin.com/blog/rolleracademy-2-0-mining-power
- RollerCoin, Electricity Update:
  https://rollercoin.com/blog/electricity-update
- RollerCoin, Economics Update:
  https://rollercoin.com/blog/rollercoin-universes-economics-update-doge-withdrawals-consensus-balancing-and-new-algorithms
- RollerCoin, Inventory Update:
  https://rollercoin.com/blog/new-game-inventory-upgrade
- Blocklooter:
  https://www.blocklooter.com/
- GDC, Economic Balancing Through Sink Design:
  https://www.gdcvault.com/play/1020524/Economic-Balancing-and-Improved-Monetization

