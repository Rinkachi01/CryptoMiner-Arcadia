"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  supportCategories,
  supportCategoryLabels,
  type SupportCategory,
} from "../support-rules";

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

function formatTicketDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
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
      if (!response.ok) throw new Error(data.error ?? "Chamado não enviado.");
      setStatusMessage(
        `${data.message ?? "Chamado registrado."} Protocolo ${data.publicId}.`,
      );
      setSubject("");
      setMessage("");
      if (data.tickets) setTickets(data.tickets);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o chamado.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="support-request-center">
      <header>
        <div>
          <span>ATENDIMENTO SEGURO</span>
          <h2>Fale com nossa equipe</h2>
          <p>
            Sua solicitação fica ligada à conta verificada. Nunca envie senha,
            código de acesso ou chave privada.
          </p>
        </div>
        <div className="ready">
          <strong>ATENDIMENTO ATIVO</strong>
          <small>Acompanhe o andamento e as respostas nesta página.</small>
        </div>
      </header>

      {!signedIn ? (
        <div className="support-signin-required">
          <span>CONTA NECESSÁRIA</span>
          <h3>Entre para criar um protocolo seguro.</h3>
          <p>
            Se você perdeu a senha, use primeiro a recuperação. O suporte não
            redefine credenciais manualmente e não pede dados secretos.
          </p>
          <div>
            <a href={loginPath}>ENTRAR NA CONTA</a>
            <a className="secondary" href="/auth?mode=reset">RECUPERAR SENHA</a>
          </div>
        </div>
      ) : (
        <div className="support-request-layout">
          <form onSubmit={submit}>
            <div className="support-account-chip">
              <span>CONTA VERIFICADA</span>
              <strong>{accountEmail}</strong>
            </div>
            <label>
              Assunto
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as SupportCategory)
                }
              >
                {supportCategories.map((item) => (
                  <option value={item} key={item}>
                    {supportCategoryLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Título do problema
              <input
                maxLength={100}
                minLength={5}
                required
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
            <label>
              O que aconteceu?
              <textarea
                maxLength={2_000}
                minLength={20}
                required
                rows={7}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <small>{message.length}/2.000 caracteres</small>
            </label>
            {statusMessage && (
              <div className="support-form-message" role="status">
                {statusMessage}
              </div>
            )}
            <button type="submit" disabled={busy}>
              {busy ? "REGISTRANDO..." : "CRIAR PROTOCOLO"}
            </button>
          </form>

          <aside className="support-ticket-history">
            <header>
              <span>MEUS PROTOCOLOS</span>
              <strong>
                {unreadReplies > 0
                  ? `${unreadReplies} NOVA${unreadReplies > 1 ? "S" : ""}`
                  : `${tickets.length} RECENTES`}
              </strong>
            </header>
            {tickets.length === 0 ? (
              <div className="support-ticket-empty">
                <b>00</b>
                <p>Seus chamados aparecerão aqui depois do primeiro envio.</p>
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
                      {statusLabels[ticket.status] ?? ticket.status.toUpperCase()}
                    </b>
                  </div>
                  <h3>{ticket.subject}</h3>
                  <p>{ticket.message}</p>
                  {ticket.adminReply && (
                    <div className="support-ticket-reply">
                      <span>
                        {ticket.replyUnread
                          ? "NOVA RESPOSTA DO ARCADIA"
                          : "RESPOSTA DO ARCADIA"}
                      </span>
                      <p>{ticket.adminReply}</p>
                      {ticket.lastReplyAt && (
                        <small>{formatTicketDate(ticket.lastReplyAt)}</small>
                      )}
                    </div>
                  )}
                  <small>
                    {supportCategoryLabels[ticket.category as SupportCategory] ??
                      ticket.category}
                    {" · "}
                    {formatTicketDate(ticket.createdAt)}
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
