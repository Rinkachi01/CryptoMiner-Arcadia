import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  requireChatGPTUser,
  type ChatGPTUser,
} from "./chatgpt-auth.ts";
import {
  accountIdForVerifiedEmail,
  CURRENT_IDENTITY_PROVIDER,
} from "./identity-rules.ts";

export {
  accountIdForVerifiedEmail,
  CURRENT_IDENTITY_PROVIDER,
  PUBLIC_ACCOUNT_STATUS,
} from "./identity-rules.ts";

export type ArcadiaUser = ChatGPTUser & {
  provider: typeof CURRENT_IDENTITY_PROVIDER;
  providerSubject: string;
  verifiedEmail: string;
};

function toArcadiaUser(user: ChatGPTUser): ArcadiaUser {
  return {
    ...user,
    provider: CURRENT_IDENTITY_PROVIDER,
    providerSubject: user.userId,
    verifiedEmail: user.email.trim().toLowerCase(),
  };
}

export async function getArcadiaUser(): Promise<ArcadiaUser | null> {
  const user = await getChatGPTUser();
  return user ? toArcadiaUser(user) : null;
}

export async function requireArcadiaUser(
  returnTo: string,
): Promise<ArcadiaUser> {
  return toArcadiaUser(await requireChatGPTUser(returnTo));
}

export function arcadiaSignInPath(returnTo: string): string {
  return chatGPTSignInPath(returnTo);
}

export function arcadiaSignOutPath(returnTo = "/"): string {
  return chatGPTSignOutPath(returnTo);
}

export function accountIdForUser(user: ArcadiaUser) {
  // Mantém o mesmo identificador usado no beta privado. Quando o cadastro
  // público chegar, um e-mail verificado poderá ser vinculado sem perder o
  // progresso atual.
  return accountIdForVerifiedEmail(user.verifiedEmail);
}
