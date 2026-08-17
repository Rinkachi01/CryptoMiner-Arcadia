"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useMemo, useState } from "react";
import { useArcadiaLanguage } from "../../i18n";

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
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
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
        setMessage(error?.message?.toLowerCase().includes("not authenticated")
          ? english ? "Your session expired. Sign in again to continue." : "Sua sessão expirou. Entre novamente para continuar."
          : english ? "No active authenticator was found for this account. Return to your profile and set up protection again." : "Não encontramos um autenticador ativo para esta conta. Volte ao perfil e configure a proteção novamente.");
        setBusy(false);
        return;
      }
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (!active) return;
      if (challenge.error || !challenge.data?.id) {
        setMessage(challenge.error?.message ?? (english ? "We could not start verification. Try signing in again." : "Não foi possível iniciar a verificação. Tente entrar novamente."));
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
  }, [english, supabase]);

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
      setMessage(english ? "Invalid or expired code. Check your authenticator app and try again." : "Código inválido ou expirado. Confira o aplicativo autenticador e tente novamente.");
      setCode("");
      setBusy(false);
      return;
    }
    window.location.assign(next);
  }

  return (
    <section className="mfa-challenge-card" aria-labelledby="mfa-title">
      <img className="mfa-brand-logo" src="/assets/brand/cma-coin.png" alt="Logo CMA" />
      <span className="mfa-kicker">{english ? "PROTECTED ACCOUNT" : "CONTA PROTEGIDA"}</span>
      <h1 id="mfa-title">{english ? "Confirm your identity" : "Confirme sua identidade"}</h1>
      <p>{english ? "Enter the six-digit code shown in your authenticator app to continue." : "Digite o código de seis dígitos exibido no seu aplicativo autenticador para continuar."}</p>
      {message && <div className="public-auth-message" role="alert">{message}</div>}
      {factorId && challengeId ? (
        <form onSubmit={verify}>
          <label>
            {english ? "Authenticator code" : "Código do autenticador"}
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
            {busy ? (english ? "VERIFYING..." : "VALIDANDO...") : (english ? "CONFIRM AND CONTINUE" : "CONFIRMAR E CONTINUAR")}
          </button>
        </form>
      ) : (
        <div className="mfa-challenge-loading">{busy ? (english ? "Preparing verification..." : "Preparando verificação...") : (english ? "Verification unavailable." : "Verificação indisponível.")}</div>
      )}
      <a className="mfa-back-link" href="/auth?mode=signin">{english ? "Back to sign in" : "Voltar ao login"}</a>
    </section>
  );
}
