import { env } from "cloudflare:workers";
import { arcadiaSignInPath, getArcadiaUser } from "../identity-server";
import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";
import { readSupportEmailConfig } from "../support-email-server";
import { SupportRequestForm } from "./SupportRequestForm";

const supportTopics = [
  {
    title: "Conta e acesso",
    text: "Confirmação de e-mail, recuperação de senha, troca de dispositivo e vínculo do progresso da conta.",
  },
  {
    title: "Jogo e inventário",
    text: "Rack, mineradores, energia, salas, minigames, recompensas e divergências no histórico.",
  },
  {
    title: "Carteira e depósitos",
    text: "Status de faturas, confirmações BTC/DOGE/LTC, conversão para CMA e contestação de crédito.",
  },
  {
    title: "Segurança",
    text: "Conta comprometida, tentativa de fraude, site falso ou atividade automatizada suspeita.",
  },
];

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await getArcadiaUser();
  const emailConfig = readSupportEmailConfig(env);
  const emailDeliveryEnabled = emailConfig.enabled;

  return (
    <main className="public-info-page">
      <PublicInfoHeader label="CENTRAL DE SUPORTE" />

      <section className="public-info-hero">
        <span>AJUDA OFICIAL</span>
        <h1>Suporte claro antes e depois do lançamento.</h1>
        <p>
          Consulte orientações oficiais, abra um protocolo ligado à sua conta
          verificada e acompanhe os chamados recentes sem expor informações
          sensíveis.
        </p>
        <div className="support-contact-status">
          <strong>
            {emailDeliveryEnabled
              ? emailConfig.provider === "google_apps_script"
                ? "PROTOCOLO + GMAIL"
                : "PROTOCOLO + E-MAIL"
              : "PROTOCOLO INTERNO ATIVO"}
          </strong>
          <span>Atendimento dentro da sua conta</span>
          <small>
            {emailDeliveryEnabled
              ? "As respostas aparecem no site e também seguem por e-mail"
              : "Sem domínio por enquanto; abra e acompanhe tudo nesta página"}
          </small>
        </div>
      </section>

      <SupportRequestForm
        accountEmail={user?.email ?? null}
        emailDeliveryEnabled={emailDeliveryEnabled}
        loginPath={arcadiaSignInPath("/support")}
        signedIn={Boolean(user)}
      />

      <details className="support-guide-disclosure">
        <summary>
          <span>GUIAS E SEGURANÇA</span>
          <strong>Consultar assuntos, fluxo financeiro e perguntas frequentes</strong>
          <small>Abra somente quando precisar dessas orientações.</small>
        </summary>
        <div className="support-guide-content">
      <section className="support-topic-grid" aria-label="Assuntos de suporte">
        {supportTopics.map((topic, index) => (
          <article key={topic.title}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <h2>{topic.title}</h2>
            <p>{topic.text}</p>
          </article>
        ))}
      </section>

      <section className="public-document-section support-safety-flow">
        <header>
          <span>DEPÓSITO SEGURO</span>
          <h2>Como funciona a confirmação de crédito</h2>
        </header>
        <ol>
          <li>
            <strong>1. Fatura individual</strong>
            <p>O jogador solicita BTC, DOGE ou LTC e recebe uma cobrança única do provedor.</p>
          </li>
          <li>
            <strong>2. Confirmação externa</strong>
            <p>O provedor acompanha a rede. Prints e relatos do navegador não liberam saldo.</p>
          </li>
          <li>
            <strong>3. Crédito no livro-razão</strong>
            <p>O servidor registra um evento único e credita a conta correta sem duplicação.</p>
          </li>
          <li>
            <strong>4. Conversão opcional</strong>
            <p>O jogador pode converter saldo confirmado para CMA. CMA não é sacável.</p>
          </li>
        </ol>
      </section>

      <section className="public-document-grid">
        <article>
          <span>ALERTA DE FRAUDE</span>
          <h2>O Arcadia nunca solicita sua chave privada.</h2>
          <p>
            Não compartilhe seed phrase, código de autenticação, senha ou acesso
            remoto. Endereços de depósito só serão exibidos dentro da fatura do
            provedor, com valor e validade visíveis.
          </p>
        </article>
        <article>
          <span>PRAZO E PROVA</span>
          <h2>Guarde o identificador da operação.</h2>
          <p>
            Para localizar um depósito, o atendimento poderá pedir o ID da fatura
            e o hash público da transação. Nunca pedirá credenciais da carteira.
          </p>
        </article>
      </section>

      <section className="public-document-section support-faq">
        <header>
          <span>PERGUNTAS FREQUENTES</span>
          <h2>O que já está definido</h2>
        </header>
        <details>
          <summary>CMA pode ser sacado?</summary>
          <p>Não. CMA é um crédito interno do jogo e não possui saque.</p>
        </details>
        <details>
          <summary>O Arcadia cria uma carteira blockchain para cada usuário?</summary>
          <p>
            Não guarda chaves privadas. Cada usuário tem uma conta individual no
            livro-razão; o provedor de pagamentos gera faturas e endereços sob sua custódia.
          </p>
        </details>
        <details>
          <summary>Como são processados depósitos e saques?</summary>
          <p>
            Depósitos confirmados pelo provedor entram no extrato da conta. Saques
            BTC, DOGE e LTC seguem para a fila manual do fundador; o status de cada
            pedido permanece visível no histórico.
          </p>
        </details>
        <details>
          <summary>O jogo garante retorno financeiro?</summary>
          <p>
            Não. Poder, recompensas e itens são mecânicas de entretenimento e não
            constituem promessa de lucro, rendimento ou investimento.
          </p>
        </details>
      </section>
        </div>
      </details>

      <PublicSiteFooter />
    </main>
  );
}
