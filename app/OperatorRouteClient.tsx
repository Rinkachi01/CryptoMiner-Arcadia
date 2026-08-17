"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import { GameErrorBoundary } from "./GameErrorBoundary";
import type { ViewId } from "./ArcadiaGame";

const ArcadiaGame = lazy(() =>
  import("./ArcadiaGame").then(({ ArcadiaGame: Game }) => ({ default: Game })),
);

const noHydrationSubscription = () => () => {};
const serverHydrationSnapshot = () => false;
const clientHydrationSnapshot = () => true;

type OperatorRouteClientProps = {
  user: {
    displayName: string;
    email: string;
  };
  isOwner: boolean;
  signOutPath: string;
  unreadSupportReplies: number;
};

/**
 * Keeps the authenticated operator route light during the Worker request.
 *
 * ArcadiaGame is intentionally a large interactive client surface. Rendering
 * that tree during the server request makes the `/operador` RSC response do
 * unnecessary work and can push Cloudflare's free CPU budget over the limit.
 * The authenticated shell only needs to be interactive after hydration, so
 * the heavy tree is mounted in the browser instead.
 */
export function OperatorRouteClient({
  user,
  isOwner,
  signOutPath,
  unreadSupportReplies,
}: OperatorRouteClientProps) {
  const hydrated = useSyncExternalStore(
    noHydrationSubscription,
    clientHydrationSnapshot,
    serverHydrationSnapshot,
  );

  if (!hydrated) {
    return (
      <main className="operator-route-skeleton" aria-busy="true">
        <span>Carregando central do operador…</span>
      </main>
    );
  }

  return (
    <GameErrorBoundary>
      <Suspense
        fallback={
          <main className="operator-route-skeleton" aria-busy="true">
            <span>Carregando central do operador…</span>
          </main>
        }
      >
        <ArcadiaGame
          initialView={"career" satisfies ViewId}
          user={user}
          isOwner={isOwner}
          signOutPath={signOutPath}
          unreadSupportReplies={unreadSupportReplies}
        />
      </Suspense>
    </GameErrorBoundary>
  );
}
