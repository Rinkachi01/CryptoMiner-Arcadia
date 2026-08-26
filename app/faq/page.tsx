"use client";

import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";
import { useArcadiaLanguage } from "../i18n";

type FaqItem = { question: string; answer: string };
type FaqSection = { label: string; title: string; items: FaqItem[] };

const faqCopy: Record<"pt-BR" | "en" | "es", {
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
          { question: "Como o Arcade concede poder?", answer: "O resultado é validado no servidor. O nível ativo do PC define a duração de cada recompensa temporária: N1 dura 1 dia, N2 2, N3 3, N4 4 e N5 5 dias. Cada concessão tem sua própria expiração e não altera as baterias dos mineradores." },
          { question: "O que acontece se eu ficar um ciclo sem vencer?", answer: "Se um ciclo fechar sem pelo menos uma vitória validada, o PC e seu progresso de partidas voltam ao nível 0. É preciso jogar e vencer novamente para reconstruir a progressão." },
          { question: "Para que servem as baterias?", answer: "Baterias estendem o ciclo de energia dos mineradores. O ciclo gratuito da sala é separado do XP do Arcade e segue as regras atuais de energia." },
          { question: "Por que uma partida pode não liberar recompensa?", answer: "A partida precisa ser concluída dentro do limite, sem comportamento automatizado e com a validação do servidor. Recarregar a página não substitui uma confirmação autoritativa." },
          { question: "Como funcionam Sky Dash e Crypto 2048?", answer: "Sky Dash usa um impulso por toque ou clique: passe pelos vãos sem tocar nos prédios. No Crypto 2048, deslize o tabuleiro, combine moedas do mesmo rank e alcance a meta do nível. Em ambos, o resultado só vale depois da conferência do servidor." },
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
          { question: "Como funciona o link de indicação?", answer: "Quando uma conta entra pelo seu link e passa pela validação de segurança, você recebe um bônus a cada bloco validado pelo indicado: 8% em CMA e 5% em BTC, DOGE e LTC. O indicado recebe a recompensa integral do próprio bloco; o bônus não fica acumulado e não altera o valor fixo do bloco." },
          { question: "O que são as caixas e loots?", answer: "Caixas de suprimentos, caixas da sorte e caixas da temporada entregam itens virtuais definidos pelo servidor. A tela mostra o conteúdo possível e a abertura é registrada; nenhum loot representa saque, investimento ou retorno financeiro garantido." },
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
          { question: "O que é AMC?", answer: "AMC é a moeda temporária da temporada. Ela pode ser recebida no passe e usada somente na Loja da Temporada para abrir caixas de peças. Não pode ser sacada, convertida ou enviada para pools e é reiniciada quando a temporada termina." },
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
          { question: "How does the Arcade grant power?", answer: "Results are validated by the server. The active PC level sets each temporary reward's lifetime: level 1 lasts 1 day, level 2 lasts 2, level 3 lasts 3, level 4 lasts 4 and level 5 lasts 5 days. Each grant has its own expiry and does not change miner batteries." },
          { question: "What happens if I go one cycle without a win?", answer: "If a cycle closes without at least one validated win, the PC and its play progress return to level 0. You must play and win again to rebuild the progression." },
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
          { question: "How does the referral link work?", answer: "When an account joins through your link and passes the security checks, you receive a bonus for every block it validates: 8% in CMA and 5% in BTC, DOGE and LTC. The invited operator keeps the full reward for their own block; the bonus is not accumulated and does not change the fixed block value." },
          { question: "What are crates and loot?", answer: "Supply crates, luck crates and season crates grant virtual items selected by the server. The screen shows possible contents and every opening is recorded; no loot is a withdrawal, investment or guaranteed financial return." },
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
          { question: "What is AMC?", answer: "AMC is the season's temporary currency. It can be earned from the pass and used only in the Season Store to open parts crates. It cannot be withdrawn, converted or sent to pools and resets when the season ends." },
          { question: "How do Sky Dash and Crypto 2048 work?", answer: "Sky Dash uses one impulse per tap or click: fly through the gaps without touching buildings. In Crypto 2048, swipe the board, combine coins of the same rank and reach the level target. In both games, the result counts only after server validation." },
        ],
      },
    ],
  },
  es: {
    heroLabel: "GUÍA DEL OPERADOR",
    heroTitle: "Preguntas frecuentes, sin ruido.",
    heroDescription:
      "Respuestas breves sobre operación, Arcade, energía, economía, billetera y temporadas. El estado de tu cuenta y las reglas del servidor siempre tienen prioridad.",
    supportLabel: "¿AÚN NECESITAS AYUDA?",
    supportTitle: "Abre un ticket con el contexto correcto.",
    supportDescription:
      "Indica tu cuenta, el ID de la factura o de la partida y lo ocurrido. Nunca envíes una contraseña, código de autenticación ni clave privada.",
    supportAction: "IR AL SOPORTE",
    sections: [
      {
        label: "OPERACIÓN",
        title: "Sala, racks y poder",
        items: [
          { question: "¿Qué es el poder de minería?", answer: "Es la capacidad usada para disputar una parte de cada bloque. Los mineros y racks proporcionan poder permanente; las partidas autenticadas del Arcade pueden proporcionar poder temporal." },
          { question: "¿Por qué disminuye mi poder temporal?", answer: "El poder del Arcade tiene una duración definida por el servidor. Jugar con regularidad mantiene la actividad; el poder permanente permanece mientras el equipo esté instalado, energizado y válido." },
          { question: "¿Cómo funcionan las salas y los racks?", answer: "Cada sala tiene doce posiciones gratuitas para racks. Un minero de un ventilador ocupa un slot; los modelos de dos ventiladores necesitan dos slots contiguos en el mismo rack." },
          { question: "¿Más poder cambia el valor del bloque?", answer: "No. Cada pool usa una emisión fija por bloque de diez minutos. Más poder solo cambia la participación relativa entre operadores." },
        ],
      },
      {
        label: "ARCADE",
        title: "Partidas, energía y baterías",
        items: [
          { question: "¿Cómo concede poder el Arcade?", answer: "El servidor valida el resultado. El nivel activo del PC define la duración de cada recompensa temporal: N1 dura 1 día, N2 2, N3 3, N4 4 y N5 5 días. Cada concesión tiene su propia expiración y no cambia las baterías de los mineros." },
          { question: "¿Qué ocurre si paso un ciclo sin ganar?", answer: "Si un ciclo termina sin al menos una victoria validada, el PC y el progreso de partidas vuelven al nivel 0. Debes jugar y ganar de nuevo para reconstruir la progresión." },
          { question: "¿Para qué sirven las baterías?", answer: "Las baterías extienden el ciclo de energía de los mineros. El ciclo gratuito de la sala es independiente del XP del Arcade y sigue las reglas actuales de energía." },
          { question: "¿Por qué una partida puede no dar recompensa?", answer: "La partida debe terminar dentro del límite, sin automatización, y superar la validación del servidor. Recargar la página no sustituye una confirmación autoritativa." },
          { question: "¿Cómo funcionan Sky Dash y Crypto 2048?", answer: "Sky Dash usa un impulso por toque o clic: atraviesa los huecos sin tocar los edificios. En Crypto 2048, desliza el tablero, combina monedas del mismo rango y alcanza la meta del nivel. En ambos, el resultado solo cuenta después de la validación del servidor." },
        ],
      },
      {
        label: "ECONOMÍA",
        title: "Pools, bloques y conversión",
        items: [
          { question: "¿Qué pools existen en Arcadia?", answer: "Puedes distribuir poder entre CMA, Bitcoin, Dogecoin y Litecoin. La distribución se define en la página de Pools y se aplica al poder válido de la cuenta." },
          { question: "¿Qué es CMA?", answer: "CMA es el crédito interno usado para compras y progresión del juego. No es una criptomoneda externa y no se puede retirar." },
          { question: "¿Cómo convierto BTC, DOGE o LTC a CMA?", answer: "Después de confirmar un depósito, elige la moneda, introduce una cantidad entera de CMA y revisa la cotización del servidor antes de confirmar." },
          { question: "¿Por qué puede cambiar el mínimo?", answer: "Los mínimos, las comisiones de red y las cotizaciones se muestran por moneda y pueden cambiar. La pantalla de depósito muestra la red correcta, el mínimo y la validez de la factura antes del envío." },
          { question: "¿Cómo funciona el enlace de referidos?", answer: "Cuando una cuenta entra por tu enlace y supera las comprobaciones de seguridad, recibes un bono por cada bloque validado por esa cuenta: 8% en CMA y 5% en BTC, DOGE y LTC. El operador invitado conserva la recompensa completa de su bloque; el bono no se acumula ni cambia el valor fijo del bloque." },
          { question: "¿Qué son las cajas y los loots?", answer: "Las cajas de suministros, cajas de suerte y cajas de temporada entregan objetos virtuales definidos por el servidor. La pantalla muestra los posibles contenidos y cada apertura queda registrada; ningún loot representa un retiro, una inversión o un rendimiento garantizado." },
        ],
      },
      {
        label: "BILLETERA",
        title: "Depósitos, retiros y soporte",
        items: [
          { question: "¿Cómo hago un depósito?", answer: "Abre la Billetera, elige la moneda y genera una factura. Envía solo la moneda y la red mostradas en la factura; el crédito aparece tras la confirmación del proveedor." },
          { question: "Mi depósito no aparece. ¿Qué hago?", answer: "Comprueba el ID de la factura, la red y el hash público de la transacción. Si el estado no cambia dentro del plazo indicado, abre un ticket de Soporte con esos datos; nunca envíes una contraseña o clave privada." },
          { question: "¿Cómo funcionan los retiros?", answer: "Las solicitudes de BTC, DOGE y LTC entran en una cola de revisión. El estado, la moneda y la referencia del pago quedan en el extracto de la cuenta." },
          { question: "¿Arcadia guarda mi clave privada?", answer: "No. Arcadia registra saldos y eventos en el libro mayor de la cuenta; nunca solicites ni compartas una frase semilla, contraseña o acceso remoto." },
        ],
      },
      {
        label: "TEMPORADA",
        title: "XP y Orbit Pass",
        items: [
          { question: "¿Cómo gano XP?", answer: "Las victorias autenticadas del Arcade, las misiones y las actividades elegibles otorgan XP. El progreso está vinculado a la cuenta y el cliente no puede fabricarlo." },
          { question: "¿Cuál es la diferencia entre el pase gratuito y el premium?", answer: "Ambos usan el mismo nivel de XP. El premium desbloquea la ruta de pago y también las recompensas gratuitas ya alcanzadas en ese nivel." },
          { question: "¿Las recompensas de temporada son permanentes?", answer: "Depende del objeto. Los mineros y objetos de inventario permanecen en la cuenta; el poder temporal y la energía caducan según la validez mostrada al reclamar." },
          { question: "¿Qué es AMC?", answer: "AMC es la moneda temporal de la temporada. Se recibe en el pase y solo se usa en la Tienda de Temporada para abrir cajas de piezas. No se puede retirar, convertir ni enviar a pools y se reinicia cuando termina la temporada." },
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
      <PublicInfoHeader label={locale === "pt-BR" ? "CENTRAL DE AJUDA" : locale === "es" ? "CENTRO DE AYUDA" : "HELP CENTER"} />

      <section className="public-info-hero faq-hero">
        <span>{copy.heroLabel}</span>
        <h1>{copy.heroTitle}</h1>
        <p>{copy.heroDescription}</p>
      </section>

      <div className="faq-section-grid">
        {copy.sections.map((section) => (
          <section className="faq-section-card" id={section.label === "ECONOMIA" || section.label === "ECONOMY" || section.label === "ECONOMÍA" ? "referrals" : undefined} key={section.label}>
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
