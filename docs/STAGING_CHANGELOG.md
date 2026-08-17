# Arcadia — changelog do ambiente de testes

Este é o registro oficial das correções e melhorias feitas em **staging**.
Ele serve como fila de novidades: quando o proprietário pedir um anúncio, use
as entradas marcadas como `Pronto para anunciar` para montar as notas públicas.

## Regras do registro

- Registrar aqui somente alterações que foram testadas no ambiente de testes.
- Não anunciar uma mudança enquanto ela não tiver validação e link da versão
  de staging.
- Manter detalhes internos de segurança, credenciais, IDs de contas e dados
  pessoais fora das notas públicas.
- Uma publicação em produção só entra neste arquivo depois de ser aprovada
  pelo proprietário.

## Entrada 001 — Persistência das distribuições de pools

- **Data:** 2026-08-16
- **Área:** Pools / distribuição de poder
- **Problema:** a distribuição podia voltar para 100% CMA depois de recarregar a
  página; contas antigas também podiam guardar a alocação em um formato de três
  pools.
- **Correção:** o servidor agora normaliza e grava sempre o formato completo
  CMA/BTC/DOGE/LTC, migra o formato antigo com LTC em 0, preserva a distribuição
  autoritativa e confirma a leitura no D1 depois de aplicar. A interface mostra
  quando há alterações locais, bloqueia envio duplicado e informa quando a
  distribuição está salva no servidor.
- **Validação:** `npm test` — 205 testes aprovados; `npm run lint` — sem erros.
- **Staging:** https://staging.cryptominerarcadia.com/pools
- **Versão:** `eb321afd-7963-4b70-9a8e-bd93730c8022`
- **Status:** Pronto para anunciar

## Entrada 002 — Primeiro feedback de minigames registrado

- **Data:** 2026-08-16
- **Área:** Minigames / experiência do jogador
- **Feedback:** “Gostei como é os minigames mas poderia ser mais um pouco intuitivo.”
- **Nota:** 4/5
- **Ação:** Registro incluído somente no banco de homologação, com etapa inicial `Recebido`, para acompanhar a análise e validar o fluxo de feedback antes de qualquer anúncio público.
- **Validação:** Registro confirmado no D1 de staging; nenhuma alteração foi feita no ambiente oficial.
- **Staging:** https://staging.cryptominerarcadia.com/tarefas
- **Status:** Em teste

## Entrada 003 — Correção do erro 1102 no carregamento autenticado

- **Data:** 2026-08-17
- **Área:** Estabilidade / navegação autenticada
- **Problema:** Algumas sessões, especialmente ao abrir o ranking, podiam receber `Worker exceeded resource limits` (Cloudflare 1102).
- **Correção:** A contagem de respostas não lidas deixou de executar criação de tabelas e índices durante cada renderização. O caminho crítico agora faz apenas uma consulta de leitura, com fallback seguro para bancos locais ainda não inicializados.
- **Validação:** Lint, teste de suporte e build aprovados; domínio oficial e homologação responderam normalmente (ranking anônimo redireciona para login, sem 1102).
- **Staging:** https://staging.cryptominerarcadia.com/ranking
- **Versões:** staging `8ea44da3-0542-4ccc-86a0-f424984304af`; oficial `2e4df1b2-55fa-42a3-8c88-8bc5903f0b3e`
- **Status:** Pronto para anunciar

## Entrada 004 — CRM enxuto, diretório com contexto e sala pública no ranking

- **Data:** 2026-08-17
- **Área:** Central do fundador / Ranking / Central de tarefas
- **Problema:** a busca de jogadores mostrava apenas contagens, o fundador não
  conseguia confirmar rapidamente a sala e a alocação de cada conta, o ranking
  não oferecia uma visão pública da sala principal e o CRM mantinha uma área de
  avaliação de leitura que não fazia parte da experiência final.
- **Correção:** o diretório agora mostra sala atual, sala principal, racks,
  mineradores e distribuição CMA/BTC/DOGE/LTC. O ranking passou a oferecer uma
  prévia segura da sala principal, sem saldo ou pools privados. Operações agora
  destacam saúde, alertas e checkpoints, deixando o runbook avançado recolhido.
  A avaliação de leitura foi retirada da Central de Tarefas; o controle de
  tamanho de texto permanece disponível. O histórico de snapshots ganhou uma
  explicação curta para evitar confusão sobre seus efeitos.
- **Validação:** `npm test` — 205 testes aprovados; `npm run lint` — sem erros
  (somente avisos preexistentes de hooks/imagens).
- **Staging:** https://staging.cryptominerarcadia.com/ranking
- **Versão:** `fc8bfccb-1c2a-48c1-bedc-3f6ffffa7e49`
- **Status:** Em teste

## Entrada 005 — Duração do poder alinhada ao nível do PC

- **Data:** 2026-08-17
- **Área:** Minigames / Progressão do PC / Economia
- **Problema:** a duração do poder temporário seguia uma escala irregular
  (níveis 4 e 5 duravam 5 e 7 dias), o que não correspondia à progressão
  apresentada ao jogador.
- **Correção:** cada recompensa validada mantém sua própria expiração e passa
  a usar a escala direta: N1 = 1 dia, N2 = 2, N3 = 3, N4 = 4 e N5 = 5 dias.
  O poder continua separado das baterias e vinculado à distribuição de pools.
- **Validação:** testes unitários cobrem a duração e a data de expiração de
  todos os cinco níveis.
- **Staging:** https://staging.cryptominerarcadia.com/minigames
- **Versão:** `ba5f9295-d817-47e1-b7b4-9e21f4702c4f`
- **Status:** Em teste

## Entrada 006 — Publicação oficial e evento de recompensa

- **Data:** 2026-08-17
- **Área:** Estabilidade / Minigames / Economia
- **Correção:** a duração do poder por nível do PC e os ajustes de estabilidade
  foram promovidos ao domínio oficial. O bônus de bloco de 200% foi agendado
  para hoje, das 14:00 às 15:00 (horário de Brasília), com encerramento
  automático.
- **Produção:** https://cryptominerarcadia.com/ — versão `c36ce26d-aff2-43e6-94c3-33d8694a049a`
- **Nota pública:** o anúncio não inclui informações do CRM, fundador ou
  tesouraria interna.
- **Status:** Publicado

### Rascunho de anúncio público

O texto de divulgação sem informações administrativas está salvo em
`docs/STAGING_PUBLIC_ANNOUNCEMENT.md` para publicação após a revisão final.

## Entrada 007 — Agendador de bônus por pool

- **Data:** 2026-08-17
- **Área:** Central do fundador / Economia / Recompensas
- **Problema:** eventos de bônus dependiam de uma solicitação manual e só
  permitiam aplicar o mesmo multiplicador a todas as moedas.
- **Correção:** a Central do fundador agora permite escolher CMA, BTC, DOGE e/ou
  LTC, definir 125%, 150% ou 200%, data/hora de início e duração de até sete
  dias. A agenda é validada no servidor, auditada e encerrada automaticamente;
  o valor-base dos blocos não muda.
- **Validação:** `npm test` — 205 testes aprovados; `npm run lint` — sem erros
  (somente avisos preexistentes); domínio oficial respondeu sem 1102.
- **Produção:** https://cryptominerarcadia.com/admin — versão
  `70aa802e-fa63-4ba4-b674-6b39c6a8add2`
- **Status:** Publicado

## Entrada 008 — Sala pública somente leitura no ranking

- **Data:** 2026-08-17
- **Área:** Ranking Global / Perfil público / Mobile
- **Problema:** o ranking permitia abrir apenas uma imagem estática da sala;
  não era possível conferir os racks e mineradores do operador sem entrar na
  conta dele.
- **Correção:** o nome do operador e o botão da sala agora abrem uma ficha
  pública somente leitura com a sala principal, racks, mineradores instalados,
  poder dos equipamentos, poder temporário do Arcade e estado da energia.
  Saldos, carteiras, pools, histórico e controles de edição continuam fora da
  resposta pública. A consulta é autenticada, exclui contas fundadoras e não
  altera o estado do operador.
- **Validação:** build, lint e 206 testes aprovados; rota pública rejeita
  sessão ausente, conta inválida e contas administrativas.
- **Staging:** https://staging.cryptominerarcadia.com/ranking
- **Versões:** staging `46712696-8fb7-435a-a73a-c42a6daa1884`; oficial
  `3cd41979-05ae-4a62-bbc7-284b6283653f`
- **Status:** Em teste

## Entrada 009 — Cena pública com racks e mineradores no cenário

- **Data:** 2026-08-17
- **Área:** Ranking Global / Perfil público / Performance
- **Problema:** a sala pública mostrava a arte do ambiente separada de uma lista
  de racks, o que dificultava entender rapidamente como os mineradores estavam
  organizados.
- **Correção:** a prévia agora compõe a mesma arte da sala com racks e sprites
  dos mineradores sobrepostos nas posições oficiais do layout. A lista de
  detalhes continua abaixo para acessibilidade, com carregamento assíncrono e
  sem alterar a resposta privada da conta.
- **Validação:** build, lint e 206 testes aprovados; a rota continua somente
  leitura, sem saldos, carteiras ou controles de edição.
- **Staging:** https://staging.cryptominerarcadia.com/ranking
- **Versões:** staging `61e1b793-35c8-4a77-8441-8f1c2f61a477`; oficial
  `a0f37f3e-c08b-4658-b9fe-a848a878330f`
- **Status:** Em teste

## Entrada 010 — CRM enxuto e localização antifraude

- **Data:** 2026-08-17
- **Área:** Central do fundador / Jogadores / Segurança
- **Problema:** o CRM exibia um painel extenso de telemetria de primeiro dia,
  enquanto a fila antifraude mostrava apenas uma identificação curta da sessão;
  localizar a conta correta exigia copiar o ID e iniciar uma nova pesquisa.
- **Correção:** a telemetria foi retirada da interface e deixou de ser carregada
  na abertura do painel, reduzindo o custo do Worker. A busca de jogadores agora
  aceita nome, e-mail ou ID completo. Cada alerta antifraude mostra a identidade
  da conta e oferece o atalho **Localizar jogador**, que abre a pesquisa já
  preenchida. O acesso continua exclusivo da conta fundadora.
- **Validação:** build, lint e 206 testes aprovados; deploy dry-run aprovado;
  endpoints públicos continuam rejeitando o painel administrativo sem sessão.
- **Staging:** https://staging.cryptominerarcadia.com/admin
- **Produção:** https://cryptominerarcadia.com/admin
- **Versões:** staging `b9e55596-ef11-4ee7-a83c-3b20c587fd14`; oficial
  `10d8aa3d-3cab-4d79-8d81-18b4659c858f`
- **Status:** Publicado

## Entrada 011 — Nome público do Coin Cascade

- **Data:** 2026-08-17
- **Área:** Arcade 24h / Central do fundador / Histórico
- **Problema:** o identificador técnico legado `coin-link` aparecia cru no
  desempenho do Arcade 24h e podia ser confundido com uma moeda ou com o
  ticker CMA.
- **Correção:** o rótulo exibido agora é **Coin Cascade** em desempenho,
  antifraude e atividades do histórico. O ID interno `coin-link` foi mantido
  nas rotas, banco e replays para preservar partidas e registros existentes.
- **Validação:** build, lint e 206 testes aprovados; as rotas e o histórico
  continuam usando o identificador legado sem alteração de dados.
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `869d7ef3-2786-4957-968f-66104c36d759`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `80577019-2a29-4ae7-b83c-dec8909549e2`
- **Status:** Publicado

## Entrada 012 — Reset integral do PC após ciclo sem vitória

- **Data:** 2026-08-17
- **Área:** Arcade / Progressão do PC / Economia
- **Problema:** o aviso dizia que uma virada sem jogar retirava apenas um nível,
  enquanto a regra desejada é exigir uma vitória validada em cada ciclo para
  manter a progressão.
- **Correção:** o servidor agora acompanha a última atividade e a última
  vitória concluída. Se o ciclo fechar sem uma vitória, todas as linhas de
  progresso do PC são zeradas (partidas, vitórias, sequência, recarga e nível),
  e o jogador recomeça no nível 0. A sincronização ocorre antes do resumo e
  antes de iniciar qualquer um dos quatro minigames; vitórias no ciclo mantêm
  o progresso normalmente.
- **Validação:** build, lint e 206 testes aprovados; cenários de ciclo com
  vitória, sem vitória e inatividade prolongada cobertos no teste diário.
- **Status:** Publicado silenciosamente (sem anúncio no Discord)

## Entrada 013 — Alertas recentes no CRM do fundador

- **Data:** 2026-08-17
- **Área:** Central do fundador / Monitoramento / Suporte
- **Problema:** novos blocos e mudanças nos protocolos de suporte só podiam
  ser encontrados navegando por telas diferentes, sem um aviso contextual no
  cockpit.
- **Correção:** o painel do fundador agora exibe uma atividade recente com
  blocos minerados, chamados novos, protocolos em análise e atendimentos
  resolvidos. Cada item mostra prioridade, horário e protocolo, e leva o
  fundador diretamente à área correspondente. O feed usa apenas eventos das
  últimas 24 horas, é atualizado junto com o CRM e não aparece para jogadores.
- **Validação:** testes unitários cobrem blocos, estados de suporte, ordenação,
  janela de 24 horas e limite do feed.
- **Staging:** https://staging.cryptominerarcadia.com/admin
- **Produção:** https://cryptominerarcadia.com/admin
- **Versões:** staging `dc330eee-1f44-45b8-ab4d-5257a9d49c29`; oficial
  `7176b62e-b352-4436-9edb-bf504ba0e5c2`
- **Status:** Publicado

## Entrada 014 — Convite para o Discord no resgate de XP

- **Data:** 2026-08-17
- **Área:** Bônus diário de XP / Comunidade
- **Problema:** o modal de XP não orientava o operador sobre onde acompanhar
  acelerações de blocos e recompensas especiais.
- **Correção:** o modal agora exibe um callout bilíngue (PT-BR/English) acima
  da trilha de recompensas, com o convite **Entrar no Discord** e link para o
  servidor oficial em nova aba. A coleta do XP e a validação do servidor não
  foram alteradas.
- **Validação:** `npm test` (209 testes aprovados) e `npm run lint` (0 erros;
  5 avisos preexistentes).
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `38a9d126-d11b-45fd-887c-5b6620edbf19`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `54d30811-8351-4f12-bd6b-b5dc869e5ad7`
- **Status:** Publicado

## Entrada 015 — Ranking global limitado ao Top 15

- **Data:** 2026-08-17
- **Área:** Ranking global / Desempenho
- **Problema:** a consulta pública buscava até 100 operadores, aumentando o
  payload e o custo de renderização das salas públicas.
- **Correção:** o ranking agora consulta e exibe somente as 15 maiores
  posições. A prévia pública da sala continua somente leitura e disponível ao
  clicar no operador.
- **Validação:** `npm test` (209 testes aprovados) e `npm run lint` (0 erros;
  5 avisos preexistentes). Produção respondeu HTTP 200; staging respondeu
  HTTP 302 para o Cloudflare Access, conforme esperado.
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `814925f0-79d2-4a7c-8983-a1472fdce6fa`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `a59b01dd-317e-4ab6-a3ad-42b8292623da`
- **Status:** Publicado

## Entrada 016 — Cache seguro de ativos públicos

- **Data:** 2026-08-17
- **Área:** Performance / Cloudflare Worker
- **Problema:** chunks do build e ativos públicos podiam ser baixados
  novamente em cada navegação, aumentando latência e consumo de banda.
- **Correção:** arquivos versionados do build agora usam cache imutável de um
  ano; imagens e ativos públicos sem hash usam cache de 24 horas com
  revalidação. HTML autenticado, páginas dinâmicas e APIs continuam sem cache.
- **Validação:** 209 testes aprovados, lint sem erros e cabeçalho verificado
  em produção (`public, max-age=31536000, immutable`).
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `02ff965e-0114-40fc-9d33-fba3d5cc29a2`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `2ed94aa6-967c-4162-bceb-8b0a4c56c42d`
- **Status:** Publicado

## Entrada 017 — Cockpit operacional sem ruído de mineração

- **Data:** 2026-08-17
- **Área:** CRM do fundador / Alertas operacionais
- **Problema:** o cockpit era preenchido por eventos repetidos de “Novo bloco
  minerado”, sem ajudar a priorizar o trabalho do proprietário.
- **Correção:** liquidações de bloco foram retiradas do feed visual. O CRM agora
  reúne apenas itens acionáveis: chamados de suporte, feedbacks, depósitos Pix
  e cripto, saques e sinais antifraude. Os eventos são agrupados por referência
  e status para evitar duplicidade; cada alerta direciona para a área correta.
- **Validação:** 210 testes aprovados e lint sem erros. Staging protegido pelo
  Cloudflare Access respondeu HTTP 302 conforme esperado.
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `a99825d1-8572-41bd-837b-40e775e9319d`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `b067941e-70ee-486f-93b9-ad2a791f0b16`
- **Status:** Publicado

## Entrada 018 — Proteção contra sobrecarga do Worker (Cloudflare 1102)

- **Data:** 2026-08-17
- **Área:** Estabilidade / Rede / Central do fundador
- **Problema:** a leitura do poder global executava uma migração ilimitada de
  todos os estados legados em cada requisição. Em bases maiores, esse trabalho
  podia exceder o limite de CPU ou memória do Worker e retornar o erro 1102.
- **Correção:** a reconstrução do índice de poder passou a processar somente
  um lote pequeno por requisição e continuar de forma incremental. O CRM
  também limita a telemetria JSON carregada e retirou a varredura de mineradores
  aninhada da verificação operacional; os dados autoritativos continuam sendo
  sincronizados quando a conta joga ou altera a sala.
- **Validação:** `npm test` — 211 testes aprovados; `npm run lint` — 0 erros
  (5 avisos preexistentes); rotas públicas responderam normalmente e APIs
  protegidas continuam exigindo autenticação.
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `8c2fc7a9-22e2-43c2-b1e2-8c1e72a9d803`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `a22996a3-9720-40b7-9383-71eada8fa284`
- **Status:** Publicado

## Entrada 019 — Exportação administrativa com limite seguro

- **Data:** 2026-08-17
- **Área:** Estabilidade / CRM do fundador
- **Problema:** a exportação do CRM ainda carregava milhares de estados
  completos e podia gerar um pico de CPU e memória quando o relatório era
  baixado em uma base maior.
- **Correção:** a exportação agora considera no máximo 250 contas mais
  recentes, ordenadas por `updated_at`, e informa esse escopo no CSV. As
  consultas de rede, operações e painel continuam usando lotes limitados.
- **Validação:** `npm test` — 212 testes aprovados; `npm run lint` — 0 erros
  (5 avisos preexistentes); produção respondeu HTTP 200, a API administrativa
  sem sessão respondeu HTTP 401 e staging respondeu HTTP 302 pelo Access.
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `fe7ce77d-d9fc-49d1-8e43-210cd06e5fbe`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `739ebfb5-b9fd-4c50-84ed-bb99d903cd02`
- **Status:** Publicado

## Entrada 020 — Diagnóstico operacional com amostra segura

- **Data:** 2026-08-17
- **Área:** Estabilidade / Central de Operações
- **Problema:** o diagnóstico comparava o JSON completo de todas as contas
  sempre que o cockpit do fundador era aberto, elevando o custo de CPU em
  bases maiores.
- **Correção:** a contagem de índices ausentes continua cobrindo a base
  inteira com uma junção indexada; a comparação detalhada de alocação e energia
  usa somente os 250 estados mais recentemente atualizados. Nenhum saldo,
  poder, pool ou estado de jogador é alterado pelo diagnóstico.
- **Validação:** `npm test` — 212 testes aprovados; `npm run lint` — 0 erros
  (5 avisos preexistentes); produção respondeu HTTP 200, APIs administrativas
  sem sessão responderam HTTP 401, staging respondeu HTTP 302 pelo Access e
  12 requisições simultâneas à produção responderam HTTP 200.
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `dce6212b-b48b-4d0b-987c-5690f6a1eb41`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `a7de29ef-d772-427c-b0f5-94a03f2f7928`
- **Status:** Publicado

## Entrada 021 — Exportação em segundo plano e telemetria enxuta

- **Data:** 2026-08-17
- **Área:** Estabilidade / CPU / Memória / CRM do fundador
- **Problema:** gerar o CSV do CRM em uma única requisição fazia o Worker
  carregar e analisar muitos estados de uma vez; os diagnósticos de
  observabilidade também mantinham limites excessivos para uma tela de
  diagnóstico.
- **Correção:** o botão de exportação agora cria uma tarefa protegida e
  processa no máximo 25 estados por consulta, guardando o resultado por 24
  horas e liberando o download somente no final. A telemetria de diagnóstico
  foi reduzida a amostras de 500 contas e 1.000 eventos. Grades longas de
  imagens usam `content-visibility` para evitar rasterização fora da tela;
  nenhuma regra de mineração ou saldo foi alterada.
- **Validação:** `npm test` — 212 testes aprovados; `npm run lint` — 0 erros
  (5 avisos preexistentes); produção respondeu HTTP 200 em 12 acessos
  simultâneos e as APIs administrativas sem sessão responderam HTTP 401.
- **Staging:** https://staging.cryptominerarcadia.com/ — versão
  `9e8d23a4-e3af-4efb-87f3-007d594e3ebd`
- **Produção:** https://cryptominerarcadia.com/ — versão
  `be5bf9b7-b0b9-4495-923c-2c94beb32458`
- **Status:** Publicado

## Modelo para as próximas entradas

```text
## Entrada NNN — Título curto

- **Data:** YYYY-MM-DD
- **Área:**
- **Problema:**
- **Correção:**
- **Validação:**
- **Staging:**
- **Versão:**
- **Status:** Em teste | Pronto para anunciar | Publicado
```
