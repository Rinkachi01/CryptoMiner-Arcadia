import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";

type FaqItem = { question: string; answer: string };
type FaqSection = { label: string; title: string; items: FaqItem[] };

const faqSections: FaqSection[] = [
  {
    label: "OPERAÇÃO",
    title: "Sala, racks e poder",
    items: [
      {
        question: "O que é poder de mineração?",
        answer:
          "É a capacidade usada para disputar a parcela de cada bloco. Mineradores e racks fornecem poder permanente; partidas autenticadas do Arcade podem fornecer poder temporário.",
      },
      {
        question: "Por que meu poder temporário diminui?",
        answer:
          "O poder do Arcade tem validade definida pelo servidor. Jogar com regularidade mantém a atividade; o poder dos mineradores permanece enquanto estiverem instalados, energizados e válidos.",
      },
      {
        question: "Como funcionam as salas e os racks?",
        answer:
          "Cada sala possui doze posições gratuitas para racks. Um minerador de uma fan ocupa um slot; modelos de duas fans precisam de dois slots contínuos no mesmo rack.",
      },
      {
        question: "Mais poder muda o valor do bloco?",
        answer:
          "Não. Cada pool usa uma emissão fixa por bloco de dez minutos. Mais poder altera somente a participação relativa entre os operadores.",
      },
    ],
  },
  {
    label: "ARCADE",
    title: "Partidas, energia e baterias",
    items: [
      {
        question: "Como o Arcade concede poder?",
        answer:
          "O resultado é validado no servidor. A dificuldade, a quantidade de partidas e o nível do PC definem a duração do poder temporário, sem confirmar prêmios apenas pelo navegador.",
      },
      {
        question: "O que acontece se eu ficar alguns dias sem jogar?",
        answer:
          "O nível de atividade pode cair gradualmente e o poder temporário expira conforme a data registrada. O inventário e o poder permanente não são apagados por inatividade.",
      },
      {
        question: "Para que servem as baterias?",
        answer:
          "Baterias estendem o ciclo de energia dos mineradores. O ciclo gratuito da sala é separado do XP do Arcade e segue as regras atuais de energia.",
      },
      {
        question: "Por que uma partida pode não liberar recompensa?",
        answer:
          "A partida precisa ser concluída dentro do limite, sem comportamento automatizado e com a validação do servidor. Recarregar a página não substitui uma confirmação autoritativa.",
      },
    ],
  },
  {
    label: "ECONOMIA",
    title: "Pools, blocos e conversão",
    items: [
      {
        question: "Quais pools existem no Arcadia?",
        answer:
          "A operação pode distribuir poder entre CMA, Bitcoin, Dogecoin e Litecoin. A distribuição é definida na página de Pools e vale para o poder válido da conta.",
      },
      {
        question: "O que é CMA?",
        answer:
          "CMA é o crédito interno usado para compras e progressão no jogo. Ele não é uma criptomoeda externa e não é sacável.",
      },
      {
        question: "Como converter BTC, DOGE ou LTC para CMA?",
        answer:
          "Depois que o depósito estiver confirmado, escolha a moeda, informe uma quantidade inteira de CMA e confira a cotação do servidor antes de confirmar a conversão.",
      },
      {
        question: "Por que o valor mínimo pode mudar?",
        answer:
          "Mínimos, taxas de rede e cotações são informados por moeda e podem mudar. A tela de depósito mostra a rede correta, o valor mínimo e a validade da fatura antes do envio.",
      },
    ],
  },
  {
    label: "CARTEIRA",
    title: "Depósitos, saques e suporte",
    items: [
      {
        question: "Como faço um depósito?",
        answer:
          "Abra a Carteira, selecione a moeda e gere uma fatura. Envie somente a moeda e a rede exibidas na fatura; o crédito aparece no extrato após a confirmação do provedor.",
      },
      {
        question: "Meu depósito não apareceu. O que devo fazer?",
        answer:
          "Confira o ID da fatura, a rede e o hash público da transação. Se o status não mudar após o prazo indicado, abra um protocolo no Suporte com esses dados; não envie senha ou chave privada.",
      },
      {
        question: "Como funcionam os saques?",
        answer:
          "Pedidos de BTC, DOGE e LTC entram em uma fila de revisão manual. O status, a moeda e a referência de pagamento ficam registrados no extrato da conta.",
      },
      {
        question: "O Arcadia guarda minha chave privada?",
        answer:
          "Não. O Arcadia registra saldos e eventos em um livro-razão da conta; nunca solicite ou compartilhe seed phrase, senha ou acesso remoto.",
      },
    ],
  },
  {
    label: "TEMPORADA",
    title: "XP e Orbit Pass",
    items: [
      {
        question: "Como ganho XP?",
        answer:
          "Vitórias autenticadas no Arcade, missões e atividades elegíveis geram XP. O progresso é vinculado à conta e não pode ser fabricado pelo cliente.",
      },
      {
        question: "Qual a diferença entre o passe gratuito e o premium?",
        answer:
          "Os dois usam o mesmo nível de XP. O premium libera a trilha paga e também libera as recompensas gratuitas já alcançadas naquele nível.",
      },
      {
        question: "As recompensas da temporada são permanentes?",
        answer:
          "Depende do item. Mineradores e itens de inventário permanecem na conta; poderes temporários e energia expiram conforme a validade exibida no resgate.",
      },
    ],
  },
];

export const dynamic = "force-dynamic";

export default function FaqPage() {
  return (
    <main className="public-info-page public-faq-page">
      <PublicInfoHeader label="CENTRAL DE AJUDA" />

      <section className="public-info-hero faq-hero">
        <span>GUIA DO OPERADOR</span>
        <h1>Perguntas frequentes, sem ruído.</h1>
        <p>
          Regras de operação, Arcade, energia, economia, carteira e temporada em
          respostas curtas. O estado da sua conta e as regras do servidor sempre
          prevalecem sobre qualquer exemplo desta página.
        </p>
      </section>

      <div className="faq-section-grid">
        {faqSections.map((section) => (
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
        <span>AINDA PRECISA DE AJUDA?</span>
        <h2>Abra um protocolo com o contexto certo.</h2>
        <p>
          Informe a conta, o ID da fatura ou da partida e o que aconteceu. Nunca
          envie senha, código de autenticação ou chave privada.
        </p>
        <a href="/support">IR PARA O SUPORTE</a>
      </section>

      <PublicSiteFooter />
    </main>
  );
}
