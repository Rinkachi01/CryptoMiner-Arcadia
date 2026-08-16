"use client";

import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";
import { useArcadiaLanguage, type ArcadiaLocale } from "../i18n";

type LegalSection = { title: string; body: string };
type LegalDocument = {
  id: string;
  label: string;
  title: string;
  sections: LegalSection[];
};

const legalCopy: Record<ArcadiaLocale, {
  headerLabel: string;
  heroLabel: string;
  heroTitle: string;
  heroDescription: string;
  updated: string;
  jumpLabel: string;
  warningLabel: string;
  warning: string;
  documents: LegalDocument[];
}> = {
  "pt-BR": {
    headerLabel: "DOCUMENTAÇÃO PÚBLICA",
    heroLabel: "REGRAS E TRANSPARÊNCIA",
    heroTitle: "Documentos claros para jogar com segurança.",
    heroDescription: "Aqui você encontra as regras de uso, privacidade, cookies, riscos e propriedade intelectual do Crypto Miner Arcadia.",
    updated: "ATUALIZADO · 15 DE AGOSTO DE 2026",
    jumpLabel: "Seções dos documentos",
    warningLabel: "ANTES DE OPERAR",
    warning: "O Arcadia é uma plataforma de entretenimento digital. CMA, poder, mineradores, energia e recompensas são elementos virtuais do jogo: não representam investimento, participação societária ou promessa de rendimento.",
    documents: [
      {
        id: "terms",
        label: "DOCUMENTO 01",
        title: "Termos de Uso",
        sections: [
          { title: "1. Natureza do serviço", body: "Crypto Miner Arcadia é um jogo de mineração virtual. Salas, racks, mineradores, energia, poder, CMA e itens de temporada fazem parte da experiência digital e podem seguir regras de balanceamento. Nenhum item do jogo representa depósito bancário, valor mobiliário ou rendimento garantido." },
          { title: "2. Conta e elegibilidade", body: "Você deve informar um e-mail válido, manter suas credenciais em segurança e usar uma única conta pessoal. O acesso com recursos financeiros é destinado a maiores de 18 anos ou à idade legal superior aplicável no local do usuário. Não compartilhe senha, código de autenticação ou acesso à conta." },
          { title: "3. Economia e pagamentos", body: "CMA é um crédito interno para compras e progressão e não pode ser sacado. Depósitos em BTC, DOGE e LTC, quando disponíveis, dependem da rede escolhida, do provedor de pagamentos, da confirmação on-chain, de limites e de taxas. O saldo só é creditado depois de uma confirmação válida e pode passar por análise de segurança." },
          { title: "4. Jogo justo e segurança", body: "Bots, scripts, automação de cliques, manipulação do cliente, exploração de falhas, contas coordenadas para burlar limites, chargebacks fraudulentos e qualquer tentativa de falsificar uma partida são proibidos. O servidor pode limitar, revisar ou suspender ações quando houver sinais de abuso, preservando os registros necessários." },
          { title: "5. Temporadas e recompensas", body: "XP, missões, passes, energia e poder temporário seguem as regras exibidas no jogo e a validação do servidor. Itens permanentes ficam no inventário; recompensas temporárias expiram conforme a validade apresentada no resgate. Regras e valores podem ser ajustados para eventos e blocos futuros, com comunicação adequada." },
          { title: "6. Disponibilidade e atendimento", body: "Podem ocorrer manutenções, atrasos de provedores e indisponibilidades de rede. O Arcadia não garante operação ininterrupta. Para contestar uma cobrança ou solicitar ajuda, use a Central de suporte e informe o protocolo; nunca envie chave privada ou seed phrase." },
          { title: "7. Informações corporativas", body: "O canal oficial de atendimento é support@cryptominerarcadia.com. Razão social, endereço e foro aplicável serão informados ou atualizados antes da operação comercial em cada jurisdição. As regras obrigatórias do país do usuário continuam aplicáveis." },
        ],
      },
      {
        id: "privacy",
        label: "DOCUMENTO 02",
        title: "Política de Privacidade",
        sections: [
          { title: "Dados que usamos", body: "Podemos tratar e-mail, nome de operador, sessão, identificadores técnicos, idioma, progresso, inventário, partidas, saldos, registros de livro-razão, IDs de faturas, protocolos de suporte e sinais de segurança. O Arcadia nunca solicita senha, seed phrase ou chave privada." },
          { title: "Para que usamos os dados", body: "Usamos esses dados para criar e proteger a conta, manter o jogo, validar partidas, calcular recompensas, processar pagamentos, prevenir fraude, responder suporte, corrigir erros e cumprir obrigações legais. Não vendemos dados pessoais como lista de marketing." },
          { title: "Prestadores e compartilhamento", body: "Cloudflare pode processar tráfego, proteção e hospedagem; Supabase pode processar autenticação e banco de dados; serviços de e-mail e pagamento processam os dados necessários a seus próprios fluxos. Compartilhamos somente o necessário para operar o serviço, cumprir a lei ou proteger usuários." },
          { title: "Retenção e seus direitos", body: "Histórico operacional exibido pode ser limitado a 30 dias. Registros financeiros, de segurança, suporte e auditoria podem ser mantidos por mais tempo quando necessário para prevenção de fraude, reconciliação ou obrigação legal. Você pode pedir acesso, correção ou exclusão pelo suporte, sujeito às retenções obrigatórias." },
          { title: "Segurança", body: "Aplicamos HTTPS, sessões verificadas, autorização no servidor, proteção contra abuso, limites de frequência, operações idempotentes, auditoria e cópias de recuperação. Nenhum sistema conectado à internet é infalível; incidentes serão tratados e comunicados conforme as regras aplicáveis." },
        ],
      },
      {
        id: "risk",
        label: "DOCUMENTO 03",
        title: "Aviso de Risco",
        sections: [
          { title: "Não é investimento", body: "O Arcadia oferece entretenimento digital. Não há promessa de lucro, retorno, valorização do CMA ou recuperação do valor pago por itens virtuais. Compras devem ser feitas apenas com recursos que você pode perder." },
          { title: "Cripto e conversões", body: "Preços, taxas, liquidez, tempo de confirmação e disponibilidade de BTC, DOGE e LTC variam. Uma conversão confirmada pode ser irreversível. O valor mostrado é uma cotação operacional do momento e não uma garantia de preço futuro." },
          { title: "Redes e endereços", body: "Envie somente o ativo e a rede exibidos na cobrança ou no saque. Uma rede incompatível, endereço incorreto ou memo ausente pode causar perda permanente e não é necessariamente recuperável pelo Arcadia ou pelo provedor." },
          { title: "Análises e restrições", body: "Provedores de pagamento e redes podem atrasar, recusar ou revisar uma transação. Limites, verificação de identidade, bloqueios regionais, impostos e obrigações de declaração podem ser aplicáveis ao usuário." },
        ],
      },
      {
        id: "cookies",
        label: "DOCUMENTO 04",
        title: "Política de Cookies",
        sections: [
          { title: "Cookies essenciais", body: "Cookies e armazenamento local essenciais mantêm a sessão, preferências de idioma e opções de leitura. Eles são necessários para autenticação e funcionamento básico da conta." },
          { title: "Publicidade e medição", body: "O Arcadia não ativa anúncios, scripts de publicidade ou cookies de publicidade nesta fase. Se uma ferramenta futura de medição ou anúncios for adicionada, ela será documentada por finalidade e submetida ao consentimento quando exigido." },
        ],
      },
      {
        id: "copyright",
        label: "DOCUMENTO 05",
        title: "Propriedade intelectual",
        sections: [
          { title: "Direitos do Arcadia", body: "© 2026 Crypto Miner Arcadia. Todos os direitos reservados. Código, identidade visual, textos, economia, layouts e ativos originais do projeto são protegidos e não podem ser copiados, redistribuídos ou explorados comercialmente sem autorização." },
          { title: "Marcas e ativos de terceiros", body: "Marcas, nomes e símbolos de criptomoedas pertencem a seus respectivos titulares e não indicam endosso. Ativos de terceiros usados no produto devem ser licenciados ou autorizados para o uso previsto." },
        ],
      },
    ],
  },
  en: {
    headerLabel: "PUBLIC DOCUMENTATION",
    heroLabel: "RULES AND TRANSPARENCY",
    heroTitle: "Clear documents for safer play.",
    heroDescription: "Find the Crypto Miner Arcadia rules for use, privacy, cookies, risk and intellectual property in one place.",
    updated: "UPDATED · AUGUST 15, 2026",
    jumpLabel: "Document sections",
    warningLabel: "BEFORE YOU OPERATE",
    warning: "Arcadia is a digital entertainment platform. CMA, power, miners, energy and rewards are virtual game elements: they are not an investment, equity interest or promise of returns.",
    documents: [
      {
        id: "terms",
        label: "DOCUMENT 01",
        title: "Terms of Use",
        sections: [
          { title: "1. Nature of the service", body: "Crypto Miner Arcadia is a virtual mining game. Rooms, racks, miners, energy, power, CMA and season items are part of the digital experience and may follow balancing rules. No game item represents a bank deposit, security or guaranteed return." },
          { title: "2. Account and eligibility", body: "You must provide a valid email, protect your credentials and use one personal account. Access involving financial features is intended for users aged 18 or the higher legal age that applies where they live. Never share your password, authentication code or account access." },
          { title: "3. Economy and payments", body: "CMA is an internal credit for purchases and progression and cannot be withdrawn. BTC, DOGE and LTC deposits, when available, depend on the selected network, payment provider, on-chain confirmation, limits and fees. Funds are credited only after a valid confirmation and may be reviewed for security." },
          { title: "4. Fair play and security", body: "Bots, scripts, click automation, client tampering, exploiting bugs, coordinated accounts used to bypass limits, fraudulent chargebacks and falsifying a game result are prohibited. The server may limit, review or suspend actions when abuse signals appear, while preserving required records." },
          { title: "5. Seasons and rewards", body: "XP, missions, passes, energy and temporary power follow the rules shown in the game and server validation. Permanent items remain in inventory; temporary rewards expire according to the validity shown at claim. Rules and values may change for future events and blocks with appropriate notice." },
          { title: "6. Availability and support", body: "Maintenance, provider delays and network outages can occur. Arcadia does not guarantee uninterrupted operation. To dispute a charge or request help, use Support and include the protocol ID; never send a private key or seed phrase." },
          { title: "7. Business information", body: "The official support channel is support@cryptominerarcadia.com. Corporate name, address and applicable forum will be published or updated before commercial operation in each jurisdiction. Mandatory rules in the user’s location still apply." },
        ],
      },
      {
        id: "privacy",
        label: "DOCUMENT 02",
        title: "Privacy Policy",
        sections: [
          { title: "Data we use", body: "We may process email, operator name, session, technical identifiers, language, progress, inventory, games, balances, ledger records, invoice IDs, support protocols and security signals. Arcadia never asks for a password, seed phrase or private key." },
          { title: "How we use data", body: "We use data to create and protect accounts, operate the game, validate games, calculate rewards, process payments, prevent abuse, answer support requests, fix errors and meet legal obligations. We do not sell personal data as a marketing list." },
          { title: "Providers and sharing", body: "Cloudflare may process traffic, protection and hosting; Supabase may process authentication and database services; email and payment providers process the data required for their flows. We share only what is needed to operate the service, comply with law or protect users." },
          { title: "Retention and your rights", body: "Visible operational history may be limited to 30 days. Financial, security, support and audit records may be kept longer when needed for fraud prevention, reconciliation or legal obligations. You may request access, correction or deletion through Support, subject to required retention." },
          { title: "Security", body: "We use HTTPS, verified sessions, server authorization, abuse protection, rate limits, idempotent operations, audit trails and recovery copies. No internet-connected system is infallible; incidents are handled and communicated under applicable rules." },
        ],
      },
      {
        id: "risk",
        label: "DOCUMENT 03",
        title: "Risk Disclosure",
        sections: [
          { title: "Not an investment", body: "Arcadia provides digital entertainment. It does not promise profit, return, CMA appreciation or recovery of amounts spent on virtual items. Only use funds you can afford to lose." },
          { title: "Crypto and conversions", body: "Prices, fees, liquidity, confirmation times and availability for BTC, DOGE and LTC vary. A confirmed conversion may be irreversible. The displayed value is an operational quote at that time, not a promise of a future price." },
          { title: "Networks and addresses", body: "Send only the asset and network shown on the invoice or withdrawal screen. A wrong network, address or missing memo can cause permanent loss and may not be recoverable by Arcadia or the provider." },
          { title: "Reviews and restrictions", body: "Payment providers and networks may delay, reject or review a transaction. Limits, identity checks, regional restrictions, taxes and reporting duties may apply to the user." },
        ],
      },
      {
        id: "cookies",
        label: "DOCUMENT 04",
        title: "Cookie Policy",
        sections: [
          { title: "Essential cookies", body: "Essential cookies and local storage keep the session, language preference and reading options. They are required for authentication and basic account operation." },
          { title: "Advertising and measurement", body: "Arcadia does not activate ads, advertising scripts or advertising cookies at this stage. If measurement or advertising is added later, it will be documented by purpose and consented to where required." },
        ],
      },
      {
        id: "copyright",
        label: "DOCUMENT 05",
        title: "Intellectual Property",
        sections: [
          { title: "Arcadia rights", body: "© 2026 Crypto Miner Arcadia. The project’s code, visual identity, text, economy, layouts and original assets are protected and may not be copied, redistributed or commercially exploited without permission." },
          { title: "Third-party marks and assets", body: "Cryptocurrency names, marks and symbols belong to their respective owners and do not imply endorsement. Third-party assets used in the product must be licensed or authorized for the intended use." },
        ],
      },
    ],
  },
};

export default function LegalPage() {
  const { locale } = useArcadiaLanguage();
  const copy = legalCopy[locale];

  return (
    <main className="public-info-page legal-page">
      <PublicInfoHeader label={copy.headerLabel} />

      <section className="public-info-hero">
        <span>{copy.heroLabel} · {copy.updated}</span>
        <h1>{copy.heroTitle}</h1>
        <p>{copy.heroDescription}</p>
        <nav className="legal-jump-links" aria-label={copy.jumpLabel}>
          {copy.documents.map((document) => (
            <a href={`#${document.id}`} key={document.id}>{document.title.toUpperCase()}</a>
          ))}
        </nav>
      </section>

      <section className="legal-warning" aria-label={copy.warningLabel}>
        <strong>{copy.warningLabel}</strong>
        <p>{copy.warning}</p>
      </section>

      {copy.documents.map((document) => (
        <article className="public-legal-document" id={document.id} key={document.id}>
          <header>
            <span>{document.label}</span>
            <h2>{document.title}</h2>
          </header>
          {document.sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </article>
      ))}

      <PublicSiteFooter />
    </main>
  );
}
