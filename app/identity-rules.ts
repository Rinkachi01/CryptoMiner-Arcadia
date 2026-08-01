export const CURRENT_IDENTITY_PROVIDER = "chatgpt" as const;
export const PUBLIC_ACCOUNT_STATUS = "planned" as const;

export async function accountIdForVerifiedEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
