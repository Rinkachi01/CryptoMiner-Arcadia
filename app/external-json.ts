export async function readBoundedJsonObject(
  response: Response,
  maxBytes = 64_000,
) {
  const parsed = await readBoundedJson(response, maxBytes);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Resposta externa inválida.");
  }
  return parsed as Record<string, unknown>;
}

export async function readBoundedJsonArray(
  response: Response,
  maxBytes = 64_000,
) {
  const parsed = await readBoundedJson(response, maxBytes);
  if (!Array.isArray(parsed)) {
    throw new Error("Resposta externa inválida.");
  }
  return parsed as unknown[];
}

async function readBoundedJson(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new Error("Resposta externa excedeu o limite seguro.");
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("application/json")) {
    throw new Error("Resposta externa não está em JSON.");
  }
  if (!response.body) throw new Error("Resposta externa vazia.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("response_too_large");
      throw new Error("Resposta externa excedeu o limite seguro.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  return JSON.parse(text) as unknown;
}
