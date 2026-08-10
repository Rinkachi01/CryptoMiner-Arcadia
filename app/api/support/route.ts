import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import { deliverSupportTicket } from "../../support-email-server";
import { validateSupportTicketInput } from "../../support-rules";
import {
  acknowledgeSupportReplies,
  createSupportPublicId,
  ensureSupportSchema,
  readPersonalSupportTickets,
} from "../../support-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function context() {
  const user = await getArcadiaUser();
  if (!user) return null;
  if (!env.DB) throw new Error("Banco autoritativo indisponível.");
  await ensureSupportSchema(env.DB);
  return {
    accountId: await accountIdForUser(user),
    db: env.DB,
    user,
  };
}

export async function GET() {
  const current = await context();
  if (!current) return json({ error: "Faça login para ver seus chamados." }, 401);
  const tickets = await readPersonalSupportTickets(current.db, current.accountId);
  return json({
    tickets,
    unreadReplies: tickets.filter((ticket) => ticket.replyUnread).length,
  });
}

export async function PATCH() {
  const current = await context();
  if (!current) return json({ error: "Faça login para continuar." }, 401);
  const acknowledged = await acknowledgeSupportReplies(
    current.db,
    current.accountId,
    Date.now(),
  );
  return json({ acknowledged, unreadReplies: 0 });
}

export async function POST(request: Request) {
  const current = await context();
  if (!current) return json({ error: "Faça login para abrir um chamado." }, 401);
  const body = (await request.json().catch(() => null)) as
    | { category?: unknown; message?: unknown; subject?: unknown }
    | null;
  const input = validateSupportTicketInput(body ?? {});
  if (!input.valid) return json({ error: input.error }, 400);

  const now = Date.now();
  const [latest, daily] = await Promise.all([
    current.db
      .prepare(
        `SELECT created_at FROM support_tickets
         WHERE account_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(current.accountId)
      .first<{ created_at: number }>(),
    current.db
      .prepare(
        `SELECT COUNT(*) AS total FROM support_tickets
         WHERE account_id = ? AND created_at >= ?`,
      )
      .bind(current.accountId, now - 24 * 60 * 60 * 1000)
      .first<{ total: number }>(),
  ]);
  if (latest && now - Number(latest.created_at) < 60_000) {
    return json({ error: "Aguarde um minuto antes de abrir outro chamado." }, 429);
  }
  if (Number(daily?.total ?? 0) >= 5) {
    return json({ error: "Limite diário de chamados alcançado." }, 429);
  }

  const id = crypto.randomUUID();
  const publicId = createSupportPublicId(id);
  await current.db
    .prepare(
      `INSERT INTO support_tickets (
        id, public_id, account_id, email, category, subject, message,
        status, delivery_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'processing', ?, ?)`,
    )
    .bind(
      id,
      publicId,
      current.accountId,
      current.user.email,
      input.category,
      input.subject,
      input.message,
      now,
      now,
    )
    .run();

  const delivery = await deliverSupportTicket(env, {
    category: input.category,
    email: current.user.email,
    message: input.message,
    publicId,
    subject: input.subject,
  });
  await current.db
    .prepare(
      `UPDATE support_tickets
       SET delivery_status = ?, provider_message_id = ?, updated_at = ?
       WHERE id = ? AND account_id = ?`,
    )
    .bind(
      delivery.status,
      "providerId" in delivery ? delivery.providerId : null,
      Date.now(),
      id,
      current.accountId,
    )
    .run();

  return json({
    deliveryStatus: delivery.status,
    message:
      delivery.status === "sent"
        ? "Chamado registrado e encaminhado ao suporte."
        : "Chamado registrado na Central Arcadia.",
    publicId,
    tickets: await readPersonalSupportTickets(current.db, current.accountId),
  });
}
