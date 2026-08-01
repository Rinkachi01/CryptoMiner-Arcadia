import { env } from "cloudflare:workers";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";
import {
  ensureBetaFeedbackSchema,
  readPersonalBetaFeedback,
} from "../../feedback-server";
import { isBetaFeedbackCategory } from "../../feedback-rules";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function feedbackContext() {
  const user = await getArcadiaUser();
  if (!user) return null;
  const db = env.DB;
  if (!db) throw new Error("Banco autoritativo indisponível.");
  await ensureBetaFeedbackSchema(db);
  return {
    accountId: await accountIdForUser(user),
    db,
  };
}

export async function GET() {
  const context = await feedbackContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  return json({
    submissions: await readPersonalBetaFeedback(
      context.db,
      context.accountId,
    ),
  });
}

export async function POST(request: Request) {
  const context = await feedbackContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as
    | {
        category?: unknown;
        message?: unknown;
        page?: unknown;
        rating?: unknown;
      }
    | null;
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  const rating = Number(body?.rating);
  if (
    !isBetaFeedbackCategory(body?.category) ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    message.length < 10 ||
    message.length > 800
  ) {
    return json(
      {
        error:
          "Escolha uma categoria, uma nota de 1 a 5 e escreva entre 10 e 800 caracteres.",
      },
      400,
    );
  }

  const now = Date.now();
  const latest = await context.db
    .prepare(
      `SELECT created_at
       FROM beta_feedback
       WHERE account_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(context.accountId)
    .first<{ created_at: number }>();
  if (latest && now - Number(latest.created_at) < 30_000) {
    return json(
      { error: "Aguarde alguns segundos antes de enviar outro feedback." },
      429,
    );
  }

  await context.db
    .prepare(
      `INSERT INTO beta_feedback (
        id, account_id, category, rating, message, page, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)`,
    )
    .bind(
      crypto.randomUUID(),
      context.accountId,
      body.category,
      rating,
      message,
      typeof body.page === "string" ? body.page.slice(0, 40) : "tasks",
      now,
    )
    .run();

  return json({
    message: "Feedback enviado para a Central do Proprietário.",
    submissions: await readPersonalBetaFeedback(
      context.db,
      context.accountId,
    ),
  });
}
