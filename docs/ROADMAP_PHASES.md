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

Status: primeira entrega concluída.

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

- primeira versão jogável do Packet Catch;
- sessão de partida criada e encerrada pelo servidor;
- nonce de uso único e prazo curto;
- pontuação validada com regras reproduzíveis;
- limite de cinco partidas por hora e quinze em 24 horas;
- poder temporário salvo com início e expiração;
- marcação de partidas suspeitas para revisão;
- recompensas de bateria e CMA continuam desativadas nessa primeira entrega.

Próxima atualização:

- telemetria de dificuldade, abandono e pontuação do Packet Catch;
- painel administrativo de revisão;
- ajustes de recompensa com base nos dados reais;
- primeira versão jogável do Hash Match;
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

Status: futura.

- missões diárias e progressão de liga;
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
