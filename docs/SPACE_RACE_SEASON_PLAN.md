# Temporada 01 — Corrida Espacial

## Estado de lançamento

A temporada está cadastrada como `draft` e permanece desativada. O fundador
inicia o ciclo manualmente na Central do Proprietário. A ativação encerra o
ciclo competitivo anterior, grava uma auditoria e inicia exatamente 120 dias no
relógio do servidor.

## Progressão

- 120 dias e 50 níveis;
- 12.250 XP para chegar ao nível 50;
- 50 XP no primeiro login de cada dia;
- 20 XP por minigame concluído, limitado a cinco partidas por dia;
- bônus de missão ao concluir três e cinco partidas no dia;
- bônus semanais ao concluir 10 e 15 partidas;
- 5 XP por CMA inteiro gasto na loja, limitado a 50 XP por dia.

Um jogador que entra diariamente e conclui em média três partidas por dia
chega muito perto do fim apenas com atividade. Os marcos semanais fornecem a
folga necessária para concluir os 50 níveis sem exigir todas as tarefas nem
gasto em CMA. Gastar ajuda a recuperar dias perdidos, mas não compra o ranking.

## Trilhas e economia

- trilha gratuita para todos os jogadores;
- trilha Premium opcional por 29 CMA;
- recompensas: oito mineradores sazonais, baterias e poder temporário de 1, 3
  ou 7 dias;
- mineradores sazonais não aparecem na loja e só entram no inventário por
  resgate idempotente;
- o poder permanente total foi limitado para não superar de forma desproporcional
  equipamentos equivalentes da loja;
- nenhum prêmio aumenta o valor fixo dos blocos ou credita BTC, DOGE ou LTC.

## Operação e segurança

Login diário, XP, compra Premium e cada resgate são validados no Worker e
persistidos no D1. O navegador apenas apresenta o resultado. Resgates usam
chaves únicas por conta, temporada, trilha e nível, impedindo duplicidade.
Todas as compras e prêmios deixam registro no livro-razão.

Antes de ativar:

1. validar a temporada em celular e desktop;
2. simular a emissão dos oito mineradores no painel econômico;
3. testar compra Premium e resgates em uma conta de homologação;
4. confirmar fila antifraude e backup do D1;
5. clicar em **Ativar Corrida Espacial** somente na data oficial.

## Indicações

O rastreamento de links e o crédito por bloco são validados no servidor. Após a
conta indicada completar a validação de segurança (24 horas e três partidas
concluídas), cada bloco validado gera um bônus adicional de 8% em CMA ou 5% em
BTC, DOGE e LTC para o indicador. O indicado mantém a recompensa integral do
próprio bloco; não há saldo acumulado nem teto de indicação. A emissão do bônus
é registrada separadamente no livro-razão para auditoria e deve ser monitorada
no painel econômico antes de campanhas públicas.
