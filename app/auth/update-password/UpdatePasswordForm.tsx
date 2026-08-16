"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useMemo, useState } from "react";
import { useArcadiaLanguage } from "../../i18n";

export function UpdatePasswordForm({
  publishableKey,
  supabaseUrl,
}: {
  publishableKey: string;
  supabaseUrl: string;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, publishableKey),
    [publishableKey, supabaseUrl],
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 10) {
      setMessage(english ? "Use a password with at least 10 characters." : "Use uma senha com pelo menos 10 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage(english ? "The two passwords must match." : "As duas senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(english ? "We could not update the password. Request a new link." : "Não foi possível atualizar. Solicite um novo link.");
      return;
    }
    setMessage(english ? "Password updated. Redirecting to your operation..." : "Senha atualizada. Redirecionando para sua operação...");
    window.setTimeout(() => window.location.assign("/"), 700);
  }

  return (
    <form className="update-password-card" onSubmit={submit}>
      <span>{english ? "ACCOUNT RECOVERY" : "RECUPERAÇÃO DE CONTA"}</span>
      <h1>{english ? "Create your new password" : "Crie sua nova senha"}</h1>
      <p>{english ? "This link can be used once. Your new password must have at least 10 characters." : "O link é de uso único. A nova senha deve ter pelo menos 10 caracteres."}</p>
      <label>
        {english ? "New password" : "Nova senha"}
        <input
          autoComplete="new-password"
          minLength={10}
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        {english ? "Confirm new password" : "Confirmar nova senha"}
        <input
          autoComplete="new-password"
          minLength={10}
          required
          type="password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      {message && <div className="public-auth-message" role="status">{message}</div>}
      <button disabled={busy} type="submit">
        {busy ? (english ? "UPDATING..." : "ATUALIZANDO...") : (english ? "SAVE NEW PASSWORD" : "SALVAR NOVA SENHA")}
      </button>
    </form>
  );
}

