import { walletProviderReadiness } from "./wallet-server.ts";

type PublicLaunchEnvironment = {
  BITPAY_TOKEN?: string;
  CRYPTO_DEPOSITS_ENABLED?: string;
  PUBLIC_BASE_URL?: string;
  PUBLIC_LOGIN_ENABLED?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_URL?: string;
};

export type PublicLaunchReadiness = {
  deposits: {
    configured: boolean;
    enabled: boolean;
    model: "provider_invoice";
    provider: "bitpay_candidate";
  };
  hosting: {
    customDomain: boolean;
    https: boolean;
    provider: "cloudflare_sites";
  };
  identity: {
    projectConfigured: boolean;
    provider: "supabase";
    publicLoginEnabled: boolean;
  };
  wallet: {
    custody: "provider_managed";
    ledger: "individual";
    privateKeysInArcadia: false;
  };
  withdrawals: {
    cmaWithdrawable: false;
    cryptoEnabled: false;
    provider: "not_selected";
  };
};

function environmentObject(value: unknown) {
  return (value ?? {}) as PublicLaunchEnvironment;
}

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function validSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function validPublishableKey(value: string | undefined) {
  if (!value) return false;
  const key = value.trim();
  return key.startsWith("sb_publishable_") || key.length >= 80;
}

function hostingStatus(requestUrl: string | undefined) {
  try {
    const url = new URL(requestUrl ?? "");
    const managedPreview =
      url.hostname.endsWith(".chatgpt.site") ||
      url.hostname.endsWith(".workers.dev") ||
      url.hostname.endsWith(".pages.dev");
    return {
      customDomain: url.protocol === "https:" && !managedPreview,
      https: url.protocol === "https:",
      provider: "cloudflare_sites" as const,
    };
  } catch {
    return {
      customDomain: false,
      https: false,
      provider: "cloudflare_sites" as const,
    };
  }
}

export function readPublicLaunchReadiness(
  environment: unknown,
  requestUrl?: string,
): PublicLaunchReadiness {
  const source = environmentObject(environment);
  const identityConfigured =
    validSupabaseUrl(source.SUPABASE_URL) &&
    validPublishableKey(source.SUPABASE_PUBLISHABLE_KEY);
  const deposits = walletProviderReadiness(source);

  return {
    deposits: {
      configured: deposits.providerReady,
      enabled: deposits.depositsEnabled,
      model: "provider_invoice",
      provider: "bitpay_candidate",
    },
    hosting: hostingStatus(requestUrl ?? source.PUBLIC_BASE_URL),
    identity: {
      projectConfigured: identityConfigured,
      provider: "supabase",
      publicLoginEnabled:
        identityConfigured && enabled(source.PUBLIC_LOGIN_ENABLED),
    },
    wallet: {
      custody: "provider_managed",
      ledger: "individual",
      privateKeysInArcadia: false,
    },
    withdrawals: {
      cmaWithdrawable: false,
      cryptoEnabled: false,
      provider: "not_selected",
    },
  };
}
