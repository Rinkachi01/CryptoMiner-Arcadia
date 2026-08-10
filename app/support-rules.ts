export const supportCategories = [
  "account",
  "game",
  "wallet",
  "security",
  "other",
] as const;

export type SupportCategory = (typeof supportCategories)[number];

export const supportCategoryLabels: Record<SupportCategory, string> = {
  account: "Conta e acesso",
  game: "Jogo e inventário",
  wallet: "Carteira e conversões",
  security: "Segurança",
  other: "Outro assunto",
};

export function isSupportCategory(value: unknown): value is SupportCategory {
  return supportCategories.includes(value as SupportCategory);
}

export function validateSupportTicketInput(value: {
  category?: unknown;
  message?: unknown;
  subject?: unknown;
}) {
  const subject =
    typeof value.subject === "string"
      ? value.subject.replace(/\s+/g, " ").trim()
      : "";
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!isSupportCategory(value.category)) {
    return { valid: false as const, error: "Escolha um assunto de atendimento." };
  }
  if (subject.length < 5 || subject.length > 100) {
    return { valid: false as const, error: "O título deve ter entre 5 e 100 caracteres." };
  }
  if (message.length < 20 || message.length > 2_000) {
    return { valid: false as const, error: "Descreva o problema usando entre 20 e 2.000 caracteres." };
  }
  return {
    valid: true as const,
    category: value.category,
    message,
    subject,
  };
}
