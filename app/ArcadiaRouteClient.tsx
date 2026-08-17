"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import type { ViewId } from "./ArcadiaGame";
import { GameErrorBoundary } from "./GameErrorBoundary";

// Keep the large interactive tree out of the initial browser and Worker path.
// It is fetched only after the lightweight shell has hydrated.
const ArcadiaGame = lazy(() =>
  import("./ArcadiaGame").then(({ ArcadiaGame: Game }) => ({ default: Game })),
);

const noHydrationSubscription = () => () => {};
const serverHydrationSnapshot = () => false;
const clientHydrationSnapshot = () => true;

type ArcadiaRouteClientProps = {
  initialView: ViewId;
  user: {
    displayName: string;
    email: string;
  };
  isOwner: boolean;
  signOutPath: string;
  unreadSupportReplies: number;
};

/**
 * Defers the large interactive game tree until hydration. Authenticated page
 * requests then return a tiny shell instead of server-rendering every panel,
 * which keeps Cloudflare Worker CPU and memory usage predictable.
 */
export function ArcadiaRouteClient({
  initialView,
  user,
  isOwner,
  signOutPath,
  unreadSupportReplies,
}: ArcadiaRouteClientProps) {
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
          initialView={initialView}
          user={user}
          isOwner={isOwner}
          signOutPath={signOutPath}
          unreadSupportReplies={unreadSupportReplies}
        />
      </Suspense>
    </GameErrorBoundary>
  );
}
