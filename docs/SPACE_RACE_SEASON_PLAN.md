# Temporada 01 — Corrida Espacial

## Decisão de produto

A primeira temporada temática terá **42 dias**, progressão gratuita e 30
marcos. Nesta versão não haverá passe pago. O objetivo é validar retenção,
missões, antifraude e impacto econômico antes de vender qualquer trilha de
progressão.

O sistema de temporada já existente continua sendo a fonte autoritativa para
início, fim, ranking, snapshots e relatório econômico. A Corrida Espacial será
uma evolução desse sistema, sem relógios ou recompensas decididos pelo
navegador.

## Experiência do jogador

- mapa de 30 marcos dividido em Terra, Órbita, Lua, Marte e Espaço Profundo;
- XP ganho por login, conclusão dos quatro minigames, missões diárias e
  instalação de equipamentos;
- três missões diárias e três semanais, todas com limite no servidor;
- página enxuta com missão atual, próximo prêmio e botão para abrir o mapa;
- ranking separado da trilha de prêmios, para jogadores casuais não perderem
  toda a progressão;
- encerramento com animação de transmissão dos resultados ao servidor.

## Recompensas seguras

1. cosméticos de perfil, rack e sala;
2. caixas sazonais com probabilidades públicas e proteção de azar;
3. baterias em poucos marcos, dentro do orçamento da temporada;
4. mineradores da Corrida Espacial fornecidos pelo proprietário, cadastrados
   somente após simulação de poder, preço e ocupação de slots;
5. nenhum prêmio direto em BTC, DOGE ou LTC e nenhum aumento automático no
   valor fixo dos blocos.

Os mineradores recebidos do proprietário precisarão de: nome, sprite/GIF,
quantidade de fans, slots, raridade e proposta de poder. O preço será calculado
depois da comparação com Byte Spark, Violet Bit e Helix Gold.

## Fases de implementação

### Fase A — dados e painel

- tabelas de níveis, missões, progresso e resgates idempotentes;
- editor do proprietário para datas, XP, recompensas e limites;
- estado `draft`, `scheduled`, `active`, `closed` e `archived`;
- prévia completa antes da publicação.

### Fase B — experiência pública

- mapa espacial responsivo;
- missões diárias/semanais e resgate individual;
- animações leves com opção de reduzir movimento;
- contador de temporada baseado no relógio do servidor.

### Fase C — economia e antifraude

- orçamento máximo de energia e poder por dia;
- detecção de resgates repetidos e sessões automatizadas;
- snapshots semanais de emissão, gasto de CMA e retenção;
- encerramento automático e relatório final antes de qualquer rebalanceamento.

## Monetização compatível

Ordem recomendada depois da temporada gratuita:

1. skins de sala, rack, moldura e efeitos sem poder;
2. patrocínio visual identificado, fora da área dos minigames;
3. caixas sazonais opcionais em CMA, com chances públicas e limite de compra;
4. trilha premium apenas numa temporada posterior, sem BTC, DOGE, LTC ou
   promessa de retorno;
5. tarefas de parceiros somente após consentimento, revisão jurídica e
   controles contra bots.

Não usar anúncios para entregar criptomoeda ou recompensas sacáveis. A receita
da temporada deve vir de personalização e conveniência, não do aumento do bloco
ou de promessa de rentabilidade.

## Critérios para publicar

- todos os resgates são idempotentes e auditados;
- emissão máxima da temporada cabe no orçamento definido pelo proprietário;
- experiência funciona em celular e com redução de movimento;
- probabilidades e limites estão visíveis antes de qualquer compra;
- fila antifraude, suporte e recuperação foram testados;
- relatório da temporada anterior não contém alertas críticos.
