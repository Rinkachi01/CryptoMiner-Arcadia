import { redirect } from "next/navigation";
import { getArcadiaUser } from "../../identity-server";
import { safeArcadiaReturnPath } from "../../identity-rules";
import { PublicSiteFooter } from "../../PublicSiteFooter";
import { publicLoginConfig } from "../../supabase-server";
import { EmailCycleCheck } from "./EmailCycleCheck";

export const dynamic = "force-dynamic";

type EmailCheckPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}${"•".repeat(Math.max(2, local.length - prefix.length))}@${domain}`;
}

export default async function EmailCheckPage({ searchParams }: EmailCheckPageProps) {
  const user = await getArcadiaUser();
  const config = publicLoginConfig();
  if (!user || !config?.enabled) redirect("/auth?mode=signin");
  const params = await searchParams;
  const next = safeArcadiaReturnPath(params.next);

  return (
    <main className="public-page-shell email-cycle-page">
      <EmailCycleCheck email={maskEmail(user.verifiedEmail)} next={next} />
      <PublicSiteFooter />
    </main>
  );
}
