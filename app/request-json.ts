export type BoundedRequestJsonError =
  | "payload_too_large"
  | "unsupported_media_type"
  | "invalid_json";

export type BoundedRequestJsonResult<T extends Record<string, unknown>> =
  | { value: T }
  | { error: BoundedRequestJsonError };

/** Read a small JSON object while enforcing a byte ceiling during streaming. */
export async function readBoundedRequestJson<
  T extends Record<string, unknown>,
>(
  request: Request,
  maximumBytes = 32_000,
): Promise<BoundedRequestJsonResult<T>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.split(";", 1)[0].trim().includes("application/json")) {
    return { error: "unsupported_media_type" };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    return { error: "payload_too_large" };
  }

  if (!request.body) return { error: "invalid_json" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel("payload_too_large").catch(() => undefined);
      return { error: "payload_too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return { error: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "invalid_json" };
  }
  return { value: parsed as T };
}
