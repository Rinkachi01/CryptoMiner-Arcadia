"use client";

import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";
import { useArcadiaLanguage, type ArcadiaLocale } from "../i18n";

type FaqItem = { question: string; answer: string };
type FaqSection = { label: string; title: string; items: FaqItem[] };

const faqCopy: Record<ArcadiaLocale, {
  heroLabel: string;
  heroTitle: string;
  heroDescription: string;
  sections: FaqSection[];
  supportLabel: string;
  supportTitle: string;
  supportDescription: string;
  supportAction: string;
}> = {
  "pt-BR": {
    heroLabel: "GUIA DO OPERADOR",
    heroTitle: "Perguntas frequentes, sem ruído.",
    heroDescription:
      "Regras de operação, Arcade, energia, economia, carteira e temporada em respostas curtas. O estado da sua conta e as regras do servidor sempre prevalecem.",
    supportLabel: "AINDA PRECISA DE AJUDA?",
    supportTitle: "Abra um protocolo com o contexto certo.",
    supportDescription:
      "Informe a conta, o ID da fatura ou da partida e o que aconteceu. Nunca envie senha, código de autenticação ou chave privada.",
    supportAction: "IR PARA O SUPORTE",
    sections: [
      {
        label: "OPERAÇÃO",
        title: "Sala, racks e poder",
        items: [
          { question: "O que é poder de mineração?", answer: "É a capacidade usada para disputar a parcela de cada bloco. Mineradores e racks fornecem poder permanente; partidas autenticadas do Arcade podem fornecer poder temporário." },
          { question: "Por que meu poder temporário diminui?", answer: "O poder do Arcade tem validade definida pelo servidor. Jogar com regularidade mantém a atividade; o poder dos mineradores permanece enquanto estiverem instalados, energizados e válidos." },
          { question: "Como funcionam as salas e os racks?", answer: "Cada sala possui doze posições gratuitas para racks. Um minerador de uma fan ocupa um slot; modelos de duas fans precisam de dois slots contínuos no mesmo rack." },
          { question: "Mais poder muda o valor do bloco?", answer: "Não. Cada pool usa uma emissão fixa por bloco de dez minutos. Mais poder altera somente a participação relativa entre os operadores." },
        ],
      },
      {
        label: "ARCADE",
        title: "Partidas, energia e baterias",
        items: [
          { question: "Como o Arcade concede poder?", answer: "O resultado é validado no servidor. A dificuldade, a quantidade de partidas e o nível do PC definem a duração do poder temporário, sem confirmar prêmios apenas pelo navegador." },
          { question: "O que acontece se eu ficar alguns dias sem jogar?", answer: "O nível de atividade pode cair gradualmente e o poder temporário expira conforme a data registrada. O inventário e o poder permanente não são apagados por inatividade." },
          { question: "Para que servem as baterias?", answer: "Baterias estendem o ciclo de energia dos mineradores. O ciclo gratuito da sala é separado do XP do Arcade e segue as regras atuais de energia." },
          { question: "Por que uma partida pode não liberar recompensa?", answer: "A partida precisa ser concluída dentro do limite, sem comportamento automatizado e com a validação do servidor. Recarregar a página não substitui uma confirmação autoritativa." },
        ],
      },
      {
        label: "ECONOMIA",
        title: "Pools, blocos e conversão",
        items: [
          { question: "Quais pools existem no Arcadia?", answer: "A operação pode distribuir poder entre CMA, Bitcoin, Dogecoin e Litecoin. A distribuição é definida na página de Pools e vale para o poder válido da conta." },
          { question: "O que é CMA?", answer: "CMA é o crédito interno usado para compras e progressão no jogo. Ele não é uma criptomoeda externa e não é sacável." },
          { question: "Como converter BTC, DOGE ou LTC para CMA?", answer: "Depois que o depósito estiver confirmado, escolha a moeda, informe uma quantidade inteira de CMA e confira a cotação do servidor antes de confirmar a conversão." },
          { question: "Por que o valor mínimo pode mudar?", answer: "Mínimos, taxas de rede e cotações são informados por moeda e podem mudar. A tela de depósito mostra a rede correta, o valor mínimo e a validade da fatura antes do envio." },
        ],
      },
      {
        label: "CARTEIRA",
        title: "Depósitos, saques e suporte",
        items: [
          { question: "Como faço um depósito?", answer: "Abra a Carteira, selecione a moeda e gere uma fatura. Envie somente a moeda e a rede exibidas na fatura; o crédito aparece no extrato após a confirmação do provedor." },
          { question: "Meu depósito não apareceu. O que devo fazer?", answer: "Confira o ID da fatura, a rede e o hash público da transação. Se o status não mudar após o prazo indicado, abra um protocolo no Suporte com esses dados; não envie senha ou chave privada." },
          { question: "Como funcionam os saques?", answer: "Pedidos de BTC, DOGE e LTC entram em uma fila de revisão. O status, a moeda e a referência de pagamento ficam registrados no extrato da conta." },
          { question: "O Arcadia guarda minha chave privada?", answer: "Não. O Arcadia registra saldos e eventos em um livro-razão da conta; nunca solicite ou compartilhe seed phrase, senha ou acesso remoto." },
        ],
      },
      {
        label: "TEMPORADA",
        title: "XP e Orbit Pass",
        items: [
          { question: "Como ganho XP?", answer: "Vitórias autenticadas no Arcade, missões e atividades elegíveis geram XP. O progresso é vinculado à conta e não pode ser fabricado pelo cliente." },
          { question: "Qual a diferença entre o passe gratuito e o premium?", answer: "Os dois usam o mesmo nível de XP. O premium libera a trilha paga e também libera as recompensas gratuitas já alcançadas naquele nível." },
          { question: "As recompensas da temporada são permanentes?", answer: "Depende do item. Mineradores e itens de inventário permanecem na conta; poderes temporários e energia expiram conforme a validade exibida no resgate." },
        ],
      },
    ],
  },
  en: {
    heroLabel: "OPERATOR GUIDE",
    heroTitle: "Frequently asked questions, without the noise.",
    heroDescription:
      "Short answers about operations, the Arcade, energy, the economy, wallets and seasons. Your account state and the server rules always take priority.",
    supportLabel: "STILL NEED HELP?",
    supportTitle: "Open a ticket with the right context.",
    supportDescription:
      "Include your account, invoice or game ID and what happened. Never send a password, authentication code or private key.",
    supportAction: "GO TO SUPPORT",
    sections: [
      {
        label: "OPERATIONS",
        title: "Rooms, racks and power",
        items: [
          { question: "What is mining power?", answer: "It is the capacity used to compete for a share of each block. Miners and racks provide permanent power; authenticated Arcade games may provide temporary power." },
          { question: "Why does my temporary power decrease?", answer: "Arcade power has a server-defined validity period. Regular play maintains activity; permanent miner power remains while equipment is installed, powered and valid." },
          { question: "How do rooms and racks work?", answer: "Each room has twelve free rack positions. A one-fan miner uses one slot; two-fan models require two contiguous slots in the same rack." },
          { question: "Does more power change the block value?", answer: "No. Each pool uses a fixed emission per ten-minute block. More power only changes the relative share between operators." },
        ],
      },
      {
        label: "ARCADE",
        title: "Games, energy and batteries",
        items: [
          { question: "How does the Arcade grant power?", answer: "Results are validated by the server. Difficulty, game count and PC level determine temporary power duration; the browser alone cannot confirm rewards." },
          { question: "What happens if I stop playing for a few days?", answer: "Activity level may gradually fall and temporary power expires on its recorded date. Inventory and permanent power are not deleted for inactivity." },
          { question: "What are batteries for?", answer: "Batteries extend the miners' energy cycle. The room's free cycle is separate from Arcade XP and follows the current energy rules." },
          { question: "Why might a game not grant a reward?", answer: "The game must finish within its limits, without automated behavior, and pass server validation. Reloading the page does not replace an authoritative confirmation." },
        ],
      },
      {
        label: "ECONOMY",
        title: "Pools, blocks and conversion",
        items: [
          { question: "Which pools are available?", answer: "Power can be distributed between CMA, Bitcoin, Dogecoin and Litecoin. Distribution is set on the Pools page and applies to valid account power." },
          { question: "What is CMA?", answer: "CMA is an internal credit used for in-game purchases and progression. It is not an external cryptocurrency and cannot be withdrawn." },
          { question: "How do I convert BTC, DOGE or LTC to CMA?", answer: "After a deposit is confirmed, choose the currency, enter a whole CMA amount and review the server quote before confirming the conversion." },
          { question: "Why can the minimum change?", answer: "Minimums, network fees and quotes are shown per currency and may change. The deposit screen shows the correct network, minimum and invoice validity before you send." },
        ],
      },
      {
        label: "WALLET",
        title: "Deposits, withdrawals and support",
        items: [
          { question: "How do I make a deposit?", answer: "Open Wallet, choose a currency and create an invoice. Send only the currency and network displayed on the invoice; the credit appears after the provider confirms it." },
          { question: "My deposit did not appear. What should I do?", answer: "Check the invoice ID, network and public transaction hash. If the status does not change within the stated time, open a Support ticket with those details; never send a password or private key." },
          { question: "How do withdrawals work?", answer: "BTC, DOGE and LTC requests enter a review queue. The status, currency and payment reference remain visible in your account statement." },
          { question: "Does Arcadia store my private key?", answer: "No. Arcadia records balances and events in an account ledger; never request or share a seed phrase, password or remote access." },
        ],
      },
      {
        label: "SEASON",
        title: "XP and Orbit Pass",
        items: [
          { question: "How do I earn XP?", answer: "Authenticated Arcade wins, missions and eligible activities grant XP. Progress is linked to your account and cannot be fabricated by the client." },
          { question: "What is the difference between the free and premium pass?", answer: "Both use the same XP level. Premium unlocks the paid track and also unlocks free rewards already reached at that level." },
          { question: "Are season rewards permanent?", answer: "It depends on the item. Miners and inventory items remain on the account; temporary power and energy expire according to the validity shown when claimed." },
        ],
      },
    ],
  },
};

export default function FaqPage() {
  const { locale } = useArcadiaLanguage();
  const copy = faqCopy[locale];

  return (
    <main className="public-info-page public-faq-page">
      <PublicInfoHeader label={locale === "pt-BR" ? "CENTRAL DE AJUDA" : "HELP CENTER"} />

      <section className="public-info-hero faq-hero">
        <span>{copy.heroLabel}</span>
        <h1>{copy.heroTitle}</h1>
        <p>{copy.heroDescription}</p>
      </section>

      <div className="faq-section-grid">
        {copy.sections.map((section) => (
          <section className="faq-section-card" key={section.label}>
            <header>
              <span>{section.label}</span>
              <h2>{section.title}</h2>
            </header>
            <div className="faq-items">
              {section.items.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="faq-support-callout">
        <span>{copy.supportLabel}</span>
        <h2>{copy.supportTitle}</h2>
        <p>{copy.supportDescription}</p>
        <a href="/support">{copy.supportAction}</a>
      </section>

      <PublicSiteFooter />
    </main>
  );
}
