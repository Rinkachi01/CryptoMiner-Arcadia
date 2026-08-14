"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useMemo, useState } from "react";

type MfaSettingsProps = {
  publishableKey: string;
  supabaseUrl: string;
};

type TotpFactor = { id: string; status: string; friendly_name?: string | null };

export function MfaSettings({ publishableKey, supabaseUrl }: MfaSettingsProps) {
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, publishableKey),
    [publishableKey, supabaseUrl],
  );
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  async function loadFactor() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setMessage("Não foi possível consultar a proteção da conta agora.");
    } else {
      setFactor(data?.totp?.find((item) => item.status === "verified") ?? null);
    }
    setBusy(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFactor(), 0);
    return () => window.clearTimeout(timer);
    // The client is memoized for the lifetime of this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function beginSetup() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Arcadia Authenticator",
    });
    if (error || !data?.id || !data.totp) {
      setMessage("Não foi possível iniciar a configuração do autenticador.");
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
      setMessage("Não foi possível validar este código. Tente gerar um novo código.");
      setBusy(false);
      return;
    }
    const result = await supabase.auth.mfa.verify({
      challengeId: challenge.data.id,
      code,
      factorId: setup.factorId,
    });
    if (result.error) {
      setMessage("Código inválido. Confira o aplicativo autenticador e tente novamente.");
      setCode("");
      setBusy(false);
      return;
    }
    setSetup(null);
    setCode("");
    setMessage("Autenticação em duas etapas ativada nesta conta.");
    await loadFactor();
  }

  async function disableMfa() {
    if (!factor || !window.confirm("Desativar a autenticação em duas etapas nesta conta?")) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) {
      setMessage("Não foi possível desativar a proteção agora.");
    } else {
      setFactor(null);
      setMessage("Autenticação em duas etapas desativada.");
    }
    setBusy(false);
  }

  return (
    <article className="profile-panel mfa-settings" aria-labelledby="mfa-settings-title">
      <header><span>SEGURANÇA</span><strong id="mfa-settings-title">Autenticação em duas etapas</strong></header>
      <p>Use um aplicativo autenticador para proteger o acesso mesmo quando a senha for descoberta.</p>
      {message && <div className="public-auth-message" role="status">{message}</div>}
      {factor ? (
        <div className="mfa-active-state">
          <span className="mfa-status-dot" aria-hidden="true" />
          <div><strong>Proteção ativa</strong><small>Um código será solicitado em novos acessos.</small></div>
          <button className="mfa-danger-button" disabled={busy} onClick={() => void disableMfa()} type="button">DESATIVAR</button>
        </div>
      ) : setup ? (
        <form className="mfa-setup-form" onSubmit={confirmSetup}>
          <div className="mfa-qr-wrap">
            <img alt="QR code para configurar o autenticador" src={setup.qrCode} />
            <small>Escaneie no Google Authenticator, Authy ou outro app compatível.</small>
          </div>
          <label>Chave manual <code>{setup.secret}</code></label>
          <label>
            Código de confirmação
            <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          </label>
          <div className="mfa-setup-actions">
            <button className="public-auth-submit" disabled={busy || code.length !== 6} type="submit">{busy ? "VALIDANDO..." : "ATIVAR PROTEÇÃO"}</button>
            <button type="button" onClick={() => { setSetup(null); setCode(""); }}>CANCELAR</button>
          </div>
        </form>
      ) : (
        <button className="mfa-enable-button" disabled={busy} onClick={() => void beginSetup()} type="button">{busy ? "CARREGANDO..." : "ATIVAR AUTENTICADOR"}</button>
      )}
    </article>
  );
}
