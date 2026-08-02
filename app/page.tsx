import { ArcadiaGame } from "./ArcadiaGame";
import {
  arcadiaSignInPath,
  arcadiaSignOutPath,
  getArcadiaUser,
} from "./identity-server";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { PublicSiteFooter } from "./PublicSiteFooter";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getArcadiaUser();

  if (!user) {
    return (
      <main className="login-shell public-page-shell">
        <div className="login-shell-content">
          <section className="login-card">
            <div className="login-brand-mark">CMA</div>
            <span>CRYPTO MINER ARCADIA</span>
            <h1>Sua operação começa com uma conta protegida.</h1>
            <p>
              Entre na sua operação ou crie uma conta nova. No ambiente público,
              o e-mail confirmado passa a proteger o seu progresso.
            </p>
            <div className="login-actions">
              <a href={arcadiaSignInPath("/", "signin")}>ENTRAR</a>
              <a className="secondary" href={arcadiaSignInPath("/", "signup")}>CRIAR CONTA</a>
            </div>
            <div className="login-access-status">
              <strong>ACESSO PROTEGIDO</strong>
              <span>Beta privada no ChatGPT · Supabase preparado para o site público</span>
            </div>
            <small>
              Uma conta nova recebe somente o rack e o minerador inicial. Nenhum CMA,
              bateria ou energia é concedido no cadastro. O mesmo e-mail verificado
              preserva a migração do progresso da beta.
            </small>
          </section>
        </div>
        <PublicSiteFooter />
      </main>
    );
  }

  return (
    <GameErrorBoundary>
      <ArcadiaGame
        user={{
          displayName: user.displayName,
          email: user.email,
        }}
        signOutPath={arcadiaSignOutPath("/", user.provider)}
      />
    </GameErrorBoundary>
  );
}
