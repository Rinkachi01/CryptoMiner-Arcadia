"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { TurnstileWidget } from "../TurnstileWidget";

type AuthMode = "reset" | "signin" | "signup";

type AuthFormProps = {
  captchaRequired: boolean;
  initialError?: string;
  initialMode: AuthMode;
  publishableKey: string;
  referralCode: string | null;
  returnTo: string;
  supabaseUrl: string;
  turnstileSiteKey: string | null;
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
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Você pode reenviar a confirmação pelo cadastro.";
  }
  if (
    normalized.includes("error sending confirmation email") ||
    normalized.includes("unexpected_failure") ||
    normalized.includes("unexpected failure")
  ) {
    return "O cadastro foi pausado porque o serviço de e-mail está indisponível. Nenhuma conta foi criada. Tente novamente mais tarde ou abra um chamado.";
  }
  if (normalized.includes("captcha") || normalized.includes("turnstile")) {
    return "A verificação humana expirou. Confirme novamente e repita o envio.";
  }
  return "Não foi possível concluir agora. Revise os dados e tente novamente.";
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

export function AuthForm({
  captchaRequired,
  initialError,
  initialMode,
  publishableKey,
  referralCode,
  returnTo,
  supabaseUrl,
  turnstileSiteKey,
}: AuthFormProps) {
  const supabase = useMemo(
    () => createBrowserClient(supabaseUrl, publishableKey),
    [publishableKey, supabaseUrl],
  );
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState(initialError ?? "");
  const [password, setPassword] = useState("");
  const [sentEmail, setSentEmail] = useState<
    "confirmation" | "recovery" | null
  >(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(
      () => setResendSeconds((current) => Math.max(0, current - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setSentEmail(null);
    setResendSeconds(0);
    setCaptchaToken("");
    setCaptchaReset((current) => current + 1);
  }

  async function redirectAfterAuthentication() {
    const authWithAal = supabase.auth as typeof supabase.auth & {
      getAuthenticatorAssuranceLevel?: () => Promise<{
        data: { nextLevel?: string | null; currentLevel?: string | null } | null;
        error?: unknown;
      }>;
    };
    if (typeof authWithAal.getAuthenticatorAssuranceLevel === "function") {
      const { data, error } = await authWithAal.getAuthenticatorAssuranceLevel();
      if (
        !error &&
        data?.nextLevel === "aal2" &&
        data.currentLevel !== "aal2"
      ) {
        window.location.assign(
          `/auth/mfa?next=${encodeURIComponent(returnTo)}`,
        );
        return;
      }
    }
    window.location.assign(returnTo);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`;
      const { error } = await supabase.auth.signInWithOAuth({
        options: {
          queryParams: { prompt: "select_account" },
          redirectTo,
        },
        provider: "google",
      });
      if (error) throw error;
    } catch (error) {
      setMessage(
        friendlyError(error instanceof Error ? error.message : String(error)),
      );
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    let submittedToAuth = false;

    try {
      if (captchaRequired && !captchaToken) {
        setMessage("Confirme a verificação humana para continuar.");
        return;
      }
      if (mode === "reset") {
        const redirectTo = `${window.location.origin}/auth/callback?next=/auth/update-password`;
        submittedToAuth = true;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          captchaToken: captchaToken || undefined,
          redirectTo,
        });
        if (error) throw error;
        setMessage(
          "Se a conta existir, você receberá um e-mail com o próximo passo.",
        );
        setSentEmail("recovery");
        setResendSeconds(60);
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
        const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`;
        submittedToAuth = true;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: captchaToken || undefined,
            data: { full_name: fullName.trim() },
            emailRedirectTo,
          },
        });
        if (error) throw error;
        if (data.session) {
          if (referralCode) {
            await fetch("/api/referrals", {
              body: JSON.stringify({ code: referralCode }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            }).catch(() => null);
          }
          await redirectAfterAuthentication();
          return;
        }
        setMessage(
          "Cadastro recebido. Confirme o e-mail para liberar sua conta.",
        );
        setSentEmail("confirmation");
        setResendSeconds(60);
        return;
      }

      submittedToAuth = true;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        options: { captchaToken: captchaToken || undefined },
        password,
      });
      if (error) throw error;
      await redirectAfterAuthentication();
    } catch (error) {
      setMessage(
        friendlyError(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      if (captchaRequired && submittedToAuth) {
        setCaptchaToken("");
        setCaptchaReset((current) => current + 1);
      }
      setBusy(false);
    }
  }

  async function resendEmail() {
    if (!sentEmail || busy || resendSeconds > 0) return;
    if (captchaRequired && !captchaToken) {
      setMessage("Confirme a verificação humana para reenviar.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const redirectTo =
        sentEmail === "confirmation"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`
          : `${window.location.origin}/auth/callback?next=/auth/update-password`;
      const { error } =
        sentEmail === "confirmation"
          ? await supabase.auth.resend({
              email,
              options: {
                captchaToken: captchaToken || undefined,
                emailRedirectTo: redirectTo,
              },
              type: "signup",
            })
          : await supabase.auth.resetPasswordForEmail(email, {
              captchaToken: captchaToken || undefined,
              redirectTo,
            });
      if (error) throw error;
      setMessage(
        sentEmail === "confirmation"
          ? "Se o cadastro estiver pendente, uma nova confirmação foi enviada."
          : "Se a conta existir, um novo link de recuperação foi enviado.",
      );
      setResendSeconds(60);
    } catch (error) {
      setMessage(
        friendlyError(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      if (captchaRequired) {
        setCaptchaToken("");
        setCaptchaReset((current) => current + 1);
      }
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

        {sentEmail ? (
          <section className="public-auth-email-sent" aria-live="polite">
            <div className="email-sent-icon" aria-hidden="true">✓</div>
            <span>
              {sentEmail === "confirmation"
                ? "CONFIRMAÇÃO SOLICITADA"
                : "RECUPERAÇÃO SOLICITADA"}
            </span>
            <h2>Confira sua caixa de entrada</h2>
            <p>
              Enviamos as instruções para <strong>{maskEmail(email)}</strong>.
              Confira também spam e promoções. O Arcadia nunca pedirá sua senha
              por e-mail.
            </p>

            {captchaRequired && turnstileSiteKey && resendSeconds === 0 && (
              <div className="public-auth-captcha">
                <TurnstileWidget
                  action="auth_resend"
                  onError={setMessage}
                  onToken={setCaptchaToken}
                  resetSignal={captchaReset}
                  siteKey={turnstileSiteKey}
                />
                <small>Confirme sua presença antes de solicitar outro envio.</small>
              </div>
            )}

            {message && (
              <div className="public-auth-message" role="status">{message}</div>
            )}

            <div className="email-sent-actions">
              <button
                type="button"
                disabled={
                  busy ||
                  resendSeconds > 0 ||
                  (captchaRequired && (!turnstileSiteKey || !captchaToken))
                }
                onClick={() => void resendEmail()}
              >
                {busy
                  ? "REENVIANDO..."
                  : resendSeconds > 0
                    ? `REENVIAR EM ${resendSeconds}s`
                    : "REENVIAR E-MAIL"}
              </button>
              <button type="button" onClick={() => switchMode("signin")}>
                VOLTAR AO LOGIN
              </button>
            </div>
          </section>
        ) : (
        <>
        {mode !== "reset" && (
          <div className="public-auth-social">
            <button
              className="public-auth-google"
              disabled={busy}
              onClick={() => void signInWithGoogle()}
              type="button"
            >
              <span aria-hidden="true">G</span>
              CONTINUAR COM GOOGLE
            </button>
            <div className="public-auth-divider"><span>ou use seu e-mail</span></div>
          </div>
        )}
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

          {captchaRequired && turnstileSiteKey && (
            <div className="public-auth-captcha">
              <TurnstileWidget
                action={`auth_${mode}`}
                onError={setMessage}
                onToken={setCaptchaToken}
                resetSignal={captchaReset}
                siteKey={turnstileSiteKey}
              />
              <small>A resposta confirma presença humana e não fica armazenada.</small>
            </div>
          )}

          {captchaRequired && !turnstileSiteKey && (
            <div className="public-auth-message" role="alert">
              Cadastro temporariamente pausado enquanto a proteção humana é configurada.
            </div>
          )}

          {message && <div className="public-auth-message" role="status">{message}</div>}

          <button
            className="public-auth-submit"
            disabled={
              busy ||
              (captchaRequired && (!turnstileSiteKey || !captchaToken))
            }
            type="submit"
          >
            {busy
              ? "PROCESSANDO..."
              : mode === "signin"
                ? "ENTRAR NA OPERAÇÃO"
                : mode === "signup"
                  ? "CRIAR CONTA"
                  : "ENVIAR RECUPERAÇÃO"}
          </button>
        </form>
        </>
        )}

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
