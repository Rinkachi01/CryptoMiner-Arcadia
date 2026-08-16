"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { TurnstileWidget } from "../TurnstileWidget";
import { LanguageSwitcher, useArcadiaLanguage } from "../i18n";

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

function friendlyError(message: string, english: boolean) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return english ? "Incorrect email or password." : "E-mail ou senha incorretos.";
  }
  if (normalized.includes("email rate limit")) {
    return english ? "Too many emails were requested. Please wait a few minutes." : "Muitos e-mails foram solicitados. Aguarde alguns minutos.";
  }
  if (normalized.includes("user already registered")) {
    return english ? "This account already exists. Try signing in or recovering your password." : "Esta conta já existe. Tente entrar ou recuperar a senha.";
  }
  if (normalized.includes("email not confirmed")) {
    return english ? "Confirm your email before signing in. You can resend the confirmation from the sign-up screen." : "Confirme seu e-mail antes de entrar. Você pode reenviar a confirmação pelo cadastro.";
  }
  if (
    normalized.includes("error sending confirmation email") ||
    normalized.includes("unexpected_failure") ||
    normalized.includes("unexpected failure")
  ) {
    return english ? "Sign-up is paused because the email service is unavailable. No account was created. Try again later or contact support." : "O cadastro foi pausado porque o serviço de e-mail está indisponível. Nenhuma conta foi criada. Tente novamente mais tarde ou abra um chamado.";
  }
  if (normalized.includes("captcha") || normalized.includes("turnstile")) {
    return english ? "The human verification expired. Confirm it again and submit once more." : "A verificação humana expirou. Confirme novamente e repita o envio.";
  }
  return english ? "We could not complete that right now. Review the details and try again." : "Não foi possível concluir agora. Revise os dados e tente novamente.";
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
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
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
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
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
    setPasswordConfirmation("");
    setCaptchaReset((current) => current + 1);
  }

  async function redirectAfterAuthentication() {
    // Supabase exposes the assurance API under `auth.mfa`. Calling it on
    // `auth` silently skipped the MFA challenge for every account.
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      throw new Error(english ? "We could not validate two-step protection. Try signing in again." : "Não foi possível validar a proteção em duas etapas. Tente entrar novamente.");
    }
    if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      window.location.assign(
        `/auth/mfa?next=${encodeURIComponent(returnTo)}`,
      );
      return;
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
        friendlyError(error instanceof Error ? error.message : String(error), english),
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
        setMessage(english ? "Confirm the human verification to continue." : "Confirme a verificação humana para continuar.");
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
          english ? "If the account exists, you will receive an email with the next step." : "Se a conta existir, você receberá um e-mail com o próximo passo.",
        );
        setSentEmail("recovery");
        setResendSeconds(60);
        return;
      }

      if (mode === "signup") {
        if (password.length < 10) {
          setMessage(english ? "Use a password with at least 10 characters." : "Use uma senha com pelo menos 10 caracteres.");
          return;
        }
        if (password !== passwordConfirmation) {
          setMessage(english ? "The passwords do not match. Check both fields." : "As senhas não coincidem. Confira os dois campos.");
          return;
        }
        if (!termsAccepted) {
          setMessage(english ? "Accept the Terms and Privacy Policy to continue." : "Aceite os Termos e a Política de Privacidade para continuar.");
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
          english ? "Sign-up received. Confirm your email to unlock the account." : "Cadastro recebido. Confirme o e-mail para liberar sua conta.",
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
        friendlyError(error instanceof Error ? error.message : String(error), english),
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
      setMessage(english ? "Confirm the human verification to resend." : "Confirme a verificação humana para reenviar.");
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
          ? english ? "If sign-up is still pending, a new confirmation was sent." : "Se o cadastro estiver pendente, uma nova confirmação foi enviada."
          : english ? "If the account exists, a new recovery link was sent." : "Se a conta existir, um novo link de recuperação foi enviado.",
      );
      setResendSeconds(60);
    } catch (error) {
      setMessage(
        friendlyError(error instanceof Error ? error.message : String(error), english),
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
        <span>{english ? "START YOUR OPERATION" : "COMECE SUA OPERAÇÃO"}</span>
        <div className="public-auth-hero-visual" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/og-arcade-v3.png" alt="" />
          <div className="public-auth-hero-overlay">
            <span className="public-auth-hero-pulse" />
            <strong>{english ? "SERVER ONLINE" : "SERVIDOR ONLINE"}</strong>
            <small>{english ? "Your progress is verified" : "Seu progresso é verificado"}</small>
          </div>
        </div>
        <h1>{english ? "Your mining operation starts here." : "Sua operação de mineração começa aqui."}</h1>
        <p>
          {english
            ? "Create an account or sign in to build your rooms, place miners, play the Arcade, and track rewards verified by the server."
            : "Crie uma conta ou entre para montar suas salas, instalar mineradores, jogar no Arcade e acompanhar recompensas verificadas pelo servidor."}
        </p>
        <ul>
          <li>{english ? "Progress stays protected and synced across devices" : "Seu progresso fica protegido e sincronizado entre dispositivos"}</li>
          <li>{english ? "New operators start with one rack and one starter miner" : "Novos operadores começam com um rack e um minerador inicial"}</li>
          <li>{english ? "No seed phrase, private key, or wallet password required" : "Não pedimos seed phrase, chave privada ou senha de carteira"}</li>
        </ul>
        <div className="public-auth-proof-strip" aria-label={english ? "Arcadia highlights" : "Destaques do Arcadia"}>
          <div><strong>04</strong><span>{english ? "global pools" : "pools globais"}</span></div>
          <div><strong>10m</strong><span>{english ? "fixed blocks" : "blocos fixos"}</span></div>
          <div><strong>12h</strong><span>{english ? "energy cycle" : "ciclo de energia"}</span></div>
        </div>
      </section>

      <section className="public-auth-card">
        <header>
          <div className="login-brand-mark">
            <img src="/assets/brand/cma-coin.png" alt="Logo CMA" />
          </div>
          <div>
            <span>CRYPTO MINER ARCADIA</span>
            <strong>
              {mode === "signin"
                ? english ? "Sign in" : "Entrar"
                : mode === "signup"
                  ? english ? "Create account" : "Criar conta"
                  : english ? "Recover password" : "Recuperar senha"}
            </strong>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="public-auth-tabs" role="tablist" aria-label={english ? "Account access" : "Acesso à conta"}>
          <button
            className={mode === "signin" ? "active" : ""}
            type="button"
            onClick={() => switchMode("signin")}
          >
            {english ? "SIGN IN" : "ENTRAR"}
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            type="button"
            onClick={() => switchMode("signup")}
          >
            {english ? "SIGN UP" : "REGISTRAR"}
          </button>
        </div>

        <p className="public-auth-mode-hint">
          {mode === "signin"
            ? english ? "Sign in to return to your room and track your mining." : "Entre para voltar à sua sala e acompanhar sua mineração."
            : mode === "signup"
              ? english ? "Create your operator and start with your first rack." : "Crie seu operador e comece com seu primeiro rack."
              : english ? "Recover access securely through your email." : "Recupere o acesso com segurança pelo seu e-mail."}
        </p>

        {sentEmail ? (
          <section className="public-auth-email-sent" aria-live="polite">
            <div className="email-sent-icon" aria-hidden="true">✓</div>
            <span>
              {sentEmail === "confirmation"
                ? english ? "CONFIRMATION REQUESTED" : "CONFIRMAÇÃO SOLICITADA"
                : english ? "RECOVERY REQUESTED" : "RECUPERAÇÃO SOLICITADA"}
            </span>
            <h2>{english ? "Check your inbox" : "Confira sua caixa de entrada"}</h2>
            <p>
              {english
                ? <>We sent instructions to <strong>{maskEmail(email)}</strong>. Check spam and promotions too. Arcadia will never ask for your password by email.</>
                : <>Enviamos as instruções para <strong>{maskEmail(email)}</strong>. Confira também spam e promoções. O Arcadia nunca pedirá sua senha por e-mail.</>}
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
                <small>{english ? "Confirm your presence before requesting another email." : "Confirme sua presença antes de solicitar outro envio."}</small>
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
                  ? english ? "RESENDING..." : "REENVIANDO..."
                  : resendSeconds > 0
                    ? english ? `RESEND IN ${resendSeconds}s` : `REENVIAR EM ${resendSeconds}s`
                    : english ? "RESEND EMAIL" : "REENVIAR E-MAIL"}
              </button>
              <button type="button" onClick={() => switchMode("signin")}>
                {english ? "BACK TO SIGN IN" : "VOLTAR AO LOGIN"}
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
              {english ? "CONTINUE WITH GOOGLE" : "CONTINUAR COM GOOGLE"}
            </button>
            <div className="public-auth-divider"><span>{english ? "or use your email" : "ou use seu e-mail"}</span></div>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              {english ? "Operator name" : "Nome de operador"}
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
            {english ? "Email" : "E-mail"}
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
              {english ? "Password" : "Senha"}
              <input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={10}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "signup" && <small>{english ? "At least 10 characters." : "Mínimo de 10 caracteres."}</small>}
            </label>
          )}
          {mode === "signup" && (
            <label>
              {english ? "Confirm password" : "Confirmar senha"}
              <input
                autoComplete="new-password"
                minLength={10}
                required
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
              />
              <small>{english ? "Repeat the password with at least 10 characters." : "Repita a senha com pelo menos 10 caracteres."}</small>
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
                {english ? <>I have read and accept the <a href="/legal#terms">Terms of Use</a> and <a href="/legal#privacy">Privacy Policy</a>.</> : <>Li e aceito os <a href="/legal#terms">Termos de Uso</a> e a <a href="/legal#privacy">Política de Privacidade</a>.</>}
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
              <small>{english ? "The response confirms you are human and is not stored." : "A resposta confirma presença humana e não fica armazenada."}</small>
            </div>
          )}

          {captchaRequired && !turnstileSiteKey && (
            <div className="public-auth-message" role="alert">
              {english ? "Sign-up is temporarily paused while human verification is configured." : "Cadastro temporariamente pausado enquanto a proteção humana é configurada."}
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
              ? english ? "PROCESSING..." : "PROCESSANDO..."
              : mode === "signin"
                ? english ? "SIGN IN TO ARCADIA" : "ENTRAR NO ARCADIA"
                : mode === "signup"
                  ? english ? "CREATE ACCOUNT AND START" : "CRIAR CONTA E COMEÇAR"
                  : english ? "SEND RECOVERY LINK" : "ENVIAR RECUPERAÇÃO"}
          </button>
        </form>
        </>
        )}

        <footer>
          {mode === "signin" ? (
            <button type="button" onClick={() => switchMode("reset")}>
              {english ? "Forgot my password" : "Esqueci minha senha"}
            </button>
          ) : mode === "reset" ? (
            <button type="button" onClick={() => switchMode("signin")}>
              {english ? "Back to sign in" : "Voltar para o login"}
            </button>
          ) : (
            <span>{english ? "Email confirmation is required." : "Confirmação de e-mail obrigatória."}</span>
          )}
          <a href="/support">{english ? "I need help" : "Preciso de ajuda"}</a>
        </footer>
      </section>
    </div>
  );
}
