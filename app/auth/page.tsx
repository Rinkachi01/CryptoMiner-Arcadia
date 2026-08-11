import { PublicSiteFooter } from "../PublicSiteFooter";
import { safeArcadiaReturnPath } from "../identity-rules";
import { publicLoginConfig } from "../supabase-server";
import { AuthForm } from "./AuthForm";

export const dynamic = "force-dynamic";

type AuthPageProps = {
  searchParams: Promise<{
    error?: string;
    mode?: string;
    ref?: string;
    return_to?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const config = publicLoginConfig();
  const mode =
    params.mode === "signup" || params.mode === "reset"
      ? params.mode
      : "signin";
  const returnTo = safeArcadiaReturnPath(params.return_to);
  const referralCode = /^[A-Za-z0-9]{8,16}$/.test(params.ref ?? "")
    ? params.ref!.toUpperCase()
    : null;

  return (
    <main className="public-page-shell">
      {config?.enabled ? (
        <AuthForm
          captchaRequired={config.captchaRequired}
          initialError={params.error}
          initialMode={mode}
          publishableKey={config.publishableKey}
          referralCode={referralCode}
          returnTo={returnTo}
          supabaseUrl={config.url}
          turnstileSiteKey={config.turnstileSiteKey}
        />
      ) : (
        <section className="public-status-card">
          <span>ACESSO CONTROLADO</span>
          <h1>O cadastro público ainda não foi liberado.</h1>
          <p>
            A estrutura do Supabase está preparada, mas o acesso permanece na
            beta privada até confirmação de e-mail, recuperação de senha e
            domínio final passarem pela validação.
          </p>
          <div>
            <a href="/signin-with-chatgpt?return_to=%2F">ENTRAR NA BETA</a>
            <a className="secondary" href="/support">VER SUPORTE</a>
          </div>
        </section>
      )}
      <PublicSiteFooter />
    </main>
  );
}
