import { env } from "cloudflare:workers";
import { notFound, redirect } from "next/navigation";
import type { ViewId } from "../ArcadiaGame";
import { ArcadiaRouteClient } from "../ArcadiaRouteClient";
import { OperatorRouteClient } from "../OperatorRouteClient";
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
import { PublicSiteFooter } from "../PublicSiteFooter";

export const dynamic = "force-dynamic";

const routeAliases: Record<string, ViewId> = {
  sala: "mine",
  pools: "pools",
  carteira: "conversion",
  inventario: "inventory",
  oficina: "forge",
  loja: "shop",
  minigames: "games",
  temporada: "season",
  ranking: "leaderboard",
  tarefas: "tasks",
  operador: "career",
};

export default async function ViewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const { view } = await params;
  const rawTab = (await searchParams)?.tab;
  const tab = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const initialCareerTab =
    tab === "referrals" || tab === "activity" || tab === "overview"
      ? tab
      : "overview";
  const initialView = routeAliases[view];
  if (!initialView) notFound();

  const user = await getArcadiaUser();
  const returnPath =
    initialView === "career" && tab
      ? `/${view}?tab=${encodeURIComponent(initialCareerTab)}`
      : `/${view}`;
  if (!user) redirect(arcadiaSignInPath(returnPath));

  const accountId = await accountIdForUser(user);
  const isOwner = isConfiguredAdminOwner(
    accountId,
    adminOwnerAccountIdFromEnv(env),
  );
  const unreadSupportReplies = env.DB
    ? await readUnreadSupportReplyCount(env.DB, accountId).catch(() => 0)
    : 0;

  const sharedProps = {
    user: { displayName: user.displayName, email: user.email },
    isOwner,
    signOutPath: arcadiaSignOutPath("/", user.provider),
    unreadSupportReplies,
  };

  if (initialView === "career") {
    return (
      <div className="app-route-shell">
        <OperatorRouteClient
          {...sharedProps}
          initialCareerTab={initialCareerTab}
        />
        <PublicSiteFooter />
      </div>
    );
  }

  return (
    <div className="app-route-shell">
      <ArcadiaRouteClient initialView={initialView} {...sharedProps} />
      <PublicSiteFooter />
    </div>
  );
}
