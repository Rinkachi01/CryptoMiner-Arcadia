import { AdminDashboard } from "../AdminDashboard";
import {
  chatGPTSignOutPath,
  requireChatGPTUser,
} from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  return (
    <AdminDashboard
      user={{
        displayName: user.displayName,
        email: user.email,
      }}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
