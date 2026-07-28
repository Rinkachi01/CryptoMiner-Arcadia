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
- energia gratuita, baterias e segunda sala;
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
- migração local única, validada e limitada;
- versão de estado para detectar sessões desatualizadas;
- trilha de auditoria por conta.

Critério de saída: o navegador deixa de ser a fonte da verdade.

## Fase 4 — minigames

Status: terceira entrega concluída.

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

Próxima atualização:

- painel administrativo de revisão com acesso exclusivo do proprietário;
- ajustes de recompensa com base nos dados acumulados;
- nível do computador para ampliar a duração do poder temporário, somente
  depois de confirmar que a progressão não cria emissão excessiva.

## Fase 4.5 — conta externa

Status: futura; depende da decisão de onde o site público será hospedado.

- manter a entrada com ChatGPT durante o teste privado;
- escolher um provedor de identidade para cadastro público;
- cadastro, login, verificação de e-mail e recuperação de senha;
- sessões seguras, limitação de tentativas e proteção contra contas múltiplas;
- migração da conta de teste para a identidade pública sem perder o progresso.

Critério de saída: o jogo funciona fora do ChatGPT sem armazenar senhas de forma
improvisada.

## Fase 5 — beta econômico

Status: primeira entrega concluída.

- nível do operador e progressão por experiência;
- missões diárias de telemetria sem prêmio econômico;
- painel de desempenho separado por minigame;
- dados de vitórias, tentativas, sequência e taxa de conclusão;
- missões diárias e progressão de liga com recompensas continuam futuras;
- dificuldade dinâmica e orçamento de emissão;
- limites por conta, dispositivo e comportamento;
- telemetria de fontes, sumidouros, concentração e tempo de progressão;
- testes controlados de preço, recompensa e onboarding;
- alertas de inflação e fraude.

Critério de saída: economia estável em uma temporada fechada.

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
