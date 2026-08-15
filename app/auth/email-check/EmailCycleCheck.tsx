"use client";

import { useEffect, useState } from "react";

type Props = { email: string; next: string };

type StatusResponse = {
  enabled?: boolean;
  verified?: boolean;
  retryAt?: number | null;
};

function messageFor(status: string) {
  switch (status) {
    case "cooldown":
      return "Um código já foi enviado. Aguarde um instante antes de pedir outro.";
    case "too_many_attempts":
      return "Limite de tentativas atingido. Solicite um novo código.";
    case "configuration_pending":
      return "O envio de e-mail está temporariamente indisponível. Tente novamente mais tarde.";
    case "invalid_or_expired":
    case "invalid_code":
      return "Código inválido ou expirado.";
    default:
      return "Não foi possível concluir agora. Tente novamente.";
  }
}

export function EmailCycleCheck({ email, next }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  async function sendCode() {
    setSending(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch("/api/auth/email-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        status?: string;
        retryAt?: number;
      };
      if (result.status === "verified") {
        window.location.assign(next);
        return;
      }
      if (!response.ok) {
        setError(messageFor(result.status ?? "failed"));
        if (result.retryAt) setRetryAt(result.retryAt);
        return;
      }
      setRetryAt(result.retryAt ?? Date.now() + 60_000);
      setInfo("Código enviado. Confira sua caixa de entrada e o spam.");
    } catch {
      setError("Não foi possível enviar o código agora.");
    } finally {
      setSending(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/email-cycle", { cache: "no-store" })
      .then((response) => response.json() as Promise<StatusResponse>)
      .then((status) => {
        if (cancelled) return;
        if (status.verified) {
          window.location.assign(next);
          return;
        }
        void sendCode();
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError("Não foi possível preparar a verificação.");
        }
      });
    return () => {
      cancelled = true;
    };
    // The send action intentionally runs once for the current cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = retryAt ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)) : 0;
      setSeconds(left);
    }, 500);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/email-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
      };
      if (!response.ok || !result.ok) {
        setError(messageFor(result.status ?? "failed"));
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Não foi possível validar o código agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="email-cycle-card" aria-labelledby="email-cycle-title">
      <div className="email-cycle-eyebrow">SEGURANÇA DA CONTA</div>
      <h1 id="email-cycle-title">Confirme seu e-mail</h1>
      <p>
        Para manter sua conta protegida, confirme o código enviado para <strong>{email}</strong>.
      </p>
      <form onSubmit={verify}>
        <label htmlFor="email-cycle-code">Código de 6 dígitos</label>
        <input
          id="email-cycle-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]{6}"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          disabled={loading}
        />
        <button type="submit" disabled={loading || code.length !== 6}>
          {loading ? "VALIDANDO…" : "CONFIRMAR E CONTINUAR"}
        </button>
      </form>
      {info && <p className="email-cycle-info" role="status">{info}</p>}
      {error && <p className="email-cycle-error" role="alert">{error}</p>}
      <button
        type="button"
        className="email-cycle-resend"
        disabled={sending || seconds > 0}
        onClick={() => void sendCode()}
      >
        {seconds > 0 ? `REENVIAR EM ${seconds}s` : sending ? "ENVIANDO…" : "REENVIAR CÓDIGO"}
      </button>
      <p className="email-cycle-note">O código expira em 10 minutos. O MFA continua sendo a proteção mais forte quando ativado.</p>
    </section>
  );
}
