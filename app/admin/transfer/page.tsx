import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import {
  adminOwnerAccountIdFromEnv,
  claimOrVerifyAdminOwner,
} from "../../admin-settings";
import { FounderTransferPanel } from "../../FounderTransferPanel";
import { accountIdForUser, requireArcadiaUser } from "../../identity-server";
import { PublicSiteFooter } from "../../PublicSiteFooter";

export const dynamic = "force-dynamic";

async function requireFounderTransferOwner() {
  const user = await requireArcadiaUser("/admin/transfer");
  if (!env.DB) redirect("/admin");
  const accountId = await accountIdForUser(user);
  const owner = await claimOrVerifyAdminOwner(
    env.DB,
    accountId,
    user.email,
    Date.now(),
    adminOwnerAccountIdFromEnv(env),
  );
  if (!owner.allowed) redirect("/");
}

export default async function FounderTransferPage() {
  await requireFounderTransferOwner();
  return (
    <div className="app-route-shell">
      <main className="founder-transfer-shell">
        <FounderTransferPanel />
      </main>
      <PublicSiteFooter />
    </div>
  );
}
