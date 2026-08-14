import { arcadiaSignInPath, getArcadiaUser } from "../identity-server";
import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";
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

  return (
    <main className="public-info-page">
      <PublicInfoHeader label="CENTRAL DE SUPORTE" />

      <section className="public-info-hero">
        <span>AJUDA OFICIAL</span>
        <h1>Estamos aqui para ajudar.</h1>
        <p>
          Encontre respostas, fale com nossa equipe e acompanhe suas solicitações
          com segurança, sempre pela sua conta verificada.
        </p>
        <div className="support-contact-status">
          <strong>ATENDIMENTO ATIVO</strong>
          <span>Resposta acompanhada dentro da sua conta</span>
          <small>Suas solicitações e respostas ficam reunidas nesta página.</small>
        </div>
      </section>

      <SupportRequestForm
        accountEmail={user?.email ?? null}
        loginPath={arcadiaSignInPath("/support")}
        signedIn={Boolean(user)}
      />

      <details className="support-guide-disclosure">
        <summary>
          <span>INFORMAÇÕES ÚTEIS</span>
          <strong>Assuntos frequentes e cuidados com a conta</strong>
          <small>Abra somente quando precisar consultar uma resposta rápida.</small>
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
          <span>DEPÓSITOS</span>
          <h2>Como uma confirmação aparece na sua conta</h2>
        </header>
        <ol>
          <li>
            <strong>1. Escolha a moeda</strong>
            <p>Selecione BTC, DOGE ou LTC na carteira e confira o valor antes de pagar.</p>
          </li>
          <li>
            <strong>2. Aguarde a confirmação</strong>
            <p>Após a confirmação da rede, o status da operação é atualizado automaticamente.</p>
          </li>
          <li>
            <strong>3. Consulte o extrato</strong>
            <p>O saldo confirmado aparece no extrato da mesma moeda, sem conversão automática.</p>
          </li>
          <li>
            <strong>4. Converta quando quiser</strong>
            <p>Depois da confirmação, você pode converter unidades inteiras para CMA.</p>
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
          <p>Não. CMA não é sacável: é um crédito interno do jogo e não possui saque.</p>
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
            Depósitos confirmados entram no extrato da conta. Saques BTC, DOGE e LTC
            ficam visíveis na carteira e mostram o status de cada solicitação.
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
