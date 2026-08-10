import { env } from "cloudflare:workers";
import { processNowPaymentsIpn } from "../../../wallet-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 64_000) return json({ error: "payload_too_large" }, 413);
  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 64_000) {
    return json({ error: "invalid_payload" }, 400);
  }
  const signature = request.headers.get("x-nowpayments-sig") ?? "";
  try {
    const payload = JSON.parse(rawBody) as unknown;
    const result = await processNowPaymentsIpn({
      db: env.DB,
      environment: env,
      payload,
      signature,
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "provider_event_failed";
    console.error(
      JSON.stringify({
        message: "nowpayments_ipn_failed",
        reason: message.slice(0, 180),
      }),
    );
    if (message.includes("Assinatura")) return json({ error: "invalid_signature" }, 401);
    if (message.includes("inválid") || message.includes("referência")) {
      return json({ error: "invalid_payload" }, 400);
    }
    return json({ error: "processing_pending" }, 503);
  }
}
