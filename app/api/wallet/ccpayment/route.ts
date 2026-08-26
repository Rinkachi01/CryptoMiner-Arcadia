import { env } from "cloudflare:workers";
import {
  readCCPaymentConfig,
  verifyCCPaymentResponse,
} from "../../../ccpayment-rules";
import { processCCPaymentWebhook } from "../../../wallet-server";

export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readBoundedBody(request: Request, maximumBytes: number) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel("payload_too_large").catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/**
 * Receives CCPayment's signed deposit callback.
 *
 * The wallet service binds the signed event to the Arcadia deposit intent,
 * fetches the authoritative record from CCPayment and credits the matching
 * DOGE/LTC/BTC balance idempotently.
 */
export async function POST(request: Request) {
  const config = readCCPaymentConfig(env);
  if (!config.webhookReady) return json({ error: "provider_not_ready" }, 503);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 64_000) return json({ error: "payload_too_large" }, 413);
  const rawBody = await readBoundedBody(request, 64_000);
  if (rawBody === null) return json({ error: "payload_too_large" }, 413);
  if (!rawBody) return json({ error: "invalid_payload" }, 400);

  const appId = request.headers.get("Appid") ?? request.headers.get("appid") ?? "";
  const timestamp = request.headers.get("Timestamp") ?? request.headers.get("timestamp") ?? "";
  const signature = request.headers.get("Sign") ?? request.headers.get("sign") ?? "";
  if (!/^\d{10}$/.test(timestamp)) return json({ error: "invalid_timestamp" }, 401);
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 120) return json({ error: "stale_timestamp" }, 401);
  if (appId !== config.appId) return json({ error: "invalid_signature" }, 401);
  if (
    !(await verifyCCPaymentResponse({
      appId,
      appSecret: config.appSecret,
      timestamp,
      body: rawBody,
      signature,
    }))
  ) {
    return json({ error: "invalid_signature" }, 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json({ error: "invalid_payload" }, 400);
  }
  try {
    await processCCPaymentWebhook({
      db: env.DB,
      environment: env,
      payload: parsed,
    });
  } catch (error) {
    // A temporary provider indexing/RPC failure must be retried by CCPayment;
    // acknowledge only after the event has been safely processed.
    console.error("ccpayment_webhook_failed", {
      reason: error instanceof Error ? error.message.slice(0, 180) : "unknown_error",
    });
    return json({ error: "processing_pending" }, 503);
  }

  // CCPayment's activation probe checks the raw response body for the
  // acknowledgement token. Keep the callback side effects above, then return
  // the exact token with no wrapper object or JSON quoting.
  return new Response("Success", {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
