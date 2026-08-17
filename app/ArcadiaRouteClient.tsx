"use client";

import { useEffect, useState } from "react";
import { ArcadiaGame, type ViewId } from "./ArcadiaGame";
import { GameErrorBoundary } from "./GameErrorBoundary";

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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <main className="operator-route-skeleton" aria-busy="true">
        <span>Carregando central do operador…</span>
      </main>
    );
  }

  return (
    <GameErrorBoundary>
      <ArcadiaGame
        initialView={initialView}
        user={user}
        isOwner={isOwner}
        signOutPath={signOutPath}
        unreadSupportReplies={unreadSupportReplies}
      />
    </GameErrorBoundary>
  );
}
