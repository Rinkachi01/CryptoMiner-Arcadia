"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useMemo, useState } from "react";

type MfaChallengeProps = {
  next: string;
  publishableKey: string;
  supabaseUrl: string;
};

export function MfaChallenge({
  next,
  publishableKey,
  supabaseUrl,
}: MfaChallengeProps) {
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, publishableKey),
    [publishableKey, supabaseUrl],
  );
  const [busy, setBusy] = useState(true);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp?.find((item) => item.status === "verified");
      if (!active) return;
      if (error || !factor) {
        setMessage("Não encontramos um autenticador ativo para esta conta. Volte ao perfil e configure a proteção novamente.");
        setBusy(false);
        return;
      }
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (!active) return;
      if (challenge.error || !challenge.data?.id) {
        setMessage("Não foi possível iniciar a verificação. Tente entrar novamente.");
        setBusy(false);
        return;
      }
      setFactorId(factor.id);
      setChallengeId(challenge.data.id);
      setBusy(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !challengeId || code.length !== 6) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.mfa.verify({
      challengeId,
      code,
      factorId,
    });
    if (error) {
      setMessage("Código inválido ou expirado. Confira o aplicativo autenticador e tente novamente.");
      setCode("");
      setBusy(false);
      return;
    }
    window.location.assign(next);
  }

  return (
    <section className="mfa-challenge-card" aria-labelledby="mfa-title">
      <span className="mfa-kicker">CONTA PROTEGIDA</span>
      <h1 id="mfa-title">Confirme sua identidade</h1>
      <p>Digite o código de seis dígitos exibido no seu aplicativo autenticador para continuar.</p>
      {message && <div className="public-auth-message" role="alert">{message}</div>}
      {factorId && challengeId ? (
        <form onSubmit={verify}>
          <label>
            Código do autenticador
            <input
              autoComplete="one-time-code"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <button className="public-auth-submit" disabled={busy || code.length !== 6} type="submit">
            {busy ? "VALIDANDO..." : "CONFIRMAR E CONTINUAR"}
          </button>
        </form>
      ) : (
        <div className="mfa-challenge-loading">{busy ? "Preparando verificação..." : "Verificação indisponível."}</div>
      )}
      <a className="mfa-back-link" href="/auth?mode=signin">Voltar ao login</a>
    </section>
  );
}
