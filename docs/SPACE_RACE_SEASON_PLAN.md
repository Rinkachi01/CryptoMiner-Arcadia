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

O rastreamento de links já está ativo, mas o pagamento permanece em fase de
validação. O modelo proposto concede 2% das compras elegíveis em CMA, com teto
de 2 CMA por semana, espera antifraude de 14 dias e janela de 60 dias por
indicado. O bônus nunca é retirado do que o jogador minerou e não incide sobre
BTC, DOGE ou LTC.
