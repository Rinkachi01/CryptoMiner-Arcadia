"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  remove(widgetId: string): void;
  render(
    element: HTMLElement,
    options: {
      action: string;
      callback(token: string): void;
      "error-callback"(): void;
      "expired-callback"(): void;
      sitekey: string;
      theme: "dark";
    },
  ): string;
  reset(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileWidget({
  action,
  className,
  onError,
  onToken,
  resetSignal = 0,
  siteKey,
}: {
  action: string;
  className?: string;
  onError(message: string): void;
  onToken(token: string): void;
  resetSignal?: number;
  siteKey: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onErrorRef.current = onError;
    onTokenRef.current = onToken;
  }, [onError, onToken]);

  useEffect(() => {
    let disposed = false;
    const render = () => {
      if (disposed || !window.turnstile || !mountRef.current || widgetRef.current) {
        return;
      }
      widgetRef.current = window.turnstile.render(mountRef.current, {
        action,
        callback: (token) => onTokenRef.current(token),
        "error-callback": () =>
          onErrorRef.current("O desafio não carregou. Tente novamente."),
        "expired-callback": () => onTokenRef.current(""),
        sitekey: siteKey,
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
        () =>
          onErrorRef.current("Não foi possível carregar a verificação humana."),
        { once: true },
      );
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      existing?.removeEventListener("load", render);
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
      onTokenRef.current("");
    };
  }, [action, siteKey]);

  useEffect(() => {
    if (!resetSignal || !widgetRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetRef.current);
    onTokenRef.current("");
  }, [resetSignal]);

  return <div ref={mountRef} className={className} />;
}
