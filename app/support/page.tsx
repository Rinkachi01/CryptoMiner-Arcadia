import { cookies } from "next/headers";
import { arcadiaSignInPath, getArcadiaUser } from "../identity-server";
import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";
import { SupportRequestForm } from "./SupportRequestForm";

const supportTopics = [
  {
    title: "Conta e acesso",
    titleEn: "Account and access",
    text: "Confirmação de e-mail, recuperação de senha, troca de dispositivo e vínculo do progresso da conta.",
    textEn: "Email confirmation, password recovery, device changes, and account progress linking.",
  },
  {
    title: "Jogo e inventário",
    titleEn: "Game and inventory",
    text: "Rack, mineradores, energia, salas, minigames, recompensas e divergências no histórico.",
    textEn: "Racks, miners, energy, rooms, minigames, rewards, and history discrepancies.",
  },
  {
    title: "Carteira e depósitos",
    titleEn: "Wallet and deposits",
    text: "Status de faturas, confirmações BTC/DOGE/LTC, conversão para CMA e contestação de crédito.",
    textEn: "Invoice status, BTC/DOGE/LTC confirmations, CMA conversion, and credit disputes.",
  },
  {
    title: "Segurança",
    titleEn: "Security",
    text: "Conta comprometida, tentativa de fraude, site falso ou atividade automatizada suspeita.",
    textEn: "Compromised accounts, fraud attempts, fake sites, or suspicious automated activity.",
  },
];

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await getArcadiaUser();
  const locale = (await cookies()).get("arcadia_locale")?.value;
  const english = locale !== "pt-BR";

  return (
    <main className="public-info-page">
      <PublicInfoHeader label={english ? "SUPPORT CENTER" : "CENTRAL DE SUPORTE"} />

      <section className="public-info-hero">
        <span>{english ? "OFFICIAL HELP" : "AJUDA OFICIAL"}</span>
        <h1>{english ? "We are here to help." : "Estamos aqui para ajudar."}</h1>
        <p>
          {english
            ? "Find answers, contact our team, and track your requests securely through your verified account."
            : "Encontre respostas, fale com nossa equipe e acompanhe suas solicitações com segurança, sempre pela sua conta verificada."}
        </p>
        <div className="support-contact-status">
          <strong>{english ? "SUPPORT ACTIVE" : "ATENDIMENTO ATIVO"}</strong>
          <span>{english ? "Replies are tracked in your account" : "Resposta acompanhada dentro da sua conta"}</span>
          <small>{english ? "Your requests and replies stay together on this page." : "Suas solicitações e respostas ficam reunidas nesta página."}</small>
        </div>
      </section>

      <SupportRequestForm
        accountEmail={user?.email ?? null}
        loginPath={arcadiaSignInPath("/support")}
        signedIn={Boolean(user)}
      />

      <details className="support-guide-disclosure">
        <summary>
          <span>{english ? "USEFUL INFORMATION" : "INFORMAÇÕES ÚTEIS"}</span>
          <strong>{english ? "Common topics and account safety" : "Assuntos frequentes e cuidados com a conta"}</strong>
          <small>{english ? "Open this only when you need a quick answer." : "Abra somente quando precisar consultar uma resposta rápida."}</small>
        </summary>
        <div className="support-guide-content">
      <section className="support-topic-grid" aria-label="Assuntos de suporte">
        {supportTopics.map((topic, index) => (
          <article key={topic.title}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <h2>{english ? topic.titleEn : topic.title}</h2>
            <p>{english ? topic.textEn : topic.text}</p>
          </article>
        ))}
      </section>

      <section className="public-document-section support-safety-flow">
        <header>
          <span>{english ? "DEPOSITS" : "DEPÓSITOS"}</span>
          <h2>{english ? "How a confirmation appears in your account" : "Como uma confirmação aparece na sua conta"}</h2>
        </header>
        <ol>
          <li>
            <strong>{english ? "1. Choose the coin" : "1. Escolha a moeda"}</strong>
            <p>{english ? "Select BTC, DOGE, or LTC in your wallet and check the amount before paying." : "Selecione BTC, DOGE ou LTC na carteira e confira o valor antes de pagar."}</p>
          </li>
          <li>
            <strong>{english ? "2. Wait for confirmation" : "2. Aguarde a confirmação"}</strong>
            <p>{english ? "After network confirmation, the operation status updates automatically." : "Após a confirmação da rede, o status da operação é atualizado automaticamente."}</p>
          </li>
          <li>
            <strong>{english ? "3. Check the ledger" : "3. Consulte o extrato"}</strong>
            <p>{english ? "The confirmed balance appears in the same coin ledger, without automatic conversion." : "O saldo confirmado aparece no extrato da mesma moeda, sem conversão automática."}</p>
          </li>
          <li>
            <strong>{english ? "4. Convert when you want" : "4. Converta quando quiser"}</strong>
            <p>{english ? "After confirmation, you can convert whole units to CMA." : "Depois da confirmação, você pode converter unidades inteiras para CMA."}</p>
          </li>
        </ol>
      </section>

      <section className="public-document-grid">
        <article>
          <span>{english ? "FRAUD ALERT" : "ALERTA DE FRAUDE"}</span>
          <h2>{english ? "Arcadia never asks for your private key." : "O Arcadia nunca solicita sua chave privada."}</h2>
          <p>
            {english
              ? "Do not share a seed phrase, authentication code, password, or remote access. Deposit addresses appear only inside the provider invoice with the amount and expiry visible."
              : "Não compartilhe seed phrase, código de autenticação, senha ou acesso remoto. Endereços de depósito só serão exibidos dentro da fatura do provedor, com valor e validade visíveis."}
          </p>
        </article>
        <article>
          <span>{english ? "TIMING AND PROOF" : "PRAZO E PROVA"}</span>
          <h2>{english ? "Keep the operation identifier." : "Guarde o identificador da operação."}</h2>
          <p>
            {english
              ? "To locate a deposit, support may ask for the invoice ID and public transaction hash. We never ask for wallet credentials."
              : "Para localizar um depósito, o atendimento poderá pedir o ID da fatura e o hash público da transação. Nunca pedirá credenciais da carteira."}
          </p>
        </article>
      </section>

      <section className="public-document-section support-faq">
        <header>
          <span>{english ? "FREQUENT QUESTIONS" : "PERGUNTAS FREQUENTES"}</span>
          <h2>{english ? "What is already defined" : "O que já está definido"}</h2>
        </header>
        <details>
          <summary>{english ? "Can CMA be withdrawn?" : "CMA pode ser sacado?"}</summary>
          <p>{english ? "No. CMA is an internal game credit and cannot be withdrawn." : "Não. CMA não é sacável: é um crédito interno do jogo e não possui saque."}</p>
        </details>
        <details>
          <summary>{english ? "Does Arcadia create a blockchain wallet for each user?" : "O Arcadia cria uma carteira blockchain para cada usuário?"}</summary>
          <p>
            {english
              ? "No private keys are stored. Each user has an individual ledger account; the payment provider creates invoices and addresses under its custody."
              : "Não guarda chaves privadas. Cada usuário tem uma conta individual no livro-razão; o provedor de pagamentos gera faturas e endereços sob sua custódia."}
          </p>
        </details>
        <details>
          <summary>{english ? "How are deposits and withdrawals processed?" : "Como são processados depósitos e saques?"}</summary>
          <p>
            {english
              ? "Confirmed deposits enter the account ledger. BTC, DOGE, and LTC withdrawals remain visible in the wallet with each request status."
              : "Depósitos confirmados entram no extrato da conta. Saques BTC, DOGE e LTC ficam visíveis na carteira e mostram o status de cada solicitação."}
          </p>
        </details>
        <details>
          <summary>{english ? "Does the game guarantee financial returns?" : "O jogo garante retorno financeiro?"}</summary>
          <p>
            {english
              ? "No. Power, rewards, and items are entertainment mechanics and are not a promise of profit, yield, or investment."
              : "Não. Poder, recompensas e itens são mecânicas de entretenimento e não constituem promessa de lucro, rendimento ou investimento."}
          </p>
        </details>
      </section>
        </div>
      </details>

      <PublicSiteFooter />
    </main>
  );
}
