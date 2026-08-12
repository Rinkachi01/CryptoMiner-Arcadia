# Arcadia Interface vNext

## Visão do produto

O Arcadia deve parecer uma plataforma de entretenimento premium, e não um painel financeiro coberto por números. A sala, os racks e os mineradores são o produto visual. O restante da interface existe para apoiar a ação do jogador e aparece somente quando necessário.

Princípio central: **uma tela, uma intenção principal**.

- Sala: observar e organizar a operação.
- Pools: distribuir poder.
- Inventário: localizar e instalar itens.
- Loja: avaliar e comprar.
- Arcade: escolher e jogar.
- Carteira: depositar, converter ou sacar — nunca as três coisas misturadas.
- Suporte: abrir chamado, acompanhar chamado ou consultar ajuda.
- Central do proprietário: analisar uma área operacional por vez.

## Arquitetura da informação

```text
Arcadia
├─ Sala
│  ├─ Cena e equipamentos
│  ├─ Dock contextual: poder, energia e próximo bloco
│  └─ Gaveta de operação: energia, pools, rede e bloco
├─ Pools
├─ Inventário
├─ Loja
├─ Arcade
├─ Carreira e temporada
├─ Carteira
│  ├─ Depositar
│  │  ├─ Pix
│  │  └─ BTC / DOGE / LTC
│  ├─ Converter para CMA
│  └─ Sacar
│     ├─ Receber em cripto
│     └─ Converter saldo cripto e receber via Pix
├─ Suporte
│  ├─ Novo chamado
│  ├─ Meus protocolos
│  └─ Guias e FAQ
└─ Central do proprietário
   ├─ Visão geral
   ├─ Economia
   ├─ Tesouraria
   ├─ Jogadores
   └─ Operações
```

## Layout principal

### Desktop

1. **Rail lateral de 82 px** com ícones. Expande sobre o conteúdo no hover ou foco, sem deslocar a sala.
2. **Topbar de 68 px** com apenas identidade, notificações, saldo selecionado e conta.
3. **Sala em tela cheia** como conteúdo dominante.
4. **Dock de comando flutuante** no canto inferior da sala, contendo:
   - poder instalado;
   - energia restante;
   - tempo do próximo bloco;
   - ações Operação, Pools e Loja.
5. **Gaveta de operação** à direita, aberta sob demanda. Energia, distribuição, rede e recompensa fixa deixam de competir permanentemente com a cena.

### Celular

- Navegação principal permanece na dock inferior.
- Topbar mostra somente marca, carteira e avatar.
- Dock de comando deixa de flutuar e passa a ficar abaixo da sala para não cobrir racks.
- Gaveta operacional ocupa a tela inteira e possui fechamento explícito.
- Racks continuam acessíveis pelo carrossel abaixo da sala.
- Todos os alvos importantes devem ter pelo menos 44 px; o mínimo normativo da WCAG 2.2 é 24 × 24 px com regras de espaçamento.

## Direção de arte

### Paleta

| Papel | Cor | Uso |
|---|---:|---|
| Obsidian | `#05060A` | Fundo global |
| Void panel | `#0B0D14` | Superfícies principais |
| Deep space | `#10131E` | Cartões e campos |
| Starlight | `#F5F7FF` | Texto principal |
| Muted orbit | `#8993A8` | Texto secundário |
| Arcadia cyan | `#61E7FF` | Navegação, foco e informação |
| Reactor lime | `#B8FF63` | Sucesso e ação econômica principal |
| Quantum violet | `#9D7BFF` | Temporada, raridade e profundidade |
| Solar amber | `#FFC467` | Avisos e recompensas |
| Alert coral | `#FF7380` | Erro ou ação destrutiva |

Neon não é fundo. Neon é sinal: foco, seleção, sucesso ou recompensa. O uso contínuo reduz a sensação premium.

### Tipografia

- Interface: `Segoe UI Variable Text`, `Aptos` ou `Inter`.
- Títulos: `Segoe UI Variable Display`, `Aptos Display` ou `Inter` em peso 650–750.
- Dados curtos e IDs: `Cascadia Code` ou equivalente monoespaçado.
- Corpo mínimo recomendado: 15–16 px.
- Metadados: nunca menores que 12 px na experiência normal.
- Títulos em caixa normal; caixa alta apenas para rótulos curtos.

### Superfícies

- Raios entre 12 e 24 px.
- Bordas translúcidas de baixo contraste.
- Glassmorphism somente em HUD, dock, menus e drawers sobre a sala.
- Painéis de leitura longa usam fundo mais opaco para preservar contraste.
- Sombra ampla e suave, sem múltiplos contornos luminosos.

## Componentes

### HUD da sala

- Não exibe poder global, histórico e recompensa simultaneamente.
- Mostra três valores contextuais na dock.
- Cada valor possui rótulo curto e valor legível.
- Clique em Operação revela a informação completa.
- Saldo fica na topbar e abre a carteira compacta.

### Equipamento

Estado padrão: somente a arte.

No hover, foco ou toque:

- brilho discreto na silhueta;
- etiqueta com ocupação do rack;
- clique abre a ficha completa.

Na ficha:

- nome e raridade;
- potência;
- slots ocupados;
- estado instalado/livre;
- ação primária.

Não usar texto permanente sobre a arte do minerador.

### Loja e inventário

- Fundo de vitrine com grade espacial, halo e plataforma holográfica.
- Filtros persistentes no topo.
- Cartão mostra nome, arte, potência e preço.
- Informações técnicas secundárias entram em expansão ou tooltip.
- Comparação futura: selecionar até três itens sem poluir a grade.

### Carteira

Três abas exclusivas: **Depositar**, **Converter** e **Sacar**.

Em Sacar:

- opção Receber em cripto;
- opção Converter e receber via Pix;
- mínimo direto em cripto recalculado para aproximadamente R$ 50;
- mínimo Pix de R$ 20;
- cotação Pix válida por dois minutos;
- saldo de origem reservado no servidor;
- recusa administrativa devolve exatamente a cripto reservada;
- CMA continua não sacável.

O histórico identifica claramente método, valor de saída, saldo de origem e estado.

### Suporte

A primeira dobra oferece somente:

1. abrir chamado;
2. acompanhar protocolos;
3. consultar guias.

FAQ e explicações financeiras ficam em um disclosure fechado. Não repetir regras extensas em cada formulário.

### Central do proprietário

- Navegação por cinco áreas operacionais.
- Uma área visível por vez.
- Visão geral mostra apenas saúde, alertas e decisões pendentes.
- Tesouraria concentra Pix, depósitos, reconciliação e saques.
- Fila de saques diferencia endereço de rede e chave Pix.
- Ações críticas exigem referência real, motivo e confirmação.
- Pesquisa global de jogador permanece em Jogadores.
- Exportação, migração e sair ficam em menu utilitário no passo seguinte.

## Microinterações

- Hover: 160–180 ms, deslocamento máximo de 1–2 px.
- Drawer: 220–260 ms com desaceleração suave.
- Clique: compressão de 1–2%, nunca bounce infantil.
- Crédito confirmado: halo curto e mensagem persistente; sem chuva de partículas.
- Minerador selecionado: brilho e elevação discretos.
- Erro: borda coral e explicação; nunca piscar.
- Loading: skeleton ou progresso localizado, sem bloquear a tela inteira.

Todas as animações não essenciais devem respeitar `prefers-reduced-motion`. A WCAG recomenda permitir a desativação de movimento acionado por interação.

## Acessibilidade

- Contraste mínimo de 4,5:1 para texto normal e 3:1 para texto grande.
- Foco visível em cyan, independente da cor de seleção.
- Todos os drawers têm nome acessível e botão de fechar.
- Ícone recolhido sempre possui `title` ou `aria-label`.
- Estado não depende exclusivamente de cor.
- Texto pode crescer 200% sem perda funcional.
- Layout mobile evita controles pequenos adjacentes.

Referências oficiais:

- [WCAG 2.2 — contraste e redimensionamento](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 — tamanho mínimo de alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [WCAG — animação acionada por interação](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)

## Regras financeiras da interface

- Nunca apresentar estimativa como saldo confirmado.
- Nunca converter depósito para CMA automaticamente.
- Cotação, reserva e pagamento são estados distintos.
- A cotação de BTC/DOGE/LTC em real vem do servidor, não do navegador.
- A fonte de preço e o horário observado ficam registrados.
- A quantidade mínima em cripto varia com o preço; o objetivo econômico permanece em reais.
- Saque Pix é manual nesta fase e deve exibir isso antes da confirmação.
- O Access Token do Mercado Pago e demais segredos jamais aparecem no cliente.

O endpoint de preço usado na arquitetura aceita moeda de referência configurável, inclusive BRL: [CoinGecko Simple Price](https://docs.coingecko.com/reference/simple-price). Para Pix, a integração oficial retorna QR Code, código copia e cola e estado de transferência pendente; solicitações devem usar idempotência: [Mercado Pago Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix).

## Fases de implementação

### Entregue nesta atualização

- tokens visuais vNext;
- rail lateral retrátil;
- HUD compacto;
- sala em foco total;
- dock contextual;
- gaveta operacional;
- carteira com escolha de método de saque;
- cotação e reserva para saque Pix em real;
- mínimos econômicos em BRL;
- fila do fundador preparada para cripto e Pix;
- Central do proprietário, carteira e suporte com superfícies premium responsivas.

### Próxima iteração

- menu utilitário compacto do proprietário;
- command palette para localizar jogador, saque ou alerta;
- drawer padronizado para detalhes de minerador;
- comparação de equipamentos;
- skeletons de carregamento;
- auditoria visual completa em tamanhos 360, 390, 768, 1280 e 1440 px;
- teste com usuários para medir tempo até Sala, Loja, Arcade e Saque.

### Antes do lançamento público

- revisão de identidade verbal e textos legais;
- teste de contraste automatizado e manual;
- teste de teclado e leitor de tela;
- teste de carga dos endpoints de carteira;
- reconciliação de saques e depósitos;
- política operacional de prazo, taxa, contestação e indisponibilidade;
- monitoramento de falhas e alertas financeiros.

