export const CURRENT_IDENTITY_PROVIDER = "chatgpt" as const;
export const PUBLIC_IDENTITY_PROVIDER = "supabase" as const;
export const PUBLIC_ACCOUNT_STATUS = "implemented_guarded" as const;

export function safeArcadiaReturnPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    if (url.pathname.startsWith("/auth")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export async function accountIdForVerifiedEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
