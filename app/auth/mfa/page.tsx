import { redirect } from "next/navigation";
import { safeArcadiaReturnPath } from "../../identity-rules";
import { PublicSiteFooter } from "../../PublicSiteFooter";
import { publicLoginConfig } from "../../supabase-server";
import { MfaChallenge } from "./MfaChallenge";

export const dynamic = "force-dynamic";

type MfaPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function MfaPage({ searchParams }: MfaPageProps) {
  const params = await searchParams;
  const config = publicLoginConfig();
  if (!config?.enabled) redirect("/auth?mode=signin");
  const next = safeArcadiaReturnPath(params.next);

  return (
    <main className="public-page-shell">
      <MfaChallenge
        next={next}
        publishableKey={config.publishableKey}
        supabaseUrl={config.url}
      />
      <PublicSiteFooter />
    </main>
  );
}
