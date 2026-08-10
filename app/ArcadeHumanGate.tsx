"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TurnstileWidget } from "./TurnstileWidget";

type SecurityStatus = {
  configured: boolean;
  required: boolean;
  siteKey: string | null;
  verified: boolean;
};

export default function ArcadeHumanGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/security", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as SecurityStatus & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao consultar a proteção.");
        if (active) setStatus(payload);
      })
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, []);

  const verify = useCallback(async (token: string) => {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/security", {
        body: JSON.stringify({ token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Verificação recusada.");
      }
      setStatus((current) => current && { ...current, verified: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verificação recusada.");
      setCaptchaReset((current) => current + 1);
    } finally {
      setChecking(false);
    }
  }, []);

  if (!status && !error) {
    return <div className="arcade-human-loading">Verificando proteção do Arcade…</div>;
  }
  if (status && (!status.required || status.verified)) return <>{children}</>;

  return (
    <section className="arcade-human-gate" aria-live="polite">
      <span>PROTEÇÃO DO ARCADE</span>
      <h3>Confirme que você é humano</h3>
      <p>
        Esta etapa protege as recompensas e o poder da rede contra robôs. A
        aprovação vale por 4 horas e a resposta não fica armazenada.
      </p>
      {status?.configured && status.siteKey ? (
        <TurnstileWidget
          action="arcade_access"
          className="arcade-turnstile"
          onError={setError}
          onToken={(token) => token && void verify(token)}
          resetSignal={captchaReset}
          siteKey={status.siteKey}
        />
      ) : (
        <strong>O Arcade está temporariamente pausado pelo operador.</strong>
      )}
      {checking && <small>Validando com o servidor…</small>}
      {error && <small className="error">{error}</small>}
    </section>
  );
}
