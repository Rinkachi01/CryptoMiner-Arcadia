"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import type { ConversionAssetId } from "./conversion-rules";

type ConvertibleAsset = "BTC" | "DOGE";
type WalletTab = "convert" | "deposit" | "withdraw";

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
    assets: ["BTC", "DOGE"];
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
    enabled: false;
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

type ConversionViewProps = {
  btcBalanceAtomic: number;
  cmaBalance: number;
  dogeBalanceAtomic: number;
  onRefreshAccount: () => Promise<boolean>;
  serverVersion: number;
};

const assetVisuals: Record<ConvertibleAsset, { asset: string; name: string }> = {
  BTC: { asset: assetsManifest.bitcoin.path, name: "Bitcoin" },
  DOGE: { asset: assetsManifest.dogecoin.path, name: "Dogecoin" },
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "USD",
    maximumFractionDigits: value < 1 ? 6 : 2,
    minimumFractionDigits: value < 1 ? 2 : 2,
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
  return (value / 100_000_000).toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function ConversionView({
  btcBalanceAtomic,
  cmaBalance,
  dogeBalanceAtomic,
  onRefreshAccount,
  serverVersion,
}: ConversionViewProps) {
  const [tab, setTab] = useState<WalletTab>("deposit");
  const [asset, setAsset] = useState<ConvertibleAsset>("BTC");
  const [targetCma, setTargetCma] = useState("1");
  const [rates, setRates] = useState<MarketRate[]>([]);
  const [policy, setPolicy] = useState<ConversionResponse["policy"]>();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [depositAsset, setDepositAsset] = useState<ConvertibleAsset>("DOGE");
  const [depositUsd, setDepositUsd] = useState("5");
  const [depositMinimums, setDepositMinimums] = useState<
    Partial<Record<ConvertibleAsset, number>>
  >({});
  const [depositMinimumError, setDepositMinimumError] = useState("");
  const [depositBusy, setDepositBusy] = useState<ConvertibleAsset | null>(null);
  const [depositError, setDepositError] = useState("");

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
    if (!wallet?.deposits?.enabled) return;
    let active = true;
    const controller = new AbortController();
    Promise.all(
      (["BTC", "DOGE"] as ConvertibleAsset[]).map(async (assetId) => {
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
        setDepositUsd(values.DOGE.toFixed(2));
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
    asset === "BTC" ? btcBalanceAtomic : dogeBalanceAtomic;
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

  function selectDepositAsset(assetId: ConvertibleAsset) {
    setDepositAsset(assetId);
    setDepositError("");
    const minimumUsd = depositMinimums[assetId];
    if (minimumUsd) setDepositUsd(minimumUsd.toFixed(2));
  }

  return (
    <section className="conversion-center wallet-center">
      <header className="conversion-hero">
        <div>
          <span>CARTEIRA INDIVIDUAL · LIVRO-RAZÃO DO SERVIDOR</span>
          <h2>Seus saldos e sua conversão para CMA</h2>
          <p>
            BTC e DOGE pertencem ao registro individual desta conta. A conversão é
            confirmada pelo servidor, usa uma cotação de dois minutos e só acontece
            uma vez.
          </p>
        </div>
        <aside className="wallet-status-card">
          <b>CONVERSÃO INTERNA</b>
          <strong>ATIVA E REGISTRADA</strong>
          <small>Depósitos reais usam fatura externa e confirmação assinada.</small>
        </aside>
      </header>

      <div className="wallet-balance-overview" aria-label="Saldos da carteira">
        <article>
          <img src={assetsManifest.cmaCoin.path} alt="" />
          <span><small>SALDO INTERNO</small><strong>{formatCma(cmaBalance)} CMA</strong></span>
          <em>NÃO SACÁVEL</em>
        </article>
        <article>
          <img src={assetsManifest.bitcoin.path} alt="" />
          <span><small>BITCOIN</small><strong>{formatCryptoAtomic(btcBalanceAtomic)} BTC</strong></span>
          <em>CONVERSÍVEL</em>
        </article>
        <article>
          <img src={assetsManifest.dogecoin.path} alt="" />
          <span><small>DOGECOIN</small><strong>{formatCryptoAtomic(dogeBalanceAtomic)} DOGE</strong></span>
          <em>CONVERSÍVEL</em>
        </article>
      </div>

      <div className="wallet-tabs" role="tablist" aria-label="Ações da carteira">
        <button
          className={tab === "deposit" ? "active" : ""}
          role="tab"
          aria-selected={tab === "deposit"}
          type="button"
          onClick={() => setTab("deposit")}
        >
          1 · DEPOSITAR BTC/DOGE
        </button>
        <button
          className={tab === "convert" ? "active" : ""}
          role="tab"
          aria-selected={tab === "convert"}
          type="button"
          onClick={() => setTab("convert")}
        >
          2 · CONVERTER PARA CMA
        </button>
        <button
          className={tab === "withdraw" ? "active" : ""}
          role="tab"
          aria-selected={tab === "withdraw"}
          type="button"
          onClick={() => setTab("withdraw")}
        >
          3 · SOLICITAR SAQUE
        </button>
      </div>

      {tab === "convert" ? (
        <>
          <div className="conversion-rate-strip" aria-live="polite">
            {(["BTC", "DOGE"] as ConvertibleAsset[]).map((id) => {
              const rate = rates.find((item) => item.asset === id);
              const balance = id === "BTC" ? btcBalanceAtomic : dogeBalanceAtomic;
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
                    <small>{assetVisuals[id].name} · saldo {formatCryptoAtomic(balance)}</small>
                    <strong>{loading || !rate ? "CONSULTANDO…" : formatUsd(rate.usdPrice)}</strong>
                  </span>
                  {rate?.stale && <em>ÚLTIMA COTAÇÃO</em>}
                </button>
              );
            })}
          </div>

          <div className="conversion-layout">
            <section className="conversion-form-card">
              <span>01 · ESCOLHA QUANTOS CMA COMPRAR</span>
              <div className="conversion-input-row conversion-cma-target">
                <img src={assetsManifest.cmaCoin.path} alt="" />
                <div>
                  <small>QUANTIDADE INTEIRA DE CMA</small>
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
                  <small>VOCÊ PAGARÁ APROXIMADAMENTE</small>
                  <strong>
                    {estimatedAssetAtomic > 0
                      ? `${formatCryptoAtomic(estimatedAssetAtomic)} ${asset}`
                      : `Aguardando quantidade e cotação de ${asset}`}
                  </strong>
                </span>
              </div>
              <button className="conversion-use-balance" type="button" onClick={useMaximumCma}>
                COMPRAR O MÁXIMO INTEIRO · {maximumCmaUnits.toLocaleString("pt-BR")} CMA
              </button>

              <div className="conversion-rule-summary">
                <div>
                  <span>REFERÊNCIA CMA</span>
                  <strong>US$ {policy?.cmaUsdReference.toFixed(2) ?? "1.00"}</strong>
                </div>
                <div>
                  <span>RESERVA ECONÔMICA</span>
                  <strong>{((policy?.feeBps ?? 300) / 100).toFixed(2)}%</strong>
                </div>
                <div>
                  <span>MÍNIMO</span>
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
                {quoting ? "VALIDANDO NO SERVIDOR…" : "GERAR COTAÇÃO DE 2 MINUTOS"}
              </button>
              {error && <p className="conversion-error" role="alert">{error}</p>}
              {success && <p className="conversion-success" role="status">{success}</p>}
            </section>

            <section className={`conversion-receipt ${quote ? "ready" : ""}`}>
              <span>02 · CONFIRMAÇÃO</span>
              {!quote ? (
                <div className="conversion-empty">
                  <b>CMA</b>
                  <strong>Aguardando cotação</strong>
                  <p>Nenhum saldo muda antes da sua confirmação.</p>
                </div>
              ) : (
                <>
                  <div className="conversion-receipt-main">
                    <small>VOCÊ RECEBERÁ</small>
                    <strong>{quote.targetCma.toLocaleString("pt-BR")} CMA</strong>
                    <span>válida até {new Date(quote.expiresAt).toLocaleTimeString("pt-BR")}</span>
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
            <span>
              {wallet?.deposits?.mode === "sandbox"
                ? "SANDBOX DO PROVEDOR · SEM DINHEIRO REAL"
                : "DEPÓSITOS VIA NOWPAYMENTS"}
            </span>
            <h3>Deposite BTC ou DOGE no seu saldo interno</h3>
            <p>
              O Arcadia não guarda chaves privadas. O provedor cria uma fatura única e
              envia uma confirmação assinada. O servidor credita exatamente a moeda
              recebida; converter esse saldo para CMA é uma decisão separada do jogador.
            </p>
          </header>
          <div className={`wallet-provider-gate ${wallet?.deposits?.enabled ? "ready" : "pending"}`}>
            <div>
              <small>PROVEDOR DE ENTRADA</small>
              <strong>NOWPayments · somente depósitos</strong>
              <span>
                {wallet?.deposits?.enabled
                  ? wallet.deposits.mode === "sandbox"
                    ? "Conectado ao ambiente de testes. Não envie criptomoeda real."
                    : "Conta comercial conectada. Faturas de produção disponíveis."
                  : wallet?.deposits?.ownerOnly && !wallet.deposits.accessAllowed
                    ? "Faturas reais estão em homologação exclusiva da conta fundadora."
                    : wallet?.deposits?.missingSetup?.includes("api_key")
                    ? "Falta uma chave de API válida no segredo NOWPAYMENTS_API_KEY."
                    : wallet?.deposits?.missingSetup?.includes("ipn_secret")
                      ? "Falta um segredo IPN com pelo menos 16 caracteres."
                      : wallet?.deposits?.missingSetup?.includes("public_url")
                        ? "Falta configurar a URL pública HTTPS do Arcadia."
                        : `O provedor está configurado, mas a ativação permanece bloqueada (pedido: ${wallet?.deposits?.activationRequested ? "sim" : "não"}; sandbox: ${wallet?.deposits?.providerSandbox ? "sim" : "não"}; produção: ${wallet?.deposits?.liveActivationRequested ? "sim" : "não"}).`}
              </span>
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
                    ? `Mínimo atual ${formatUsd(depositMinimums[depositAsset]!)} · máximo local US$ 1.000`
                    : "O valor mínimo precisa ser confirmado antes da fatura."}
              </small>
              <strong className="wallet-deposit-estimate">O VALOR EM BTC OU DOGE APARECE NA FATURA</strong>
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
          {depositMinimumError && (
            <p className="conversion-error" role="alert">{depositMinimumError}</p>
          )}
          {depositError && <p className="conversion-error" role="alert">{depositError}</p>}
          {wallet?.deposits?.sandboxEnabled && (
            <section className="wallet-sandbox-lab" aria-labelledby="wallet-sandbox-title">
              <header>
                <div>
                  <span>LABORATÓRIO FINANCEIRO</span>
                  <h4 id="wallet-sandbox-title">Teste o fluxo sem movimentar dinheiro</h4>
                </div>
                <strong>SIMULAÇÃO · ZERO CRÉDITO</strong>
              </header>
              <p>
                Esta área testa telas, limites e protocolos. Ela não gera endereço
                real, não recebe criptomoeda e não altera nenhum saldo.
              </p>
              <div className="wallet-sandbox-controls">
                <label>
                  MOEDA DE TESTE
                  <select
                    value={sandboxAsset}
                    onChange={(event) =>
                      setSandboxAsset(event.target.value as ConvertibleAsset)
                    }
                  >
                    <option value="BTC">Bitcoin · BTC</option>
                    <option value="DOGE">Dogecoin · DOGE</option>
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
                  <span>FATURAS DE TESTE</span>
                  <strong>{wallet.deposits.recent.filter((item) => item.status === "simulation_only").length}</strong>
                </article>
                <article>
                  <span>SAQUES DE TESTE</span>
                  <strong>{wallet.withdrawals?.recentSandbox.length ?? 0}</strong>
                </article>
                <article>
                  <span>DINHEIRO MOVIMENTADO</span>
                  <strong>US$ 0,00</strong>
                </article>
              </div>
            </section>
          )}
          <div className="wallet-deposit-assets">
            {(["BTC", "DOGE"] as ConvertibleAsset[]).map((id) => (
              <article className={depositAsset === id ? "selected" : ""} key={id}>
                <img src={assetVisuals[id].asset} alt="" />
                <div>
                  <small>REDE SUPORTADA</small>
                  <strong>{assetVisuals[id].name}</strong>
                  <span>
                    {id === "BTC" ? "Rede Bitcoin" : "Rede Dogecoin"}
                    {depositMinimums[id]
                      ? ` · mínimo ${formatUsd(depositMinimums[id]!)}`
                      : " · mínimo em consulta"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!wallet?.deposits?.enabled || depositMinimumBusy}
                  onClick={() => selectDepositAsset(id)}
                >
                  {depositAsset === id ? "SELECIONADA" : "SELECIONAR"}
                </button>
              </article>
            ))}
          </div>
          {wallet?.deposits?.recent.some((item) => item.provider === "nowpayments") && (
            <div className="wallet-live-history">
              <span>FATURAS RECENTES</span>
              {wallet.deposits.recent
                .filter((item) => item.provider === "nowpayments")
                .slice(0, 4)
                .map((item) => (
                  <article key={item.id}>
                    <b>{item.asset}</b>
                    <span>{formatUsd(item.requestedUsd)}</span>
                    <em>{item.status.replaceAll("_", " ").toUpperCase()}</em>
                    {item.status === "credited" && (
                      <strong>+{formatCryptoAtomic(item.receivedAtomic)} {item.asset}</strong>
                    )}
                    {item.checkoutUrl && item.status !== "credited" && (
                      <a href={item.checkoutUrl} rel="noreferrer">ABRIR FATURA</a>
                    )}
                  </article>
                ))}
            </div>
          )}
          <div className="wallet-deposit-flow">
            <article><b>1</b><span><strong>FATURA</strong><small>Servidor cria um identificador único ligado à sua conta.</small></span></article>
            <article><b>2</b><span><strong>CONFIRMAÇÃO</strong><small>A assinatura, a moeda paga e a liquidação da tesouraria são conferidas.</small></span></article>
            <article><b>3</b><span><strong>SALDO CRIPTO</strong><small>O BTC ou DOGE recebido entra no livro-razão; nenhum CMA é criado automaticamente.</small></span></article>
          </div>
          <p className="wallet-provider-notice">
            <strong>{wallet?.deposits?.mode === "sandbox" ? "AMBIENTE DE TESTES: NÃO ENVIE DINHEIRO REAL." : wallet?.deposits?.enabled ? "DEPÓSITOS CONTROLADOS PELO SERVIDOR." : "DEPÓSITO AINDA DESATIVADO."}</strong>{" "}
            Nunca envie criptomoeda para um endereço ou fatura que não tenha sido gerado
            dentro desta tela após a ativação oficial.
          </p>
          <p className="wallet-provider-notice wallet-checkout-help">
            <strong>ERRO 400 NA PÁGINA DO PROVEDOR?</strong>{" "}
            Confira o e-mail antes de confirmar. Na captura enviada foi digitado
            <code> gmail.cor</code>; um endereço Gmail válido termina em <code>gmail.com</code>.
          </p>
        </section>
      ) : (
        <section className="wallet-deposit-panel wallet-withdraw-panel">
          <header>
            <span>SAQUE CRIPTO · PROCESSAMENTO MANUAL</span>
            <h3>O saque é separado da conversão</h3>
            <p>
              Somente saldos internos de BTC e DOGE poderão ser solicitados para saque.
              CMA é crédito do jogo e não pode ser sacado. A fila real permanece fechada
              até concluirmos endereço, rede, 2FA, revisão administrativa e reserva.
            </p>
          </header>
          <div className="wallet-withdraw-summary">
            <article><small>DISPONÍVEL EM BTC</small><strong>{formatCryptoAtomic(btcBalanceAtomic)} BTC</strong></article>
            <article><small>DISPONÍVEL EM DOGE</small><strong>{formatCryptoAtomic(dogeBalanceAtomic)} DOGE</strong></article>
            <article><small>STATUS</small><strong>EM PREPARAÇÃO SEGURA</strong></article>
          </div>
          <p className="wallet-provider-notice">
            <strong>NENHUM SAQUE REAL É EXECUTADO NESTA VERSÃO.</strong>{" "}
            Quando a fila for ativada, o saldo será reservado na solicitação e só será
            baixado definitivamente após o proprietário registrar a transação enviada.
          </p>
          {wallet?.withdrawals?.sandboxEnabled && (
            <section className="wallet-sandbox-lab">
              <header><div><span>TESTE DE FLUXO</span><h4>Simular pedido de saque</h4></div><strong>ZERO MOVIMENTAÇÃO</strong></header>
              <div className="wallet-sandbox-controls">
                <label>
                  MOEDA
                  <select value={sandboxAsset} onChange={(event) => setSandboxAsset(event.target.value as ConvertibleAsset)}>
                    <option value="BTC">Bitcoin · BTC</option>
                    <option value="DOGE">Dogecoin · DOGE</option>
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

      <footer className="conversion-safety-note">
        <div><b>UMA ÚNICA DIREÇÃO</b><p>BTC ou DOGE → CMA. CMA não volta para cripto.</p></div>
        <div><b>SEM SAQUE DE CMA</b><p>O CMA compra somente itens e serviços internos.</p></div>
        <div><b>REGISTRO INDIVIDUAL</b><p>Cada conta tem saldos e histórico separados no servidor.</p></div>
        <div><b>COTAÇÃO REDUNDANTE</b><p>CoinGecko com alternativa automática da Coinbase.</p></div>
      </footer>
    </section>
  );
}
