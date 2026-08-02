import { env } from "cloudflare:workers";
import {
  claimOrVerifyAdminOwner,
  writeAdminAudit,
} from "../../../../admin-settings";
import {
  accountIdForUser,
  getArcadiaUser,
} from "../../../../identity-server";
import {
  readLatestRecoveryObject,
  recoveryBucketFromEnv,
} from "../../../../recovery-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getArcadiaUser();
  const db = env.DB;
  if (!user || !db) {
    return Response.json({ error: "Faça login para continuar." }, { status: 401 });
  }
  const now = Date.now();
  const accountId = await accountIdForUser(user);
  const owner = await claimOrVerifyAdminOwner(
    db,
    accountId,
    user.email,
    now,
  );
  if (!owner.allowed) {
    return Response.json(
      { error: "Cópia disponível apenas ao proprietário." },
      { status: 403 },
    );
  }
  const latest = await readLatestRecoveryObject(
    db,
    recoveryBucketFromEnv(env),
  );
  if (!latest) {
    return Response.json(
      { error: "Nenhuma cópia externa está disponível." },
      { status: 404 },
    );
  }
  await writeAdminAudit(
    db,
    accountId,
    "recovery_archive_downloaded",
    { archiveId: latest.archive.id },
    now,
  );
  const date = new Date(latest.archive.createdAt).toISOString().slice(0, 10);
  return new Response(latest.object.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="arcadia-recovery-${date}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
