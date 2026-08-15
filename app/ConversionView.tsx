"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import type { ConversionAssetId } from "./conversion-rules";
import { useArcadiaLanguage } from "./i18n";

type ConvertibleAsset = "BTC" | "DOGE" | "LTC";
type WithdrawableAsset = "BTC" | "DOGE" | "LTC";
type WithdrawalMethod = "crypto" | "pix";
type PixKeyType = "cpf_cnpj" | "email" | "phone" | "random";
type WalletTab = "convert" | "deposit" | "withdraw";
type DepositMethod = "PIX" | ConvertibleAsset;

type MarketRate = {
  asset: ConversionAssetId;
  observedAt: number;
  provider: "coinbase" | "coingecko";
  stale: boolean;
  usdPrice: number;
};

type Quote = {
  asset: ConversionAssetId;
  assetAmount: number;
  assetAmountAtomic: number;
  createdAt: number;
  eligible: boolean;
  expiresAt: number;
  feeBps: number;
  feeCma: number;
  grossCma: number;
  grossUsd: number;
  id: string;
  netCma: number;
  rateUsd: number;
  status: "preview";
  targetCma: number;
};

type ConversionResponse = {
  conversionEnabled: true;
  error?: string;
  message?: string;
  policy?: {
    cmaUsdReference: number;
    feeBps: number;
    minimumUsd: number;
    oneWayOnly: boolean;
    withdrawableCma: boolean;
  };
  quote?: Quote;
  rates?: MarketRate[];
  version?: number;
};

type WalletResponse = {
  account?: {
    custodyMode: "provider_invoice";
    depositStatus: "awaiting_provider" | "ready";
    ledgerModel: "individual";
  };
  deposits?: {
    assets: ["BTC", "DOGE", "LTC"];
    accessAllowed: boolean;
    activationRequested: boolean;
    enabled: boolean;
    liveActivationRequested: boolean;
    mode: "disabled" | "live" | "sandbox";
    provider: "nowpayments";
    providerReady: boolean;
    providerSandbox: boolean;
    ownerOnly: boolean;
    missingSetup: Array<"api_key" | "ipn_secret" | "public_url">;
    sandboxEnabled: boolean;
    recent: Array<{
      asset: string;
      checkoutUrl: string | null;
      createdAt: number;
      expiresAt: number | null;
      id: string;
      provider: string;
      requestedUsd: number;
      receivedAtomic: number;
      settlementAsset: string | null;
      status: string;
    }>;
  };
  error?: string;
  withdrawals?: {
    assets: ["BTC", "DOGE", "LTC"];
    brlFeeBps: number;
    brlMinimumCents: number;
    cryptoMinimumBrlCents: number;
    enabled: boolean;
    minimumAtomic: Record<WithdrawableAsset, number>;
    ratesAvailable: boolean;
    ratesObservedAt: number | null;
    recent: Array<{
      amountAtomic: number;
      asset: string;
      createdAt: number;
      destinationPreview: string;
      id: string;
      payoutAsset: "BRL" | "CRYPTO";
      payoutBrlCents: number;
      resolvedAt: number | null;
      reviewNote: string | null;
      status: string;
      transactionReference: string | null;
      updatedAt: number;
    }>;
    recentSandbox: Array<{
      amountAtomic: number;
      asset: string;
      createdAt: number;
      id: string;
      status: string;
    }>;
    sandboxEnabled: boolean;
  };
};

type SandboxResponse = {
  error?: string;
  message?: string;
  simulation?: {
    amountAtomic?: number;
    asset: ConvertibleAsset;
    expiresAt?: number;
    id: string;
    requestedUsd?: number;
    status: "simulation_only";
  };
};

type DepositResponse = {
  deposit?: {
    asset: ConvertibleAsset;
    checkoutUrl: string;
    expiresAt: number;
    id: string;
    provider: "nowpayments";
    requestedUsd: number;
    status: "waiting";
  };
  error?: string;
  message?: string;
};

type DepositMinimumResponse = {
  error?: string;
  minimum?: {
    asset: ConvertibleAsset;
    minimumUsd: number;
    observedAt: number;
    settlementAsset: string;
  };
};

type PixQuote = {
  brlAmount: number;
  brlCents: number;
  expiresAt: number;
  marginBps: number;
  observedAt: number;
  provider: "bcb_ptax";
  targetCma: number;
  usdBrl: number;
};

type PixOverview = {
  enabled: boolean;
  error?: string;
  missingSetup: Array<"access_token" | "webhook_secret" | "public_url">;
  mode: "test" | "production";
  operationalMarginBps: number;
  provider: "mercadopago";
  providerReady: boolean;
  requested: boolean;
  reconciliation?: { checked: number; credited: number; unavailable: number };
  recent: Array<{
    brlAmount: number;
    cmaUnits: number;
    creditedAt: number | null;
    createdAt: number;
    expiresAt: number;
    id: string;
    status: string;
    ticketUrl: string | null;
    updatedAt: number;
  }>;
};

type PixResponse = {
  error?: string;
  message?: string;
  overview?: PixOverview;
  reconciliation?: { checked: number; credited: number; unavailable: number };
  pix?: PixQuote & {
    id: string;
    providerReference: string;
    qrCode: string;
    status: "waiting_transfer";
    ticketUrl: string;
  };
  quote?: PixQuote;
};

type WithdrawalResponse = {
  error?: string;
  message?: string;
  withdrawal?: {
    amountAtomic: number;
    asset: WithdrawableAsset;
    destinationPreview: string;
    id: string;
    netBrl?: number;
    sourceAtomic?: number;
    status: string;
  };
};

type BrlWithdrawalQuote = {
  asset: WithdrawableAsset;
  brlPrice: number;
  expiresAt: number;
  feeBrl: number;
  feeBps: number;
  grossBrl: number;
  id: string;
  netBrl: number;
  observedAt: number;
  sourceAmount: number;
  sourceAtomic: number;
};

type BrlWithdrawalResponse = WithdrawalResponse & {
  quote?: BrlWithdrawalQuote;
};

type ConversionViewProps = {
  btcBalanceAtomic: number;
  cmaBalance: number;
  dogeBalanceAtomic: number;
  ltcBalanceAtomic: number;
  onRefreshAccount: () => Promise<boolean>;
  serverVersion: number;
};

const assetVisuals: Record<ConvertibleAsset, { asset: string; name: string }> = {
  BTC: { asset: assetsManifest.bitcoin.path, name: "Bitcoin" },
  DOGE: { asset: assetsManifest.dogecoin.path, name: "Dogecoin" },
  LTC: { asset: assetsManifest.litecoin.path, name: "Litecoin" },
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "USD",
    maximumFractionDigits: value < 1 ? 6 : 2,
    minimumFractionDigits: value < 1 ? 2 : 2,
    style: "currency",
  }).format(value);
}

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatCma(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
  });
}

function formatCryptoAtomic(value: number, digits = 8) {
  if (typeof value !== "number" || Number.isNaN(value)) value = 0;
  return (value / 100_000_000).toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function withdrawalStatusLabel(status: string) {
  return {
    paid: "PAGO",
    rejected: "RECUSADO · SALDO ESTORNADO",
    requested: "AGUARDANDO ANÁLISE",
    reviewing: "EM ANÁLISE",
  }[status] ?? status.replaceAll("_", " ").toUpperCase();
}

function pixStatus(status: string) {
  if (status === "credited") return { label: "CMA CREDITADO", tone: "success" };
  if (status.includes("processing") || status.includes("in_process")) {
    return { label: "EM ANÁLISE", tone: "review" };
  }
  if (status.includes("rejected") || status.includes("cancel")) {
    return { label: "RECUSADO", tone: "failed" };
  }
  if (status.includes("expired")) return { label: "EXPIRADO", tone: "failed" };
  if (status === "provider_failed") return { label: "NÃO CRIADO", tone: "failed" };
  return { label: "AGUARDANDO PAGAMENTO", tone: "waiting" };
}

function isPendingPixStatus(status: string) {
  return (
    !["credited", "provider_failed"].includes(status) &&
    !status.startsWith("canceled:") &&
    !status.startsWith("expired:") &&
    !status.startsWith("rejected:")
  );
}

function nowPaymentsStatus(status: string, english: boolean) {
  const labels: Record<string, { en: string; pt: string; tone: string }> = {
    waiting: { en: "Waiting for payment", pt: "Aguardando pagamento", tone: "waiting" },
    confirming: { en: "Confirming on the network", pt: "Confirmando na rede", tone: "review" },
    confirmed: { en: "Blockchain confirmed", pt: "Confirmado na blockchain", tone: "review" },
    sending: { en: "Settling with the provider", pt: "Liquidando com o provedor", tone: "review" },
    partially_paid: { en: "Partially paid — contact support", pt: "Pagamento parcial — fale com o suporte", tone: "failed" },
    finished: { en: "Credited", pt: "Saldo creditado", tone: "success" },
    credited: { en: "Credited", pt: "Saldo creditado", tone: "success" },
    failed: { en: "Payment failed", pt: "Pagamento falhou", tone: "failed" },
    refunded: { en: "Refunded by provider", pt: "Reembolsado pelo provedor", tone: "failed" },
    expired: { en: "Invoice expired", pt: "Fatura expirada", tone: "failed" },
    provider_failed: { en: "Invoice not created", pt: "Fatura não criada", tone: "failed" },
    review_required: { en: "Under review", pt: "Em revisão", tone: "review" },
    pending_account: { en: "Waiting for account sync", pt: "Aguardando sincronização da conta", tone: "review" },
    crediting: { en: "Applying credit", pt: "Aplicando crédito", tone: "review" },
  };
  const fallback = english ? "Status unavailable" : "Status indisponível";
  const entry = labels[status] ?? { en: fallback, pt: fallback, tone: "waiting" };
  return { label: english ? entry.en : entry.pt, tone: entry.tone };
}

function isPendingNowPaymentsStatus(status: string) {
  return [
    "waiting",
    "confirming",
    "confirmed",
    "sending",
    "partially_paid",
    "crediting",
    "pending_account",
    "review_required",
  ].includes(status);
}

export function ConversionView({
  btcBalanceAtomic,
  cmaBalance,
  dogeBalanceAtomic,
  ltcBalanceAtomic,
  onRefreshAccount,
  serverVersion,
}: ConversionViewProps) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const [tab, setTab] = useState<WalletTab>("deposit");
  const [asset, setAsset] = useState<ConvertibleAsset>("BTC");
  const [targetCma, setTargetCma] = useState("1");
  const [rates, setRates] = useState<MarketRate[]>([]);
  const [policy, setPolicy] = useState<ConversionResponse["policy"]>();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sandboxAmount, setSandboxAmount] = useState("0.001");
  const [sandboxAsset, setSandboxAsset] = useState<ConvertibleAsset>("BTC");
  const [sandboxBusy, setSandboxBusy] = useState<"deposit" | "withdrawal" | null>(null);
  const [sandboxError, setSandboxError] = useState("");
  const [sandboxMessage, setSandboxMessage] = useState("");
  const [sandboxUsd, setSandboxUsd] = useState("10");
  const [depositAsset, setDepositAsset] = useState<ConvertibleAsset>("LTC");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("PIX");
  const [depositUsd, setDepositUsd] = useState("5");
  const [depositMinimums, setDepositMinimums] = useState<
    Partial<Record<ConvertibleAsset, number>>
  >({});
  const [depositMinimumError, setDepositMinimumError] = useState("");
  const [depositBusy, setDepositBusy] = useState<ConvertibleAsset | null>(null);
  const [depositError, setDepositError] = useState("");
  const [withdrawAsset, setWithdrawAsset] = useState<WithdrawableAsset>("DOGE");
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawalMethod>("crypto");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");
  const [brlTarget, setBrlTarget] = useState("20");
  const [brlQuote, setBrlQuote] = useState<BrlWithdrawalQuote | null>(null);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("email");
  const [pixWithdrawalKey, setPixWithdrawalKey] = useState("");
  const [brlWithdrawalBusy, setBrlWithdrawalBusy] = useState<"quote" | "create" | null>(null);
  const [pix, setPix] = useState<PixOverview | null>(null);
  const [pixTargetCma, setPixTargetCma] = useState("1");
  const [pixQuote, setPixQuote] = useState<PixQuote | null>(null);
  const [pixOrder, setPixOrder] = useState<PixResponse["pix"] | null>(null);
  const [pixBusy, setPixBusy] = useState<"quote" | "create" | "refresh" | null>(null);
  const [pixError, setPixError] = useState("");
  const [pixMessage, setPixMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch("/api/conversion", { cache: "no-store" }).then(async (response) => {
        const payload = (await response.json()) as ConversionResponse;
        if (!response.ok || !payload.rates || !payload.policy) {
          throw new Error(payload.error ?? "Não foi possível consultar o mercado.");
        }
        return payload;
      }),
      fetch("/api/wallet", { cache: "no-store" }).then(async (response) => {
        const payload = (await response.json()) as WalletResponse;
        if (!response.ok) throw new Error(payload.error ?? "Carteira indisponível.");
        return payload;
      }),
    ]).then(([conversionResult, walletResult]) => {
        if (!active) return;
        const errors: string[] = [];
        if (conversionResult.status === "fulfilled") {
          setRates(conversionResult.value.rates!);
          setPolicy(conversionResult.value.policy);
        } else {
          errors.push(
            conversionResult.reason instanceof Error
              ? conversionResult.reason.message
              : "Cotação de mercado indisponível.",
          );
        }
        if (walletResult.status === "fulfilled") {
          setWallet(walletResult.value);
        } else {
          errors.push(
            walletResult.reason instanceof Error
              ? walletResult.reason.message
              : "Carteira indisponível.",
          );
        }
        setError(errors.join(" "));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/wallet/pix", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as PixOverview;
        if (!response.ok) throw new Error(payload.error ?? "Pix indisponível.");
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setPix(payload);
        if ((payload.reconciliation?.credited ?? 0) > 0) {
          void onRefreshAccount();
          setPixMessage("Pagamento Pix confirmado e CMA creditado.");
        }
      })
      .catch((reason) => {
        if (active) {
          setPixError(reason instanceof Error ? reason.message : "Pix indisponível.");
        }
      });
    return () => {
      active = false;
    };
  }, [onRefreshAccount]);

  const hasPendingPix = Boolean(
    pix?.recent?.some(
      (entry) => isPendingPixStatus(entry.status),
    ),
  );

  const hasPendingCrypto = Boolean(
    wallet?.deposits?.recent?.some((entry) =>
      isPendingNowPaymentsStatus(entry.status),
    ),
  );

  useEffect(() => {
    if (!hasPendingPix) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/wallet/pix", { cache: "no-store" });
        const payload = (await response.json()) as PixResponse;
        if (!response.ok || !payload.overview) return;
        if (!active) return;
        setPix(payload.overview);
        if ((payload.reconciliation?.credited ?? 0) > 0) {
          await onRefreshAccount();
          setPixMessage("Pagamento Pix confirmado e CMA creditado.");
        }
      } catch {
        // A próxima janela tenta novamente; a cobrança continua pendente no servidor.
      }
    }, 20_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasPendingPix, onRefreshAccount]);

  useEffect(() => {
    if (!hasPendingCrypto) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/wallet", { cache: "no-store" });
        const payload = (await response.json()) as WalletResponse;
        if (!response.ok || !payload.deposits || !active) return;
        setWallet(payload);
        const credited = payload.deposits.recent.some(
          (entry) => entry.status === "credited",
        );
        if (credited) {
          await onRefreshAccount();
          setSuccess(
            english
              ? "Crypto payment confirmed and credited."
              : "Pagamento cripto confirmado e creditado.",
          );
        }
      } catch {
        // The next poll retries; the server remains the source of truth.
      }
    }, 20_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [english, hasPendingCrypto, onRefreshAccount]);

  useEffect(() => {
    if (!wallet?.deposits?.enabled) return;
    let active = true;
    const controller = new AbortController();
    Promise.all(
      (["BTC", "DOGE", "LTC"] as ConvertibleAsset[]).map(async (assetId) => {
        const response = await fetch("/api/wallet", {
          body: JSON.stringify({ action: "deposit-minimum", asset: assetId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const payload = (await response.json()) as DepositMinimumResponse;
        if (!response.ok || !payload.minimum) {
          throw new Error(
            payload.error ?? `Não foi possível consultar o mínimo de ${assetId}.`,
          );
        }
        return payload.minimum;
      }),
    )
      .then((minimums) => {
        if (!active) return;
        const values = Object.fromEntries(
          minimums.map((minimum) => [minimum.asset, minimum.minimumUsd]),
        ) as Record<ConvertibleAsset, number>;
        setDepositMinimums(values);
        setDepositUsd(values.LTC.toFixed(2));
      })
      .catch((reason) => {
        if (!active || controller.signal.aborted) return;
        setDepositMinimumError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível consultar os mínimos atuais.",
        );
      })
    return () => {
      active = false;
      controller.abort();
    };
  }, [wallet?.deposits?.enabled]);

  const depositMinimumBusy = Boolean(
    wallet?.deposits?.enabled &&
      !depositMinimums.BTC &&
      !depositMinimumError,
  );

  const selectedRate = useMemo(
    () => rates.find((rate) => rate.asset === asset),
    [asset, rates],
  );
  const selectedBalanceAtomic =
    asset === "BTC"
      ? btcBalanceAtomic
      : asset === "DOGE"
        ? dogeBalanceAtomic
        : ltcBalanceAtomic;
  const targetCmaUnits = /^\d+$/.test(targetCma) ? Number(targetCma) : 0;
  const estimatedAssetAtomic = useMemo(() => {
    if (
      !selectedRate ||
      !policy ||
      !Number.isSafeInteger(targetCmaUnits) ||
      targetCmaUnits < 1 ||
      targetCmaUnits > 1_000_000
    ) {
      return 0;
    }
    const grossCma = targetCmaUnits / (1 - policy.feeBps / 10_000);
    return Math.ceil(
      ((grossCma * policy.cmaUsdReference) / selectedRate.usdPrice) * 100_000_000,
    );
  }, [policy, selectedRate, targetCmaUnits]);
  const maximumCmaUnits = useMemo(() => {
    if (!selectedRate || !policy || selectedBalanceAtomic <= 0) return 0;
    const availableUsd = (selectedBalanceAtomic / 100_000_000) * selectedRate.usdPrice;
    let maximum = Math.floor(
      (availableUsd / policy.cmaUsdReference) * (1 - policy.feeBps / 10_000),
    );
    while (maximum > 0) {
      const grossCma = maximum / (1 - policy.feeBps / 10_000);
      const requiredAtomic = Math.ceil(
        ((grossCma * policy.cmaUsdReference) / selectedRate.usdPrice) * 100_000_000,
      );
      if (requiredAtomic <= selectedBalanceAtomic) break;
      maximum -= 1;
    }
    return Math.max(0, maximum);
  }, [policy, selectedBalanceAtomic, selectedRate]);
  async function requestQuote() {
    setQuoting(true);
    setQuote(null);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/conversion", {
        body: JSON.stringify({ action: "quote", asset, targetCma }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as ConversionResponse;
      if (!response.ok || !payload.quote) {
        throw new Error(payload.error ?? "Cotação recusada pelo servidor.");
      }
      setQuote(payload.quote);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cotação recusada.");
    } finally {
      setQuoting(false);
    }
  }

  async function executeQuote() {
    if (!quote) return;
    setConverting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/conversion", {
        body: JSON.stringify({
          action: "execute",
          expectedVersion: serverVersion,
          idempotencyKey: crypto.randomUUID(),
          quoteId: quote.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as ConversionResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Conversão recusada pelo servidor.");
      }
      await onRefreshAccount();
      setQuote(null);
      setSuccess(payload.message ?? "Conversão concluída e registrada na carteira.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversão recusada.");
    } finally {
      setConverting(false);
    }
  }

  function changeTargetCma(delta: number) {
    const current = Number.isSafeInteger(targetCmaUnits) && targetCmaUnits >= 1
      ? targetCmaUnits
      : 1;
    setTargetCma(String(Math.min(1_000_000, Math.max(1, current + delta))));
    setQuote(null);
    setError("");
  }

  function useMaximumCma() {
    setQuote(null);
    setSuccess("");
    if (maximumCmaUnits < 1) {
      setError(`Seu saldo em ${asset} ainda não compra 1 CMA.`);
      return;
    }
    setError("");
    setTargetCma(String(maximumCmaUnits));
  }

  async function refreshWallet() {
    setWalletRefreshing(true);
    try {
      const response = await fetch("/api/wallet", { cache: "no-store" });
      const payload = (await response.json()) as WalletResponse;
      if (!response.ok || !payload.deposits) {
        throw new Error(
          payload.error ??
            (english
              ? "The crypto statement could not be refreshed."
              : "Não foi possível atualizar o extrato cripto."),
        );
      }
      setWallet(payload);
      if (payload.deposits.recent.some((entry) => entry.status === "credited")) {
        await onRefreshAccount();
      }
      setSuccess(
        english ? "Crypto statement updated." : "Extrato cripto atualizado.",
      );
    } catch (reason) {
      setDepositError(
        reason instanceof Error
          ? reason.message
          : english
            ? "Could not refresh the crypto statement."
            : "Não foi possível atualizar o extrato cripto.",
      );
    } finally {
      setWalletRefreshing(false);
    }
  }

  async function runSandbox(action: "deposit" | "withdrawal") {
    setSandboxBusy(action);
    setSandboxError("");
    setSandboxMessage("");
    try {
      const response = await fetch("/api/wallet", {
        body: JSON.stringify(
          action === "deposit"
            ? {
                action: "sandbox-deposit",
                asset: sandboxAsset,
                usdAmount: sandboxUsd,
              }
            : {
                action: "sandbox-withdrawal",
                amount: sandboxAmount,
                asset: sandboxAsset,
              },
        ),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as SandboxResponse;
      if (!response.ok || !payload.simulation) {
        throw new Error(payload.error ?? "Simulação recusada pelo servidor.");
      }
      setSandboxMessage(
        `${payload.message ?? "Simulação registrada."} Protocolo ${payload.simulation.id.slice(-8).toUpperCase()}.`,
      );
      const refreshed = await fetch("/api/wallet", { cache: "no-store" });
      if (refreshed.ok) setWallet((await refreshed.json()) as WalletResponse);
    } catch (reason) {
      setSandboxError(
        reason instanceof Error ? reason.message : "Não foi possível simular.",
      );
    } finally {
      setSandboxBusy(null);
    }
  }

  async function createDeposit(assetId: ConvertibleAsset) {
    const minimumUsd = depositMinimums[assetId];
    const requestedUsd = Number(depositUsd);
    if (!minimumUsd || !Number.isFinite(requestedUsd) || requestedUsd < minimumUsd) {
      setDepositError(
        minimumUsd
          ? `O mínimo atual para ${assetId} é ${formatUsd(minimumUsd)}.`
          : `Aguarde a consulta do mínimo atual de ${assetId}.`,
      );
      return;
    }
    setDepositBusy(assetId);
    setDepositError("");
    try {
      const response = await fetch("/api/wallet", {
        body: JSON.stringify({
          action: "create-deposit",
          asset: assetId,
          usdAmount: depositUsd,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as DepositResponse;
      if (!response.ok || !payload.deposit?.checkoutUrl) {
        throw new Error(payload.error ?? "O provedor não criou a fatura.");
      }
      window.location.assign(payload.deposit.checkoutUrl);
    } catch (reason) {
      setDepositError(
        reason instanceof Error ? reason.message : "Não foi possível criar a fatura.",
      );
      setDepositBusy(null);
    }
  }

  async function createWithdrawal() {
    setWithdrawBusy(true);
    setWithdrawError("");
    setWithdrawMessage("");
    try {
      const response = await fetch("/api/wallet", {
        body: JSON.stringify({
          action: "create-withdrawal",
          amount: withdrawAmount,
          asset: withdrawAsset,
          destinationAddress: withdrawAddress,
          expectedVersion: serverVersion,
          idempotencyKey: crypto.randomUUID(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as WithdrawalResponse;
      if (!response.ok || !payload.withdrawal) {
        throw new Error(payload.error ?? "O servidor recusou a solicitação.");
      }
      const accountUpdated = await onRefreshAccount();
      if (!accountUpdated) {
        throw new Error("Saque reservado, mas a tela precisa ser atualizada.");
      }
      const walletResponse = await fetch("/api/wallet", { cache: "no-store" });
      if (walletResponse.ok) {
        setWallet((await walletResponse.json()) as WalletResponse);
      }
      setWithdrawAmount("");
      setWithdrawAddress("");
      setWithdrawMessage(
        `${payload.message ?? "Solicitação registrada."} Protocolo ${payload.withdrawal.id.slice(-8).toUpperCase()}.`,
      );
    } catch (reason) {
      setWithdrawError(
        reason instanceof Error ? reason.message : "Não foi possível solicitar.",
      );
    } finally {
      setWithdrawBusy(false);
    }
  }

  async function quoteBrlWithdrawal() {
    setBrlWithdrawalBusy("quote");
    setWithdrawError("");
    setWithdrawMessage("");
    setBrlQuote(null);
    try {
      const response = await fetch("/api/wallet", {
        body: JSON.stringify({
          action: "brl-withdrawal-quote",
          asset: withdrawAsset,
          targetBrl: brlTarget,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as BrlWithdrawalResponse;
      if (!response.ok || !payload.quote) {
        throw new Error(payload.error ?? "Não foi possível cotar o saque em real.");
      }
      setBrlQuote(payload.quote);
      setWithdrawMessage("Cotação protegida por 2 minutos. Nenhum saldo foi reservado ainda.");
    } catch (reason) {
      setWithdrawError(
        reason instanceof Error ? reason.message : "Não foi possível cotar o saque.",
      );
    } finally {
      setBrlWithdrawalBusy(null);
    }
  }

  async function createBrlWithdrawal() {
    if (!brlQuote) return;
    setBrlWithdrawalBusy("create");
    setWithdrawError("");
    setWithdrawMessage("");
    try {
      const response = await fetch("/api/wallet", {
        body: JSON.stringify({
          action: "create-brl-withdrawal",
          expectedVersion: serverVersion,
          idempotencyKey: crypto.randomUUID(),
          pixKey: pixWithdrawalKey,
          pixKeyType,
          quoteId: brlQuote.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as BrlWithdrawalResponse;
      if (!response.ok || !payload.withdrawal) {
        throw new Error(payload.error ?? "O servidor recusou o saque Pix.");
      }
      const accountUpdated = await onRefreshAccount();
      if (!accountUpdated) {
        throw new Error("Saldo reservado; atualize a página para conferir o protocolo.");
      }
      const walletResponse = await fetch("/api/wallet", { cache: "no-store" });
      if (walletResponse.ok) setWallet((await walletResponse.json()) as WalletResponse);
      setBrlQuote(null);
      setPixWithdrawalKey("");
      setWithdrawMessage(
        `${payload.message ?? "Saque Pix solicitado."} Protocolo ${payload.withdrawal.id.slice(-8).toUpperCase()}.`,
      );
    } catch (reason) {
      setWithdrawError(
        reason instanceof Error ? reason.message : "Não foi possível solicitar o saque Pix.",
      );
    } finally {
      setBrlWithdrawalBusy(null);
    }
  }

  function selectDepositAsset(assetId: ConvertibleAsset) {
    setDepositAsset(assetId);
    setDepositMethod(assetId);
    setDepositError("");
    const minimumUsd = depositMinimums[assetId];
    if (minimumUsd) setDepositUsd(minimumUsd.toFixed(2));
  }

  async function refreshPixStatement() {
    setPixBusy("refresh");
    setPixError("");
    setPixMessage("");
    try {
      const response = await fetch("/api/wallet/pix", {
        body: JSON.stringify({ action: "refresh" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as PixResponse;
      if (!response.ok || !payload.overview) {
        throw new Error(payload.error ?? "Não foi possível atualizar o extrato Pix.");
      }
      setPix(payload.overview);
      if ((payload.reconciliation?.credited ?? 0) > 0) {
        await onRefreshAccount();
      }
      setPixMessage(payload.message ?? "Extrato Pix atualizado.");
    } catch (reason) {
      setPixError(
        reason instanceof Error ? reason.message : "Não foi possível atualizar o extrato Pix.",
      );
    } finally {
      setPixBusy(null);
    }
  }

  async function submitPix(action: "quote" | "create") {
    setPixBusy(action);
    setPixError("");
    setPixMessage("");
    if (action === "quote") setPixOrder(null);
    try {
      const response = await fetch("/api/wallet/pix", {
        body: JSON.stringify({ action, targetCma: pixTargetCma }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as PixResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "O servidor recusou o Pix.");
      }
      if (action === "quote" && payload.quote) {
        setPixQuote(payload.quote);
        setPixMessage("Prévia calculada com a PTAX oficial. Nenhum saldo foi alterado.");
      } else if (action === "create" && payload.pix) {
        setPixQuote(payload.pix);
        setPixOrder(payload.pix);
        setPixMessage(payload.message ?? "Cobrança Pix criada com segurança.");
        const overviewResponse = await fetch("/api/wallet/pix", { cache: "no-store" });
        if (overviewResponse.ok) {
          setPix((await overviewResponse.json()) as PixOverview);
        }
      } else {
        throw new Error("Resposta Pix incompleta.");
      }
    } catch (reason) {
      setPixError(reason instanceof Error ? reason.message : "Pix indisponível.");
    } finally {
      setPixBusy(null);
    }
  }

  return (
    <section className="conversion-center wallet-center">
      <header className="conversion-hero">
        <div>
          <span>{english ? "ARCADIA WALLET" : "CARTEIRA ARCADIA"}</span>
          <h2>{english ? "Balances, deposits and conversion" : "Saldos, depósitos e conversão"}</h2>
          <p>{english ? "Manage your coins and buy CMA in one place." : "Gerencie suas moedas e compre CMA em um só lugar."}</p>
        </div>
        <aside className="wallet-status-card">
          <b>{english ? "INTERNAL CONVERSION" : "CONVERSÃO INTERNA"}</b>
            <strong>{english ? "ACTIVE AND REGISTERED" : "ATIVA E REGISTRADA"}</strong>
            <small>{english ? "Balance protected by the server" : "Saldo protegido pelo servidor"}</small>
        </aside>
      </header>

      <div className="wallet-balance-overview" aria-label={english ? "Wallet balances" : "Saldos da carteira"}>
        <article>
          <img src={assetsManifest.cmaCoin.path} alt="" />
          <span><small>{english ? "INTERNAL BALANCE" : "SALDO INTERNO"}</small><strong>{formatCma(cmaBalance)} CMA</strong></span>
        </article>
        <article>
          <img src={assetsManifest.bitcoin.path} alt="" />
          <span><small>BITCOIN</small><strong>{formatCryptoAtomic(btcBalanceAtomic)} BTC</strong></span>
        </article>
        <article>
          <img src={assetsManifest.dogecoin.path} alt="" />
          <span><small>DOGECOIN</small><strong>{formatCryptoAtomic(dogeBalanceAtomic)} DOGE</strong></span>
        </article>
        <article>
          <img src={assetsManifest.litecoin.path} alt="" />
          <span><small>LITECOIN</small><strong>{formatCryptoAtomic(ltcBalanceAtomic)} LTC</strong></span>
        </article>
      </div>

      <div className="wallet-tabs" role="tablist" aria-label={english ? "Wallet actions" : "Ações da carteira"}>
        <button
          className={tab === "deposit" ? "active" : ""}
          role="tab"
          aria-selected={tab === "deposit"}
          type="button"
          onClick={() => setTab("deposit")}
        >
          1 · {english ? "DEPOSIT" : "DEPOSITAR"}
        </button>
        <button
          className={tab === "convert" ? "active" : ""}
          role="tab"
          aria-selected={tab === "convert"}
          type="button"
          onClick={() => setTab("convert")}
        >
          2 · {english ? "CONVERT TO CMA" : "CONVERTER PARA CMA"}
        </button>
        <button
          className={tab === "withdraw" ? "active" : ""}
          role="tab"
          aria-selected={tab === "withdraw"}
          type="button"
          onClick={() => setTab("withdraw")}
        >
          3 · {english ? "REQUEST WITHDRAWAL" : "SOLICITAR SAQUE"}
        </button>
      </div>

      {tab === "convert" ? (
        <>
          <div className="conversion-rate-strip" aria-live="polite">
            {(["BTC", "DOGE", "LTC"] as ConvertibleAsset[]).map((id) => {
              const rate = rates.find((item) => item.asset === id);
              const balance =
                id === "BTC"
                  ? btcBalanceAtomic
                  : id === "DOGE"
                    ? dogeBalanceAtomic
                    : ltcBalanceAtomic;
              return (
                <button
                  className={asset === id ? "active" : ""}
                  type="button"
                  key={id}
                  onClick={() => {
                    setAsset(id);
                    setQuote(null);
                    setSuccess("");
                  }}
                >
                  <img src={assetVisuals[id].asset} alt="" />
                  <span>
                    <small>{assetVisuals[id].name} · {english ? "balance" : "saldo"} {formatCryptoAtomic(balance)}</small>
                    <strong>{loading || !rate ? english ? "LOADING…" : "CONSULTANDO…" : formatUsd(rate.usdPrice)}</strong>
                  </span>
                  {rate?.stale && <em>{english ? "LAST QUOTE" : "ÚLTIMA COTAÇÃO"}</em>}
                </button>
              );
            })}
          </div>

          <div className="conversion-layout">
            <section className="conversion-form-card">
              <span>01 · {english ? "CHOOSE HOW MANY CMA TO BUY" : "ESCOLHA QUANTOS CMA COMPRAR"}</span>
              <div className="conversion-input-row conversion-cma-target">
                <img src={assetsManifest.cmaCoin.path} alt="" />
                <div>
                  <small>{english ? "WHOLE CMA UNITS" : "QUANTIDADE INTEIRA DE CMA"}</small>
                  <span className="conversion-unit-stepper">
                    <button type="button" aria-label="Diminuir um CMA" onClick={() => changeTargetCma(-1)}>−</button>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={targetCma}
                      onChange={(event) => {
                        setTargetCma(event.target.value.replace(/\D/g, "").slice(0, 7));
                        setQuote(null);
                        setSuccess("");
                      }}
                      aria-label="Quantidade inteira de CMA"
                    />
                    <button type="button" aria-label="Adicionar um CMA" onClick={() => changeTargetCma(1)}>+</button>
                  </span>
                </div>
                <b>CMA</b>
              </div>
              <div className="conversion-cost-preview" aria-live="polite">
                <img src={assetVisuals[asset].asset} alt="" />
                <span>
                  <small>{english ? "YOU WILL PAY APPROXIMATELY" : "VOCÊ PAGARÁ APROXIMADAMENTE"}</small>
                  <strong>
                    {estimatedAssetAtomic > 0
                      ? `${formatCryptoAtomic(estimatedAssetAtomic)} ${asset}`
                      : english ? `Waiting for amount and ${asset} quote` : `Aguardando quantidade e cotação de ${asset}`}
                  </strong>
                </span>
              </div>
              <button className="conversion-use-balance" type="button" onClick={useMaximumCma}>
                {english ? "BUY MAXIMUM WHOLE AMOUNT" : "COMPRAR O MÁXIMO INTEIRO"} · {maximumCmaUnits.toLocaleString(english ? "en-US" : "pt-BR")} CMA
              </button>

              <div className="conversion-rule-summary">
                <div>
                  <span>{english ? "CMA REFERENCE" : "REFERÊNCIA CMA"}</span>
                  <strong>US$ {policy?.cmaUsdReference.toFixed(2) ?? "1.00"}</strong>
                </div>
                <div>
                  <span>{english ? "ECONOMIC RESERVE" : "RESERVA ECONÔMICA"}</span>
                  <strong>{((policy?.feeBps ?? 300) / 100).toFixed(2)}%</strong>
                </div>
                <div>
                  <span>{english ? "MINIMUM" : "MÍNIMO"}</span>
                  <strong>{formatUsd(policy?.minimumUsd ?? 1)}</strong>
                </div>
              </div>

              <button
                className="conversion-quote-button"
                type="button"
                disabled={
                  loading ||
                  quoting ||
                  converting ||
                  !selectedRate ||
                  !Number.isSafeInteger(targetCmaUnits) ||
                  targetCmaUnits < 1 ||
                  targetCmaUnits > 1_000_000
                }
                onClick={() => void requestQuote()}
              >
                {quoting ? english ? "VALIDATING ON SERVER…" : "VALIDANDO NO SERVIDOR…" : english ? "GET 2-MINUTE QUOTE" : "GERAR COTAÇÃO DE 2 MINUTOS"}
              </button>
              {error && <p className="conversion-error" role="alert">{error}</p>}
              {success && <p className="conversion-success" role="status">{success}</p>}
            </section>

            <section className={`conversion-receipt ${quote ? "ready" : ""}`}>
              <span>02 · {english ? "CONFIRMATION" : "CONFIRMAÇÃO"}</span>
              {!quote ? (
                <div className="conversion-empty">
                  <b>CMA</b>
                  <strong>{english ? "Waiting for quote" : "Aguardando cotação"}</strong>
                  <p>{english ? "No balance changes before you confirm." : "Nenhum saldo muda antes da sua confirmação."}</p>
                </div>
              ) : (
                <>
                  <div className="conversion-receipt-main">
                    <small>{english ? "YOU WILL RECEIVE" : "VOCÊ RECEBERÁ"}</small>
                    <strong>{quote.targetCma.toLocaleString(english ? "en-US" : "pt-BR")} CMA</strong>
                    <span>{english ? "valid until" : "válida até"} {new Date(quote.expiresAt).toLocaleTimeString(english ? "en-US" : "pt-BR")}</span>
                  </div>
                  <dl>
                    <div><dt>Você paga</dt><dd>{formatCryptoAtomic(quote.assetAmountAtomic)} {quote.asset}</dd></div>
                    <div><dt>Valor de mercado</dt><dd>{formatUsd(quote.grossUsd)}</dd></div>
                    <div><dt>CMA comprado</dt><dd>{quote.targetCma.toLocaleString("pt-BR")} CMA</dd></div>
                    <div><dt>Reserva de {(quote.feeBps / 100).toFixed(2)}%</dt><dd>-{formatCma(quote.feeCma)} CMA</dd></div>
                    <div><dt>Cotação usada</dt><dd>1 {quote.asset} = {formatUsd(quote.rateUsd)}</dd></div>
                  </dl>
                  <button
                    type="button"
                    disabled={!quote.eligible || converting}
                    onClick={() => void executeQuote()}
                  >
                    {converting ? "CONFIRMANDO NO SERVIDOR…" : "CONFIRMAR CONVERSÃO"}
                  </button>
                  {!quote.eligible && (
                    <p className="conversion-error">A cotação está abaixo do mínimo econômico.</p>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      ) : tab === "deposit" ? (
        <section className="wallet-deposit-panel">
          {!wallet && error && (
            <p className="conversion-error" role="alert">{error}</p>
          )}
          <header>
            <span>{english ? "DEPOSIT METHODS" : "FORMAS DE DEPÓSITO"}</span>
            <h3>{english ? "Choose fiat or crypto" : "Escolha reais ou criptomoeda"}</h3>
            <p>{english ? "The amount, network and minimum are shown before confirmation." : "O valor, a rede e o mínimo aparecem antes da confirmação."}</p>
          </header>
          <div className="wallet-payment-methods">
            <button
              className={depositMethod === "PIX" ? "active" : ""}
              aria-pressed={depositMethod === "PIX"}
              type="button"
              onClick={() => setDepositMethod("PIX")}
            >
              <b className="wallet-brl-symbol">R$</b>
              <span><strong>Pix</strong><small>{english ? "Payment in Brazilian reais" : "Pagamento em reais"}</small></span>
            </button>
            {(["LTC", "DOGE", "BTC"] as ConvertibleAsset[]).map((id) => (
              <button
                className={depositMethod === id ? "active" : ""}
                aria-pressed={depositMethod === id}
                type="button"
                key={id}
                onClick={() => {
                  selectDepositAsset(id);
                }}
              >
                <img src={assetVisuals[id].asset} alt="" />
                <span><strong>{id}</strong><small>{assetVisuals[id].name}</small></span>
              </button>
            ))}
          </div>
          {depositMethod === "PIX" ? (
          <section id="wallet-pix" className={`wallet-pix-panel ${pix?.enabled ? "ready" : "pending"}`}>
            <header>
              <div>
                <span>PIX · MERCADO PAGO</span>
                <h4>Compre CMA inteiro em reais</h4>
                <p>
                  {english ? "Choose a whole CMA amount and review the final value." : "Escolha uma quantidade inteira de CMA e confira o valor final."}
                </p>
              </div>
              <strong>
                {pix?.enabled
                  ? pix.mode === "test"
                    ? "ACESSO RESTRITO"
                    : "PRODUÇÃO ATIVA"
                  : "INDISPONÍVEL"}
              </strong>
            </header>
            <div className="wallet-pix-controls">
              <label>
                QUANTIDADE INTEIRA DE CMA
                <span className="wallet-pix-stepper">
                  <button
                    aria-label="Diminuir um CMA no Pix"
                    type="button"
                    onClick={() => {
                      const current = /^\d+$/.test(pixTargetCma) ? Number(pixTargetCma) : 1;
                      setPixTargetCma(String(Math.max(1, current - 1)));
                      setPixQuote(null);
                    }}
                  >−</button>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pixTargetCma}
                    onChange={(event) => {
                      setPixTargetCma(event.target.value.replace(/\D/g, "").slice(0, 4));
                      setPixQuote(null);
                      setPixOrder(null);
                    }}
                  />
                  <button
                    aria-label="Adicionar um CMA no Pix"
                    type="button"
                    onClick={() => {
                      const current = /^\d+$/.test(pixTargetCma) ? Number(pixTargetCma) : 0;
                      setPixTargetCma(String(Math.min(1_000, Math.max(1, current + 1))));
                      setPixQuote(null);
                    }}
                  >+</button>
                </span>
              </label>
              <div className="wallet-pix-quote" aria-live="polite">
                <small>VALOR PIX</small>
                <strong>{pixQuote ? formatBrl(pixQuote.brlAmount) : "GERAR PRÉVIA"}</strong>
                <span>
                  {pixQuote
                    ? `${pixQuote.targetCma} CMA · USD/BRL ${pixQuote.usdBrl.toFixed(4)} · margem ${(pixQuote.marginBps / 100).toFixed(2)}%`
                    : "Cotação oficial + margem operacional visível"}
                </span>
              </div>
              <div className="wallet-pix-actions">
                <button
                  disabled={pixBusy !== null || !/^\d+$/.test(pixTargetCma)}
                  type="button"
                  onClick={() => void submitPix("quote")}
                >
                  {pixBusy === "quote" ? "CALCULANDO…" : "VER VALOR EM REAIS"}
                </button>
                <button
                  className="primary"
                  disabled={!pix?.enabled || !pixQuote || pixBusy !== null}
                  type="button"
                  onClick={() => void submitPix("create")}
                >
                  {pixBusy === "create" ? "CRIANDO PIX…" : "CRIAR PIX"}
                </button>
              </div>
            </div>
            {!pix?.enabled && (
              <p className="wallet-pix-setup">
                A estrutura está pronta, mas pagamentos reais continuam bloqueados.
                A configuração de pagamento e o webhook ainda não estão disponíveis.
              </p>
            )}
            {pixError && <p className="conversion-error" role="alert">{pixError}</p>}
            {pixMessage && <p className="conversion-success" role="status">{pixMessage}</p>}
            {pixOrder && (
              <div className="wallet-pix-ticket">
                <label>
                  PIX COPIA E COLA
                  <textarea readOnly rows={3} value={pixOrder.qrCode} />
                </label>
                <a href={pixOrder.ticketUrl} rel="noreferrer" target="_blank">
                  ABRIR QR CODE SEGURO
                </a>
              </div>
            )}
            <section className="wallet-pix-history" aria-labelledby="wallet-pix-history-title">
              <header>
                <div>
                  <span>EXTRATO PIX</span>
                  <h5 id="wallet-pix-history-title">Acompanhe cada pagamento</h5>
                </div>
                <button
                  type="button"
                  disabled={pixBusy !== null}
                  onClick={() => void refreshPixStatement()}
                >
                  {pixBusy === "refresh" ? "CONSULTANDO…" : "ATUALIZAR EXTRATO"}
                </button>
              </header>
              {!pix?.recent?.length ? (
                <p className="wallet-pix-history-empty">Nenhuma cobrança Pix criada nesta conta.</p>
              ) : (
                <div className="wallet-pix-history-list">
                  {pix.recent.map((entry) => {
                    const state = pixStatus(entry.status);
                    return (
                      <article className={`status-${state.tone}`} key={entry.id}>
                        <div>
                          <time dateTime={new Date(entry.createdAt).toISOString()}>
                            {new Date(entry.createdAt).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </time>
                          <strong>{entry.cmaUnits} CMA</strong>
                          <small>{formatBrl(entry.brlAmount)} · #{entry.id.slice(-8).toUpperCase()}</small>
                        </div>
                        <span className={`wallet-pix-status ${state.tone}`}>{state.label}</span>
                        {entry.ticketUrl && state.tone === "waiting" && (
                          <a href={entry.ticketUrl} rel="noreferrer" target="_blank">ABRIR COBRANÇA</a>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
          ) : (
          <div id="wallet-crypto" className={`wallet-provider-gate ${wallet?.deposits?.enabled ? "ready" : "pending"}`}>
            <div>
              <small>PROVEDOR DE ENTRADA</small>
              <strong>NOWPayments · somente depósitos</strong>
              <span>{wallet?.deposits?.enabled ? "Faturas disponíveis" : "Temporariamente indisponível"}</span>
            </div>
            <label>
              MOEDA E VALOR DA FATURA
              <select
                value={depositAsset}
                onChange={(event) =>
                  selectDepositAsset(event.target.value as ConvertibleAsset)
                }
              >
                <option value="DOGE">Dogecoin · DOGE</option>
                <option value="LTC">Litecoin · LTC</option>
                <option value="BTC">Bitcoin · BTC</option>
              </select>
              <input
                inputMode="decimal"
                min={depositMinimums[depositAsset]}
                step="0.01"
                value={depositUsd}
                onChange={(event) => setDepositUsd(event.target.value)}
              />
              <small>
                {depositMinimumBusy
                  ? "Consultando o mínimo atual do provedor…"
                  : depositMinimums[depositAsset]
                    ? `Mínimo dinâmico do provedor ${formatUsd(depositMinimums[depositAsset]!)} · máximo local US$ 1.000`
                    : "O valor mínimo precisa ser confirmado antes da fatura."}
              </small>
              <strong className="wallet-deposit-estimate">O VALOR NA MOEDA ESCOLHIDA APARECE NA FATURA</strong>
              <button
                className="wallet-deposit-submit"
                disabled={
                  !wallet?.deposits?.enabled ||
                  depositMinimumBusy ||
                  !depositMinimums[depositAsset] ||
                  depositBusy !== null
                }
                type="button"
                onClick={() => void createDeposit(depositAsset)}
              >
                {depositBusy === depositAsset ? "CRIANDO FATURA…" : "CRIAR FATURA SEGURA"}
              </button>
            </label>
          </div>
          )}
          {depositMinimumError && (
            <p className="conversion-error" role="alert">{depositMinimumError}</p>
          )}
          {depositError && <p className="conversion-error" role="alert">{depositError}</p>}
          {wallet?.deposits?.sandboxEnabled && (
            <section className="wallet-sandbox-lab" aria-labelledby="wallet-sandbox-title">
              <header>
                <div>
                  <span>SIMULAÇÃO FINANCEIRA</span>
                  <h4 id="wallet-sandbox-title">Simule o fluxo sem movimentar dinheiro</h4>
                </div>
                <strong>SIMULAÇÃO · ZERO CRÉDITO</strong>
              </header>
              <p>
                Esta área testa telas, limites e protocolos. Ela não gera endereço
                real, não recebe criptomoeda e não altera nenhum saldo.
              </p>
              <div className="wallet-sandbox-controls">
                <label>
                  SALDO SIMULADO
                  <select
                    value={sandboxAsset}
                    onChange={(event) =>
                      setSandboxAsset(event.target.value as ConvertibleAsset)
                    }
                  >
                    <option value="BTC">Bitcoin · BTC</option>
                    <option value="DOGE">Dogecoin · DOGE</option>
                    <option value="LTC">Litecoin · LTC</option>
                  </select>
                </label>
                <label>
                  FATURA SIMULADA EM USD
                  <input
                    inputMode="decimal"
                    value={sandboxUsd}
                    onChange={(event) => setSandboxUsd(event.target.value)}
                  />
                  <button
                    disabled={sandboxBusy !== null}
                    type="button"
                    onClick={() => void runSandbox("deposit")}
                  >
                    {sandboxBusy === "deposit" ? "CRIANDO…" : "SIMULAR DEPÓSITO"}
                  </button>
                </label>
              </div>
              {sandboxError && (
                <p className="conversion-error" role="alert">{sandboxError}</p>
              )}
              {sandboxMessage && (
                <p className="conversion-success" role="status">{sandboxMessage}</p>
              )}
              <div className="wallet-sandbox-history">
                <article>
                  <span>FATURAS SIMULADAS</span>
                  <strong>{wallet.deposits.recent.filter((item) => item.status === "simulation_only").length}</strong>
                </article>
                <article>
                  <span>SAQUES SIMULADOS</span>
                  <strong>{wallet.withdrawals?.recentSandbox.length ?? 0}</strong>
                </article>
                <article>
                  <span>DINHEIRO MOVIMENTADO</span>
                  <strong>US$ 0,00</strong>
                </article>
              </div>
            </section>
          )}
          {wallet?.deposits?.recent.some((item) => item.provider === "nowpayments") && (
            <div className="wallet-live-history">
              <div className="wallet-live-history-header">
                <span>{english ? "RECENT INVOICES · LAST 30 DAYS" : "FATURAS RECENTES · ÚLTIMOS 30 DIAS"}</span>
                <button
                  className="wallet-history-refresh"
                  disabled={walletRefreshing}
                  onClick={() => void refreshWallet()}
                  type="button"
                >
                  {walletRefreshing
                    ? english ? "UPDATING…" : "ATUALIZANDO…"
                    : english ? "REFRESH STATUS" : "ATUALIZAR STATUS"}
                </button>
              </div>
              {wallet.deposits.recent
                .filter((item) => item.provider === "nowpayments")
                .slice(0, 4)
                .map((item) => (
                  <article key={item.id}>
                    <b>{item.asset}</b>
                    <span>{formatUsd(item.requestedUsd)}</span>
                    <em className={nowPaymentsStatus(item.status, english).tone}>
                      {nowPaymentsStatus(item.status, english).label}
                    </em>
                    {item.status === "credited" && (
                      <strong>+{formatCryptoAtomic(item.receivedAtomic)} {item.asset}</strong>
                    )}
                    {item.checkoutUrl && isPendingNowPaymentsStatus(item.status) && (
                      <a href={item.checkoutUrl} rel="noreferrer" target="_blank">
                        {english ? "OPEN INVOICE" : "ABRIR FATURA"}
                      </a>
                    )}
                  </article>
                ))}
            </div>
          )}
          <p className="wallet-provider-notice">
            <strong>{wallet?.deposits?.mode === "sandbox" ? "SIMULAÇÃO ATIVA: NÃO ENVIE DINHEIRO REAL." : wallet?.deposits?.enabled ? "DEPÓSITOS CONTROLADOS PELO SERVIDOR." : "DEPÓSITO INDISPONÍVEL."}</strong>{" "}
            Nunca envie criptomoeda para um endereço ou fatura que não tenha sido gerado
            dentro desta tela após a ativação oficial.
          </p>
          <details className="wallet-faq">
            <summary>Dúvidas sobre depósitos e conversão</summary>
            <div>
              <h4>Por que o mínimo muda?</h4>
              <p>O provedor recalcula o piso de cada rede. A fatura usa uma pequena margem sobre o mínimo dinâmico para não ser recusada durante uma variação de cotação.</p>
              <h4>Como as faturas funcionam?</h4>
              <p>Depósitos reais usam fatura externa. Deposite LTC, DOGE ou BTC no seu saldo interno somente por uma fatura criada nesta tela.</p>
              <h4>O depósito vira CMA automaticamente?</h4>
              <p>Não. BTC, DOGE e LTC entram no saldo da moeda escolhida; nenhum CMA é criado automaticamente. A conversão para CMA é manual.</p>
              <h4>Como funciona o saque?</h4>
              <p>A solicitação reserva o saldo e segue para conferência e pagamento manual do fundador. O recebimento pode ser na própria cripto ou, após uma cotação, por Pix em real.</p>
              <h4>Posso sacar CMA?</h4>
              <p>CMA é crédito de uso dentro do jogo. O saque usa saldo BTC, DOGE ou LTC como origem.</p>
            </div>
          </details>
        </section>
      ) : (
        <section className="wallet-deposit-panel wallet-withdraw-panel">
          <header>
            <span>{english ? "WITHDRAWAL · MANUAL PROCESSING" : "SAQUE · PROCESSAMENTO MANUAL"}</span>
            <h3>{english ? "Choose how you want to receive" : "Escolha como deseja receber"}</h3>
            <p>
              Receba BTC, DOGE ou LTC na rede, ou converta o saldo escolhido para um
              pagamento Pix cotado em real. O valor fica reservado até a análise.
            </p>
          </header>
          <div className="wallet-withdraw-summary">
            <article><small>DISPONÍVEL EM BTC</small><strong>{formatCryptoAtomic(btcBalanceAtomic)} BTC</strong></article>
            <article><small>DISPONÍVEL EM DOGE</small><strong>{formatCryptoAtomic(dogeBalanceAtomic)} DOGE</strong></article>
            <article><small>DISPONÍVEL EM LTC</small><strong>{formatCryptoAtomic(ltcBalanceAtomic)} LTC</strong></article>
            <article><small>FILA MANUAL</small><strong>{wallet?.withdrawals?.enabled ? "ATIVA" : "PAUSADA"}</strong></article>
          </div>
          <nav className="wallet-withdraw-methods" aria-label="Forma de recebimento">
            <button
              className={withdrawMethod === "crypto" ? "active" : ""}
              onClick={() => {
                setWithdrawMethod("crypto");
                setWithdrawError("");
                setWithdrawMessage("");
              }}
              type="button"
            >
              <span>◈</span><strong>{english ? "RECEIVE IN CRYPTO" : "RECEBER EM CRIPTO"}</strong><small>{english ? "Variable minimum ≈ R$ 50" : "Mínimo variável ≈ R$ 50"}</small>
            </button>
            <button
              className={withdrawMethod === "pix" ? "active" : ""}
              onClick={() => {
                setWithdrawMethod("pix");
                setWithdrawError("");
                setWithdrawMessage("");
              }}
              type="button"
            >
              <span>R$</span><strong>{english ? "CONVERT AND RECEIVE VIA PIX" : "CONVERTER E RECEBER VIA PIX"}</strong><small>{english ? "Minimum R$ 20" : "Mínimo R$ 20"}</small>
            </button>
          </nav>

          {withdrawMethod === "crypto" ? (
            <div className="wallet-withdraw-request">
              <label>
                MOEDA
                <select
                  value={withdrawAsset}
                  onChange={(event) => {
                    setWithdrawAsset(event.target.value as WithdrawableAsset);
                    setWithdrawError("");
                  }}
                >
                  <option value="DOGE">Dogecoin · DOGE</option>
                  <option value="LTC">Litecoin · LTC</option>
                  <option value="BTC">Bitcoin · BTC</option>
                </select>
              </label>
              <label>
                QUANTIDADE EM {withdrawAsset}
                <input
                  inputMode="decimal"
                  placeholder={
                    wallet?.withdrawals?.ratesAvailable
                      ? `Mínimo atual ${formatCryptoAtomic(wallet.withdrawals.minimumAtomic[withdrawAsset])}`
                      : "Cotação indisponível"
                  }
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                />
              </label>
              <label className="wallet-withdraw-address">
                ENDEREÇO NA REDE {withdrawAsset}
                <input
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    withdrawAsset === "BTC"
                      ? "bc1… ou endereço Bitcoin válido"
                      : withdrawAsset === "LTC"
                        ? "ltc1…, L… ou M… endereço Litecoin válido"
                        : "D… endereço Dogecoin válido"
                  }
                  value={withdrawAddress}
                  onChange={(event) => setWithdrawAddress(event.target.value.trim())}
                />
              </label>
              <button
                className="wallet-deposit-submit"
                disabled={
                  !wallet?.withdrawals?.enabled ||
                  !wallet?.withdrawals?.ratesAvailable ||
                  withdrawBusy ||
                  withdrawAmount.trim().length === 0 ||
                  withdrawAddress.length < 20
                }
                type="button"
                onClick={() => void createWithdrawal()}
              >
                {withdrawBusy ? "RESERVANDO NO SERVIDOR…" : "SOLICITAR SAQUE EM CRIPTO"}
              </button>
            </div>
          ) : (
            <div className="wallet-brl-withdrawal">
              <div className="wallet-withdraw-request">
                <label>
                  USAR SALDO DE
                  <select
                    value={withdrawAsset}
                    onChange={(event) => {
                      setWithdrawAsset(event.target.value as WithdrawableAsset);
                      setBrlQuote(null);
                    }}
                  >
                    <option value="DOGE">Dogecoin · DOGE</option>
                    <option value="LTC">Litecoin · LTC</option>
                    <option value="BTC">Bitcoin · BTC</option>
                  </select>
                </label>
                <label>
                  VALOR A RECEBER
                  <span className="wallet-brl-input"><b>R$</b><input
                    inputMode="decimal"
                    min="20"
                    value={brlTarget}
                    onChange={(event) => {
                      setBrlTarget(event.target.value);
                      setBrlQuote(null);
                    }}
                  /></span>
                </label>
                <label>
                  TIPO DE CHAVE PIX
                  <select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as PixKeyType)}>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="cpf_cnpj">CPF ou CNPJ</option>
                    <option value="random">Chave aleatória</option>
                  </select>
                </label>
                <label className="wallet-withdraw-address">
                  CHAVE PIX
                  <input
                    autoComplete="off"
                    placeholder="Informe a chave do titular"
                    value={pixWithdrawalKey}
                    onChange={(event) => setPixWithdrawalKey(event.target.value)}
                  />
                </label>
              </div>
              {brlQuote ? (
                <div className="wallet-brl-quote" aria-live="polite">
                  <div><small>VOCÊ RECEBE</small><strong>{formatBrl(brlQuote.netBrl)}</strong></div>
                  <div><small>RESERVA EM {brlQuote.asset}</small><strong>{brlQuote.sourceAmount.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} {brlQuote.asset}</strong></div>
                  <div><small>MARGEM OPERACIONAL</small><strong>{formatBrl(brlQuote.feeBrl)} · {(brlQuote.feeBps / 100).toLocaleString("pt-BR")}%</strong></div>
                  <button
                    disabled={brlWithdrawalBusy !== null || pixWithdrawalKey.trim().length < 5}
                    onClick={() => void createBrlWithdrawal()}
                    type="button"
                  >
                    {brlWithdrawalBusy === "create" ? "RESERVANDO…" : "CONFIRMAR E ENVIAR PARA ANÁLISE"}
                  </button>
                </div>
              ) : (
                <button
                  className="wallet-deposit-submit"
                  disabled={!wallet?.withdrawals?.enabled || brlWithdrawalBusy !== null}
                  onClick={() => void quoteBrlWithdrawal()}
                  type="button"
                >
                  {brlWithdrawalBusy === "quote" ? "CONSULTANDO COTAÇÃO…" : "VER COTAÇÃO DO SAQUE PIX"}
                </button>
              )}
            </div>
          )}
          {withdrawError && <p className="conversion-error" role="alert">{withdrawError}</p>}
          {withdrawMessage && <p className="conversion-success" role="status">{withdrawMessage}</p>}
          <p className="wallet-provider-notice">
            <strong>
              {withdrawMethod === "pix"
                ? "CONFIRA A CHAVE PIX E O VALOR COTADO."
                : "CONFIRA MOEDA, REDE E ENDEREÇO ANTES DE ENVIAR."}
            </strong>{" "}
            O saldo de origem fica reservado até a análise. Se o pedido for recusado,
            a mesma quantidade de {withdrawAsset} volta automaticamente para a carteira.
          </p>
          {wallet?.withdrawals?.recent && wallet.withdrawals.recent.length > 0 && (
            <div className="wallet-live-history wallet-withdraw-history">
              <span>PEDIDOS RECENTES</span>
              {wallet.withdrawals.recent.map((item) => (
                <article key={item.id}>
                  <b>{item.payoutAsset === "BRL" ? "PIX" : item.asset}</b>
                  <span>
                    {item.payoutAsset === "BRL"
                      ? formatBrl(item.payoutBrlCents / 100)
                      : `${formatCryptoAtomic(item.amountAtomic)} ${item.asset}`}
                  </span>
                  <em>{withdrawalStatusLabel(item.status)}</em>
                  <strong>{item.destinationPreview}</strong>
                  {item.payoutAsset === "BRL" && (
                    <small>ORIGEM {formatCryptoAtomic(item.amountAtomic)} {item.asset}</small>
                  )}
                  {item.transactionReference && <small>REF. {item.transactionReference}</small>}
                  {item.reviewNote && <small>{item.reviewNote}</small>}
                </article>
              ))}
            </div>
          )}
          {wallet?.withdrawals?.sandboxEnabled && (
            <section className="wallet-sandbox-lab">
              <header><div><span>SIMULAÇÃO</span><h4>Simular pedido de saque</h4></div><strong>ZERO MOVIMENTAÇÃO</strong></header>
              <div className="wallet-sandbox-controls">
                <label>
                  MOEDA
                  <select value={sandboxAsset} onChange={(event) => setSandboxAsset(event.target.value as ConvertibleAsset)}>
                    <option value="BTC">Bitcoin · BTC</option>
                    <option value="DOGE">Dogecoin · DOGE</option>
                    <option value="LTC">Litecoin · LTC</option>
                  </select>
                </label>
                <label>
                  QUANTIDADE EM {sandboxAsset}
                  <input inputMode="decimal" value={sandboxAmount} onChange={(event) => setSandboxAmount(event.target.value)} />
                  <button disabled={sandboxBusy !== null} type="button" onClick={() => void runSandbox("withdrawal")}>
                    {sandboxBusy === "withdrawal" ? "VALIDANDO…" : "SIMULAR PEDIDO"}
                  </button>
                </label>
              </div>
              {sandboxError && <p className="conversion-error" role="alert">{sandboxError}</p>}
              {sandboxMessage && <p className="conversion-success" role="status">{sandboxMessage}</p>}
            </section>
          )}
        </section>
      )}

      <details className="wallet-faq wallet-global-faq">
        <summary>Como o saldo e as cotações funcionam?</summary>
        <div>
          <h4>Conversão</h4>
          <p>BTC, DOGE ou LTC podem virar CMA. CMA permanece como crédito de uso dentro do jogo.</p>
          <h4>Registro individual</h4>
          <p>Cada conta tem saldos e histórico separados no servidor.</p>
          <h4>Cotação de mercado</h4>
          <p>O servidor consulta fontes redundantes e aplica a regra econômica antes de confirmar.</p>
        </div>
      </details>
    </section>
  );
}
