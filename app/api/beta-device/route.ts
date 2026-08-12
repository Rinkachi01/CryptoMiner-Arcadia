import { env } from "cloudflare:workers";
import {
  isBetaTextScale,
  isInputMode,
  isViewportBucket,
  readPersonalBetaDevice,
  recordBetaDeviceProfile,
  saveAccessibilityReview,
  type AccessibilityAnswers,
} from "../../beta-device-server";
import { accountIdForUser, getArcadiaUser } from "../../identity-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function betaDeviceContext() {
  const user = await getArcadiaUser();
  if (!user) return null;
  const db = env.DB;
  if (!db) throw new Error("Serviço de acessibilidade indisponível.");
  return {
    accountId: await accountIdForUser(user),
    db,
  };
}

export async function GET() {
  const context = await betaDeviceContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  return json(await readPersonalBetaDevice(context.db, context.accountId));
}

export async function POST(request: Request) {
  const context = await betaDeviceContext();
  if (!context) return json({ error: "Faça login para continuar." }, 401);
  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        answers?: Partial<Record<keyof AccessibilityAnswers, unknown>>;
        inputMode?: unknown;
        notes?: unknown;
        onboardingStage?: unknown;
        textScale?: unknown;
        viewport?: unknown;
      }
    | null;
  if (
    !body ||
    !isViewportBucket(body.viewport) ||
    !isInputMode(body.inputMode) ||
    !isBetaTextScale(body.textScale)
  ) {
    return json({ error: "Perfil de tela inválido." }, 400);
  }
  const now = Date.now();
  const onboardingStage = Number(body.onboardingStage ?? 0);
  if (
    !Number.isInteger(onboardingStage) ||
    onboardingStage < 0 ||
    onboardingStage > 6
  ) {
    return json({ error: "Etapa do guia inválida." }, 400);
  }
  const profileInput = {
    inputMode: body.inputMode,
    onboardingStage,
    textScale: body.textScale,
    viewport: body.viewport,
  };

  if (body.action === "record-profile") {
    return json({
      ...(await recordBetaDeviceProfile(
        context.db,
        context.accountId,
        profileInput,
        now,
      )),
      message: "Perfil de acessibilidade atualizado.",
    });
  }

  if (body.action === "submit-accessibility-review") {
    const answers = body.answers;
    if (
      !answers ||
      typeof answers.textReadable !== "boolean" ||
      typeof answers.controlsEasy !== "boolean" ||
      typeof answers.motionComfortable !== "boolean" ||
      typeof answers.rackClear !== "boolean"
    ) {
      return json({ error: "Responda os quatro itens da avaliação." }, 400);
    }
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > 500) {
      return json({ error: "A observação deve ter até 500 caracteres." }, 400);
    }
    await recordBetaDeviceProfile(
      context.db,
      context.accountId,
      profileInput,
      now,
    );
    return json({
      ...(await saveAccessibilityReview(
        context.db,
        context.accountId,
        {
          answers: answers as AccessibilityAnswers,
          inputMode: body.inputMode,
          notes,
          textScale: body.textScale,
          viewport: body.viewport,
        },
        now,
      )),
      message:
        "Avaliação salva. Nenhuma recompensa ou identificador externo foi criado.",
    });
  }

  return json({ error: "Ação de acessibilidade desconhecida." }, 400);
}
