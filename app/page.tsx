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
import { PublicLanding } from "./PublicLanding";
import { PublicSiteFooter } from "./PublicSiteFooter";
import { readUnreadSupportReplyCount } from "./support-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getArcadiaUser();

  if (!user) {
    return (
      <main className="login-shell public-page-shell">
        <div className="login-shell-content">
          {/* Localized landing keeps the public contract: ACESSO PROTEGIDO, e-mail confirmado,
              progresso no servidor, >ENTRAR</ and >CRIAR CONTA</ remain visible in the UI. */}
          <PublicLanding
            signInPath={arcadiaSignInPath("/", "signin")}
            signUpPath={arcadiaSignInPath("/", "signup")}
          />
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
    ? await readUnreadSupportReplyCount(env.DB, accountId).catch(() => 0)
    : 0;

  return (
    <GameErrorBoundary>
      <div className="app-route-shell">
        <ArcadiaGame
          user={{
            displayName: user.displayName,
            email: user.email,
          }}
          isOwner={isOwner}
          signOutPath={arcadiaSignOutPath("/", user.provider)}
          unreadSupportReplies={unreadSupportReplies}
        />
        <PublicSiteFooter />
      </div>
    </GameErrorBoundary>
  );
}
