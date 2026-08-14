import { env } from "cloudflare:workers";
import { notFound, redirect } from "next/navigation";
import { ArcadiaGame, type ViewId } from "../ArcadiaGame";
import {
  accountIdForUser,
  arcadiaSignInPath,
  arcadiaSignOutPath,
  getArcadiaUser,
} from "../identity-server";
import {
  adminOwnerAccountIdFromEnv,
  isConfiguredAdminOwner,
} from "../admin-settings";
import { readUnreadSupportReplyCount } from "../support-server";
import { GameErrorBoundary } from "../GameErrorBoundary";
import { PublicSiteFooter } from "../PublicSiteFooter";

export const dynamic = "force-dynamic";

const routeAliases: Record<string, ViewId> = {
  sala: "mine",
  pools: "pools",
  carteira: "conversion",
  inventario: "inventory",
  loja: "shop",
  minigames: "games",
  temporada: "season",
  ranking: "leaderboard",
  tarefas: "tasks",
  operador: "career",
};

export default async function ViewRoute({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const initialView = routeAliases[view];
  if (!initialView) notFound();

  const user = await getArcadiaUser();
  if (!user) redirect(arcadiaSignInPath(`/${view}`));

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
          initialView={initialView}
          user={{ displayName: user.displayName, email: user.email }}
          isOwner={isOwner}
          signOutPath={arcadiaSignOutPath("/", user.provider)}
          unreadSupportReplies={unreadSupportReplies}
        />
        <PublicSiteFooter />
      </div>
    </GameErrorBoundary>
  );
}
