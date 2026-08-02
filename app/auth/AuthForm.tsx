"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useMemo, useState } from "react";

type AuthMode = "reset" | "signin" | "signup";

type AuthFormProps = {
  initialError?: string;
  initialMode: AuthMode;
  publishableKey: string;
  returnTo: string;
  supabaseUrl: string;
};

function friendlyError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email rate limit")) {
    return "Muitos e-mails foram solicitados. Aguarde alguns minutos.";
  }
  if (normalized.includes("user already registered")) {
    return "Esta conta já existe. Tente entrar ou recuperar a senha.";
  }
  return "Não foi possível concluir agora. Revise os dados e tente novamente.";
}

export function AuthForm({
  initialError,
  initialMode,
  publishableKey,
  returnTo,
  supabaseUrl,
}: AuthFormProps) {
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, publishableKey),
    [publishableKey, supabaseUrl],
  );
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState(initialError ?? "");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (mode === "reset") {
        const redirectTo = `${window.location.origin}/auth/callback?next=/auth/update-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw error;
        setMessage(
          "Se a conta existir, você receberá um e-mail com o próximo passo.",
        );
        return;
      }

      if (mode === "signup") {
        if (password.length < 10) {
          setMessage("Use uma senha com pelo menos 10 caracteres.");
          return;
        }
        if (!termsAccepted) {
          setMessage("Aceite os Termos e a Política de Privacidade para continuar.");
          return;
        }
        const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo,
          },
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign(returnTo);
          return;
        }
        setMessage(
          "Cadastro recebido. Confirme o e-mail para liberar sua conta.",
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.assign(returnTo);
    } catch (error) {
      setMessage(
        friendlyError(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-auth-layout">
      <section className="public-auth-intro">
        <span>CONTA ARCADIA</span>
        <h1>Seu progresso pertence a uma conta verificada.</h1>
        <p>
          O login público usa e-mail confirmado e sessão protegida. O jogo nunca
          pede seed phrase, chave privada ou senha de carteira.
        </p>
        <ul>
          <li>Conta nova: 1 rack e 1 minerador inicial</li>
          <li>Sem CMA, bateria ou energia grátis no cadastro</li>
          <li>Progresso e recompensas conferidos pelo servidor</li>
        </ul>
      </section>

      <section className="public-auth-card">
        <header>
          <div className="login-brand-mark">CMA</div>
          <div>
            <span>CRYPTO MINER ARCADIA</span>
            <strong>
              {mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Recuperar senha"}
            </strong>
          </div>
        </header>

        <div className="public-auth-tabs" role="tablist" aria-label="Acesso à conta">
          <button
            className={mode === "signin" ? "active" : ""}
            type="button"
            onClick={() => switchMode("signin")}
          >
            ENTRAR
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            type="button"
            onClick={() => switchMode("signup")}
          >
            REGISTRAR
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Nome de operador
              <input
                autoComplete="name"
                maxLength={60}
                minLength={2}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
          )}
          <label>
            E-mail
            <input
              autoComplete="email"
              inputMode="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {mode !== "reset" && (
            <label>
              Senha
              <input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={10}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "signup" && <small>Mínimo de 10 caracteres.</small>}
            </label>
          )}
          {mode === "signup" && (
            <label className="public-auth-consent">
              <input
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                type="checkbox"
              />
              <span>
                Li e aceito os <a href="/legal#terms">Termos de Uso</a> e a{" "}
                <a href="/legal#privacy">Política de Privacidade</a>.
              </span>
            </label>
          )}

          {message && <div className="public-auth-message" role="status">{message}</div>}

          <button className="public-auth-submit" disabled={busy} type="submit">
            {busy
              ? "PROCESSANDO..."
              : mode === "signin"
                ? "ENTRAR NA OPERAÇÃO"
                : mode === "signup"
                  ? "CRIAR CONTA"
                  : "ENVIAR RECUPERAÇÃO"}
          </button>
        </form>

        <footer>
          {mode === "signin" ? (
            <button type="button" onClick={() => switchMode("reset")}>
              Esqueci minha senha
            </button>
          ) : mode === "reset" ? (
            <button type="button" onClick={() => switchMode("signin")}>
              Voltar para o login
            </button>
          ) : (
            <span>Confirmação de e-mail obrigatória.</span>
          )}
          <a href="/support">Preciso de ajuda</a>
        </footer>
      </section>
    </div>
  );
}

