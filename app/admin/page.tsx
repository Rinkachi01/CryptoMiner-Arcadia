import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import {
  adminOwnerAccountIdFromEnv,
  isConfiguredAdminOwner,
} from "../admin-settings";
import { AdminDashboard } from "../AdminDashboard";
import {
  accountIdForUser,
  arcadiaSignOutPath,
  requireArcadiaUser,
} from "../identity-server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireArcadiaUser("/admin");
  const accountId = await accountIdForUser(user);
  if (!isConfiguredAdminOwner(accountId, adminOwnerAccountIdFromEnv(env))) {
    redirect("/");
  }
  return (
    <AdminDashboard
      user={{
        displayName: user.displayName,
        email: user.email,
      }}
      signOutPath={arcadiaSignOutPath("/", user.provider)}
    />
  );
}
