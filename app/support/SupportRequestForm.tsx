"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  supportCategories,
  supportCategoryLabels,
  type SupportCategory,
} from "../support-rules";
import { useArcadiaLanguage } from "../i18n";

type PersonalTicket = {
  adminReply: string | null;
  category: string;
  createdAt: number;
  deliveryStatus: string;
  lastReplyAt: number | null;
  message: string;
  playerSeenReplyAt: number | null;
  publicId: string;
  replyDeliveryStatus: string;
  replyUnread: boolean;
  status: string;
  subject: string;
  updatedAt: number;
};

function formatTicketDate(timestamp: number, english: boolean) {
  return new Intl.DateTimeFormat(english ? "en-US" : "pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

const statusLabels: Record<string, string> = {
  closed: "ENCERRADO",
  open: "ABERTO",
  resolved: "RESOLVIDO",
  reviewing: "EM ANÁLISE",
};

export function SupportRequestForm({
  accountEmail,
  loginPath,
  signedIn,
}: {
  accountEmail: string | null;
  loginPath: string;
  signedIn: boolean;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const categoryLabels: Record<SupportCategory, string> = {
    account: english ? "Account and access" : supportCategoryLabels.account,
    game: english ? "Game and inventory" : supportCategoryLabels.game,
    wallet: english ? "Wallet and conversions" : supportCategoryLabels.wallet,
    security: english ? "Security" : supportCategoryLabels.security,
    other: english ? "Other topic" : supportCategoryLabels.other,
  };
  const localizedStatusLabels: Record<string, string> = {
    closed: english ? "CLOSED" : statusLabels.closed,
    open: english ? "OPEN" : statusLabels.open,
    resolved: english ? "RESOLVED" : statusLabels.resolved,
    reviewing: english ? "IN REVIEW" : statusLabels.reviewing,
  };
  const [category, setCategory] = useState<SupportCategory>("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [tickets, setTickets] = useState<PersonalTicket[]>([]);
  const [unreadReplies, setUnreadReplies] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    void fetch("/api/support", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          tickets?: PersonalTicket[];
          unreadReplies?: number;
        };
        if (response.ok && data.tickets) {
          setTickets(data.tickets);
          const unread = Math.max(0, Number(data.unreadReplies ?? 0));
          setUnreadReplies(unread);
          if (unread > 0) {
            void fetch("/api/support", { method: "PATCH" }).catch(
              () => undefined,
            );
          }
        }
      })
      .catch(() => undefined);
  }, [signedIn]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, subject }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        publicId?: string;
        tickets?: PersonalTicket[];
      };
      if (!response.ok) throw new Error(data.error ?? (english ? "Ticket was not sent." : "Chamado não enviado."));
      setStatusMessage(
        `${data.message ?? (english ? "Ticket created." : "Chamado registrado.")} ${english ? "Protocol" : "Protocolo"} ${data.publicId}.`,
      );
      setSubject("");
      setMessage("");
      if (data.tickets) setTickets(data.tickets);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : english ? "We could not create the ticket." : "Não foi possível registrar o chamado.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="support-request-center">
      <header>
        <div>
          <span>{english ? "SECURE SUPPORT" : "ATENDIMENTO SEGURO"}</span>
          <h2>{english ? "Contact our team" : "Fale com nossa equipe"}</h2>
          <p>
            {english
              ? "Your request is linked to your verified account. Never send a password, access code, or private key."
              : "Sua solicitação fica ligada à conta verificada. Nunca envie senha, código de acesso ou chave privada."}
          </p>
        </div>
        <div className="ready">
          <strong>{english ? "SUPPORT ACTIVE" : "ATENDIMENTO ATIVO"}</strong>
          <small>{english ? "Track progress and replies on this page." : "Acompanhe o andamento e as respostas nesta página."}</small>
        </div>
      </header>

      {!signedIn ? (
        <div className="support-signin-required">
          <span>{english ? "ACCOUNT REQUIRED" : "CONTA NECESSÁRIA"}</span>
          <h3>{english ? "Sign in to create a secure ticket." : "Entre para criar um protocolo seguro."}</h3>
          <p>
            {english
              ? "If you lost your password, use recovery first. Support does not reset credentials manually or ask for secret data."
              : "Se você perdeu a senha, use primeiro a recuperação. O suporte não redefine credenciais manualmente e não pede dados secretos."}
          </p>
          <div>
            <a href={loginPath}>{english ? "SIGN IN TO YOUR ACCOUNT" : "ENTRAR NA CONTA"}</a>
            <a className="secondary" href="/auth?mode=reset">{english ? "RECOVER PASSWORD" : "RECUPERAR SENHA"}</a>
          </div>
        </div>
      ) : (
        <div className="support-request-layout">
          <form onSubmit={submit}>
            <div className="support-account-chip">
              <span>{english ? "VERIFIED ACCOUNT" : "CONTA VERIFICADA"}</span>
              <strong>{accountEmail}</strong>
            </div>
            <label>
              {english ? "Topic" : "Assunto"}
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as SupportCategory)
                }
              >
                {supportCategories.map((item) => (
                  <option value={item} key={item}>
                    {categoryLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {english ? "Problem title" : "Título do problema"}
              <input
                maxLength={100}
                minLength={5}
                required
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
            <label>
              {english ? "What happened?" : "O que aconteceu?"}
              <textarea
                maxLength={2_000}
                minLength={20}
                required
                rows={7}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <small>{message.length}/2,000 {english ? "characters" : "caracteres"}</small>
            </label>
            {statusMessage && (
              <div className="support-form-message" role="status">
                {statusMessage}
              </div>
            )}
            <button type="submit" disabled={busy}>
              {busy ? (english ? "CREATING..." : "REGISTRANDO...") : (english ? "CREATE TICKET" : "CRIAR PROTOCOLO")}
            </button>
          </form>

          <aside className="support-ticket-history">
            <header>
              <span>{english ? "MY TICKETS" : "MEUS PROTOCOLOS"}</span>
              <strong>
                {unreadReplies > 0
                  ? english
                    ? `${unreadReplies} NEW ${unreadReplies === 1 ? "REPLY" : "REPLIES"}`
                    : `${unreadReplies} NOVA${unreadReplies > 1 ? "S" : ""}`
                  : english ? `${tickets.length} RECENT` : `${tickets.length} RECENTES`}
              </strong>
            </header>
            {tickets.length === 0 ? (
              <div className="support-ticket-empty">
                <b>00</b>
                <p>{english ? "Your tickets will appear here after your first submission." : "Seus chamados aparecerão aqui depois do primeiro envio."}</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <article
                  className={ticket.replyUnread ? "reply-unread" : ""}
                  key={ticket.publicId}
                >
                  <div>
                    <span>{ticket.publicId}</span>
                    <b className={ticket.status}>
                      {localizedStatusLabels[ticket.status] ?? ticket.status.toUpperCase()}
                    </b>
                  </div>
                  <h3>{ticket.subject}</h3>
                  <p>{ticket.message}</p>
                  {ticket.adminReply && (
                    <div className="support-ticket-reply">
                      <span>
                        {ticket.replyUnread
                          ? english ? "NEW ARCADIA REPLY" : "NOVA RESPOSTA DO ARCADIA"
                          : english ? "ARCADIA REPLY" : "RESPOSTA DO ARCADIA"}
                      </span>
                      <p>{ticket.adminReply}</p>
                      {ticket.lastReplyAt && (
                        <small>{formatTicketDate(ticket.lastReplyAt, english)}</small>
                      )}
                    </div>
                  )}
                  <small>
                    {categoryLabels[ticket.category as SupportCategory] ??
                      ticket.category}
                    {" · "}
                    {formatTicketDate(ticket.createdAt, english)}
                  </small>
                </article>
              ))
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
