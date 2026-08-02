import { AdminDashboard } from "../AdminDashboard";
import {
  arcadiaSignOutPath,
  requireArcadiaUser,
} from "../identity-server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireArcadiaUser("/admin");
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
