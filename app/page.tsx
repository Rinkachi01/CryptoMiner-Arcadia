import { env } from "cloudflare:workers";
import {
  adminOwnerAccountIdFromEnv,
  isConfiguredAdminOwner,
} from "./admin-settings";
import { ArcadiaGame } from "./ArcadiaGame";
import {
  accountIdForUser,
  arcadiaSignInPath,
  arcadiaSignOutPath,
  getArcadiaUser,
} from "./identity-server";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { PublicSiteFooter } from "./PublicSiteFooter";
import { readUnreadSupportReplyCount } from "./support-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getArcadiaUser();

  if (!user) {
    return (
      <main className="login-shell public-page-shell">
        <div className="login-shell-content">
          <div className="login-entry-layout">
            <section className="login-showcase">
              <span className="login-kicker">ECONOMIA CONTROLADA PELO SERVIDOR</span>
              <h1>Construa sua operação. Dispute blocos globais.</h1>
              <p>
                Monte salas, organize racks, energize seus mineradores e divida
                seu poder entre CMA, Bitcoin e Dogecoin. Todas as recompensas são
                conferidas pelo servidor.
              </p>
              <div className="login-feature-grid">
                <article>
                  <b>03</b>
                  <strong>POOLS GLOBAIS</strong>
                  <span>CMA, BTC, DOGE e LTC com distribuição livre de poder.</span>
                </article>
                <article>
                  <b>10m</b>
                  <strong>BLOCO FIXO</strong>
                  <span>Mais poder altera a participação, não a emissão total.</span>
                </article>
                <article>
                  <b>12h</b>
                  <strong>CICLO DE ENERGIA</strong>
                  <span>Baterias e Arcade mantêm a operação ativa.</span>
                </article>
              </div>
              <div className="login-beta-note">
                <span />
                Progresso individual protegido e sincronizado por conta
              </div>
            </section>

            <section className="login-card">
              <div className="login-brand-mark">CMA</div>
              <span>CRYPTO MINER ARCADIA</span>
              <h2>Sua operação começa com uma conta protegida.</h2>
              <p>
                Entre na sua operação ou crie uma conta. O e-mail confirmado
                protege o seu progresso em qualquer dispositivo.
              </p>
              <div className="login-actions">
                <a href={arcadiaSignInPath("/", "signin")}>ENTRAR</a>
                <a className="secondary" href={arcadiaSignInPath("/", "signup")}>CRIAR CONTA</a>
              </div>
              <div className="login-access-status">
                <strong>ACESSO PROTEGIDO</strong>
                <span>Conta verificada · progresso no servidor</span>
              </div>
              <small>
                Uma conta nova recebe somente um rack e o minerador inicial.
                Nenhum CMA, bateria ou energia é concedido no cadastro.
              </small>
            </section>
          </div>
        </div>
        <PublicSiteFooter />
      </main>
    );
  }

  const accountId = await accountIdForUser(user);
  const isOwner = isConfiguredAdminOwner(
    accountId,
    adminOwnerAccountIdFromEnv(env),
  );
  const unreadSupportReplies = env.DB
    ? await readUnreadSupportReplyCount(env.DB, accountId)
    : 0;

  return (
    <GameErrorBoundary>
      <ArcadiaGame
        user={{
          displayName: user.displayName,
          email: user.email,
        }}
        isOwner={isOwner}
        signOutPath={arcadiaSignOutPath("/", user.provider)}
        unreadSupportReplies={unreadSupportReplies}
      />
    </GameErrorBoundary>
  );
}
