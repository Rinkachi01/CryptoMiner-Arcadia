"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type SecurityStatus = {
  configured: boolean;
  required: boolean;
  siteKey: string | null;
  verified: boolean;
};

type TurnstileApi = {
  remove(widgetId: string): void;
  render(
    element: HTMLElement,
    options: {
      action: string;
      callback(token: string): void;
      "error-callback"(): void;
      sitekey: string;
      theme: "dark";
    },
  ): string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function ArcadeHumanGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);

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
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!status?.required || status.verified || !status.siteKey || !mountRef.current) {
      return;
    }
    let disposed = false;
    const render = () => {
      if (disposed || !window.turnstile || !mountRef.current || widgetRef.current) return;
      widgetRef.current = window.turnstile.render(mountRef.current, {
        action: "arcade_access",
        callback: (token) => void verify(token),
        "error-callback": () => setError("O desafio não carregou. Tente novamente."),
        sitekey: status.siteKey!,
        theme: "dark",
      });
    };
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT}"]`,
    );
    if (existing) {
      if (window.turnstile) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render, { once: true });
      script.addEventListener(
        "error",
        () => setError("Não foi possível carregar a verificação humana."),
        { once: true },
      );
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [status, verify]);

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
        aprovação vale por 12 horas e a resposta não fica armazenada.
      </p>
      {status?.configured && status.siteKey ? (
        <div ref={mountRef} className="arcade-turnstile" />
      ) : (
        <strong>O Arcade está temporariamente pausado pelo operador.</strong>
      )}
      {checking && <small>Validando com o servidor…</small>}
      {error && <small className="error">{error}</small>}
    </section>
  );
}
