"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useMemo, useState } from "react";

export function UpdatePasswordForm({
  publishableKey,
  supabaseUrl,
}: {
  publishableKey: string;
  supabaseUrl: string;
}) {
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
      setMessage("Use uma senha com pelo menos 10 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As duas senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage("Não foi possível atualizar. Solicite um novo link.");
      return;
    }
    setMessage("Senha atualizada. Redirecionando para sua operação...");
    window.setTimeout(() => window.location.assign("/"), 700);
  }

  return (
    <form className="update-password-card" onSubmit={submit}>
      <span>RECUPERAÇÃO DE CONTA</span>
      <h1>Crie sua nova senha</h1>
      <p>O link é de uso único. A nova senha deve ter pelo menos 10 caracteres.</p>
      <label>
        Nova senha
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
        Confirmar nova senha
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
        {busy ? "ATUALIZANDO..." : "SALVAR NOVA SENHA"}
      </button>
    </form>
  );
}

