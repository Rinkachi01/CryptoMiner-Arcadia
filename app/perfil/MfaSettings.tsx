"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useMemo, useState } from "react";
import { useArcadiaLanguage } from "../i18n";

type MfaSettingsProps = {
  publishableKey: string;
  supabaseUrl: string;
};

type TotpFactor = { id: string; status: string; friendly_name?: string | null };

type PendingCleanup =
  | { ok: true }
  | { ok: false; message: string };

function friendlyMfaError(error: { message?: string } | null | undefined, english: boolean) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("mfa") && message.includes("disabled")) {
    return english ? "Two-step authentication is still disabled in the Supabase project." : "A autenticação em duas etapas ainda está desativada no projeto Supabase.";
  }
  if (message.includes("already exists") || message.includes("duplicate")) {
    return english ? "The previous setup is pending with the provider. Use recovery below to clear only the unconfirmed factor and start again." : "A configuração anterior ficou pendente no provedor. Use a recuperação abaixo para limpar somente o fator não confirmado e começar novamente.";
  }
  if (message.includes("not authenticated") || message.includes("jwt")) {
    return english ? "Your session expired. Sign in again to configure protection." : "Sua sessão expirou. Entre novamente para configurar a proteção.";
  }
  return english ? "We could not complete setup right now. Try again." : "Não foi possível concluir a configuração agora. Tente novamente.";
}

export function MfaSettings({ publishableKey, supabaseUrl }: MfaSettingsProps) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, publishableKey),
    [publishableKey, supabaseUrl],
  );
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  async function loadFactor() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setMessage(friendlyMfaError(error, english));
    } else {
      const verified = data?.totp?.find((item) => item.status === "verified") ?? null;
      const pending = data?.totp?.find((item) => item.status === "unverified") ?? null;
      setFactor(verified);
      setPendingFactorId(verified ? null : pending?.id ?? null);
      setRecoveryRequired(false);
      setMessage(
        verified
          ? ""
          : pending
            ? english ? "A setup is already in progress. Continue with the code shown in your authenticator app." : "Há uma configuração iniciada. Continue usando o código que já aparece no aplicativo autenticador."
            : "",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFactor(), 0);
    return () => window.clearTimeout(timer);
    // The client is memoized for the lifetime of this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [english, supabase]);

  async function clearPendingFactors(): Promise<PendingCleanup> {
    // Refresh first so a previous interrupted enrollment cannot leave us
    // operating with a stale AAL1 access token.
    await supabase.auth.refreshSession().catch(() => null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const listing = await supabase.auth.mfa.listFactors();
      if (listing.error) {
        return { ok: false, message: friendlyMfaError(listing.error, english) };
      }
      const pending = (listing.data?.totp ?? []).filter(
        (item) => item.status === "unverified",
      );
      if (pending.length === 0) return { ok: true };

      let removed = 0;
      for (const item of pending) {
        const result = await supabase.auth.mfa.unenroll({ factorId: item.id });
        if (!result.error) removed += 1;
      }
      // Auth can take a short moment to make the factor deletion visible to
      // the next enrollment request. Re-listing avoids a false duplicate.
      if (removed > 0) await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
    return {
      ok: false,
      message: english ? "The pending setup could not be removed. Sign out, sign in again, and try enabling the authenticator." : "A configuração pendente não pôde ser removida. Saia da conta, entre novamente e tente ativar o autenticador.",
    };
  }

  async function beginSetup() {
    setBusy(true);
    setMessage("");
    if (recoveryRequired) {
      const cleanup = await clearPendingFactors();
      if (!cleanup.ok) {
        setMessage(cleanup.message);
        setBusy(false);
        return;
      }
      setRecoveryRequired(false);
      setPendingFactorId(null);
      setSetup(null);
      // Depois da limpeza, já inicia uma nova inscrição nesta mesma ação.
      // Isso evita deixar o jogador preso entre dois cliques ou em um estado
      // visual que ainda aponta para o fator antigo.
      let fresh = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Arcadia Authenticator ${Date.now()}`,
      });
      if (fresh.error && (fresh.error.message.toLowerCase().includes("already exists") || fresh.error.message.toLowerCase().includes("duplicate"))) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        await clearPendingFactors();
        fresh = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Arcadia Authenticator ${Date.now()}`,
        });
      }
      if (fresh.error || !fresh.data?.id || !fresh.data.totp) {
        setRecoveryRequired(true);
        setMessage(friendlyMfaError(fresh.error, english));
        setBusy(false);
        return;
      }
      setSetup({
        factorId: fresh.data.id,
        qrCode: fresh.data.totp.qr_code,
        secret: fresh.data.totp.secret,
      });
      setMessage(english ? "A new QR code was generated. Scan it in your authenticator app and confirm the code." : "Novo QR Code gerado. Escaneie-o no aplicativo autenticador e confirme o código.");
      setBusy(false);
      return;
    }
    // Keep the existing QR enrollment when the user already scanned it. The
    // six-digit code can finish that factor without generating a new secret.
    if (pendingFactorId) {
      setSetup({ factorId: pendingFactorId, qrCode: "", secret: "" });
      setBusy(false);
      return;
    }
    const cleanup = await clearPendingFactors();
    if (!cleanup.ok) {
      setMessage(cleanup.message);
      setBusy(false);
      return;
    }

    let { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Arcadia Authenticator",
    });
    // If Supabase reports a duplicate despite the first cleanup, retry once
    // after the eventual-consistency window rather than trapping the user.
    if (error && (error.message.toLowerCase().includes("already exists") || error.message.toLowerCase().includes("duplicate"))) {
      const pendingListing = await supabase.auth.mfa.listFactors();
      const pending = pendingListing.data?.totp?.find((item) => item.status === "unverified");
      if (pending) {
        setPendingFactorId(pending.id);
        setMessage(english ? "A setup is already in progress. Continue with the code shown in your authenticator app." : "Há uma configuração iniciada. Continue usando o código que já aparece no aplicativo autenticador.");
        setBusy(false);
        return;
      }
      const retryCleanup = await clearPendingFactors();
      if (retryCleanup.ok) {
        const retry = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Arcadia Authenticator",
        });
        data = retry.data;
        error = retry.error;
      }
    }
    if (error || !data?.id || !data.totp) {
      if (error && (error.message.toLowerCase().includes("already exists") || error.message.toLowerCase().includes("duplicate"))) {
        setRecoveryRequired(true);
      }
      setMessage(friendlyMfaError(error, english));
      setBusy(false);
      return;
    }
    setSetup({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setBusy(false);
  }

  async function confirmSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setup || code.length !== 6) return;
    setBusy(true);
    setMessage("");
    const challenge = await supabase.auth.mfa.challenge({ factorId: setup.factorId });
    if (challenge.error || !challenge.data?.id) {
      setMessage(friendlyMfaError(challenge.error, english));
      setBusy(false);
      return;
    }
    const result = await supabase.auth.mfa.verify({
      challengeId: challenge.data.id,
      code,
      factorId: setup.factorId,
    });
    if (result.error) {
      setMessage(
        result.error.message?.toLowerCase().includes("expired")
          ? english ? "Code expired. Wait for the next code in your authenticator app." : "Código expirado. Aguarde o próximo código no aplicativo autenticador."
          : english ? "Invalid code. Check your authenticator app and try again." : "Código inválido. Confira o aplicativo autenticador e tente novamente.",
      );
      setCode("");
      setBusy(false);
      return;
    }
    setSetup(null);
    setCode("");
    setRecoveryRequired(false);
    setMessage(english ? "Two-step authentication is active on this account." : "Autenticação em duas etapas ativada nesta conta.");
    await loadFactor();
  }

  async function disableMfa() {
    if (!factor || !window.confirm(english ? "Disable two-step authentication on this account?" : "Desativar a autenticação em duas etapas nesta conta?")) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) {
      setMessage(friendlyMfaError(error, english));
    } else {
      setFactor(null);
      setMessage(english ? "Two-step authentication is disabled." : "Autenticação em duas etapas desativada.");
    }
    setBusy(false);
  }

  return (
    <article className="profile-panel mfa-settings" aria-labelledby="mfa-settings-title">
      <header><span>{english ? "SECURITY" : "SEGURANÇA"}</span><strong id="mfa-settings-title">{english ? "Two-step authentication" : "Autenticação em duas etapas"}</strong></header>
      <p>{english ? "Use an authenticator app to protect access even if your password is discovered." : "Use um aplicativo autenticador para proteger o acesso mesmo quando a senha for descoberta."}</p>
      {message && <div className="public-auth-message" role="status">{message}</div>}
      {factor ? (
        <div className="mfa-active-state">
          <span className="mfa-status-dot" aria-hidden="true" />
          <div><strong>{english ? "Protection active" : "Proteção ativa"}</strong><small>{english ? "A code will be requested on new sign-ins." : "Um código será solicitado em novos acessos."}</small></div>
          <button className="mfa-danger-button" disabled={busy} onClick={() => void disableMfa()} type="button">{english ? "DISABLE" : "DESATIVAR"}</button>
        </div>
      ) : setup ? (
        <form className="mfa-setup-form" onSubmit={confirmSetup}>
          {setup.qrCode ? (
            <>
              <div className="mfa-qr-wrap">
                <img alt={english ? "QR code to configure the authenticator" : "QR code para configurar o autenticador"} src={setup.qrCode} />
                <small>{english ? "Scan with Google Authenticator, Authy, or another compatible app." : "Escaneie no Google Authenticator, Authy ou outro app compatível."}</small>
              </div>
              <label>Chave manual <code>{setup.secret}</code></label>
            </>
          ) : (
            <div className="public-auth-message" role="status">
            {english ? "Use the six-digit code shown in your authenticator app to complete setup." : "Use o código de seis dígitos que aparece no seu aplicativo autenticador para concluir a configuração."}
            </div>
          )}
          <label>
            {english ? "Confirmation code" : "Código de confirmação"}
            <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          </label>
          <div className="mfa-setup-actions">
            <button className="public-auth-submit" disabled={busy || code.length !== 6} type="submit">{busy ? (english ? "VERIFYING..." : "VALIDANDO...") : (english ? "ENABLE PROTECTION" : "ATIVAR PROTEÇÃO")}</button>
            <button type="button" onClick={() => { setSetup(null); setCode(""); }}>{english ? "CANCEL" : "CANCELAR"}</button>
          </div>
        </form>
      ) : (
        <button className="mfa-enable-button" disabled={busy} onClick={() => void beginSetup()} type="button">
          {busy
            ? english ? "LOADING..." : "CARREGANDO..."
            : recoveryRequired
              ? english ? "RECOVER SETUP" : "RECUPERAR CONFIGURAÇÃO"
              : pendingFactorId
                ? english ? "CONTINUE SETUP" : "CONTINUAR CONFIGURAÇÃO"
                : english ? "ENABLE AUTHENTICATOR" : "ATIVAR AUTENTICADOR"}
        </button>
      )}
    </article>
  );
}
