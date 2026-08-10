"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import type { ConversionAssetId } from "./conversion-rules";

type ConvertibleAsset = "BTC" | "DOGE";
type WalletTab = "convert" | "deposit";

type MarketRate = {
  asset: ConversionAssetId;
  observedAt: number;
  provider: "coingecko";
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
    enabled: boolean;
    mode: "disabled" | "live" | "sandbox";
    provider: "nowpayments";
    providerReady: boolean;
    sandboxEnabled: boolean;
    recent: Array<{
      asset: string;
      checkoutUrl: string | null;
      createdAt: number;
      expiresAt: number | null;
      id: string;
      provider: string;
      requestedUsd: number;
      creditedCma: number;
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
  const [tab, setTab] = useState<WalletTab>("convert");
  const [asset, setAsset] = useState<ConvertibleAsset>("BTC");
  const [amount, setAmount] = useState("0.0001");
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
  const [depositUsd, setDepositUsd] = useState("10");
  const [depositBusy, setDepositBusy] = useState<ConvertibleAsset | null>(null);
  const [depositError, setDepositError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
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
    ])
      .then(([conversionPayload, walletPayload]) => {
        if (!active) return;
        setRates(conversionPayload.rates!);
        setPolicy(conversionPayload.policy);
        setWallet(walletPayload);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message || "Carteira indisponível.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedRate = useMemo(
    () => rates.find((rate) => rate.asset === asset),
    [asset, rates],
  );
  const selectedBalanceAtomic =
    asset === "BTC" ? btcBalanceAtomic : dogeBalanceAtomic;
  const depositNetCmaEstimate = Math.max(
    0,
    (Number.parseFloat(depositUsd.replace(",", ".")) || 0) * 0.97,
  );

  async function requestQuote() {
    setQuoting(true);
    setQuote(null);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/conversion", {
        body: JSON.stringify({ action: "quote", amount, asset }),
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

  function useFullBalance() {
    setAmount((selectedBalanceAtomic / 100_000_000).toFixed(8));
    setQuote(null);
    setError("");
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
          className={tab === "convert" ? "active" : ""}
          role="tab"
          aria-selected={tab === "convert"}
          type="button"
          onClick={() => setTab("convert")}
        >
          CONVERTER PARA CMA
        </button>
        <button
          className={tab === "deposit" ? "active" : ""}
          role="tab"
          aria-selected={tab === "deposit"}
          type="button"
          onClick={() => setTab("deposit")}
        >
          COMPRAR CMA COM CRIPTO
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
              <span>01 · INFORME A QUANTIDADE</span>
              <div className="conversion-input-row">
                <img src={assetVisuals[asset].asset} alt="" />
                <label>
                  <small>QUANTIDADE EM {asset}</small>
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setQuote(null);
                      setSuccess("");
                    }}
                    aria-label={`Quantidade em ${asset}`}
                  />
                </label>
                <b>{asset}</b>
              </div>
              <button className="conversion-use-balance" type="button" onClick={useFullBalance}>
                USAR SALDO TOTAL · {formatCryptoAtomic(selectedBalanceAtomic)} {asset}
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
                disabled={loading || quoting || converting || !selectedRate}
                onClick={() => void requestQuote()}
              >
                {quoting ? "VALIDANDO NO SERVIDOR…" : "GERAR COTAÇÃO DE 5 MINUTOS"}
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
                    <strong>{formatCma(quote.netCma)} CMA</strong>
                    <span>válida até {new Date(quote.expiresAt).toLocaleTimeString("pt-BR")}</span>
                  </div>
                  <dl>
                    <div><dt>Valor de mercado</dt><dd>{formatUsd(quote.grossUsd)}</dd></div>
                    <div><dt>CMA bruto</dt><dd>{formatCma(quote.grossCma)} CMA</dd></div>
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
      ) : (
        <section className="wallet-deposit-panel">
          <header>
            <span>
              {wallet?.deposits?.mode === "sandbox"
                ? "SANDBOX DO PROVEDOR · SEM DINHEIRO REAL"
                : "DEPÓSITOS VIA NOWPAYMENTS"}
            </span>
            <h3>Pague em BTC ou DOGE e receba CMA</h3>
            <p>
              O Arcadia não guarda chaves privadas. O provedor cria uma fatura única e
              envia uma confirmação assinada. Depois da liquidação da tesouraria em
              USDT TRC20, o servidor credita o CMA líquido uma única vez.
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
                  : "Integração pronta; falta cadastrar a chave da conta comercial e a carteira de recebimento."}
              </span>
            </div>
            <label>
              VALOR DA FATURA EM USD
              <input
                inputMode="decimal"
                value={depositUsd}
                onChange={(event) => setDepositUsd(event.target.value)}
              />
              <small>Mínimo local US$ 5 · máximo US$ 1.000</small>
              <strong className="wallet-deposit-estimate">
                ESTIMATIVA LÍQUIDA · {formatCma(depositNetCmaEstimate)} CMA
              </strong>
            </label>
          </div>
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
                <label>
                  SAQUE SIMULADO EM {sandboxAsset}
                  <input
                    inputMode="decimal"
                    value={sandboxAmount}
                    onChange={(event) => setSandboxAmount(event.target.value)}
                  />
                  <button
                    disabled={sandboxBusy !== null}
                    type="button"
                    onClick={() => void runSandbox("withdrawal")}
                  >
                    {sandboxBusy === "withdrawal" ? "VALIDANDO…" : "SIMULAR SAQUE"}
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
              <article key={id}>
                <img src={assetVisuals[id].asset} alt="" />
                <div>
                  <small>REDE SUPORTADA</small>
                  <strong>{assetVisuals[id].name}</strong>
                  <span>{id === "BTC" ? "Rede Bitcoin" : "Rede Dogecoin"}</span>
                </div>
                <button
                  type="button"
                  disabled={!wallet?.deposits?.enabled || depositBusy !== null}
                  onClick={() => void createDeposit(id)}
                >
                  {depositBusy === id
                    ? "CRIANDO FATURA…"
                    : wallet?.deposits?.enabled
                      ? wallet.deposits.mode === "sandbox"
                        ? "CRIAR FATURA SANDBOX"
                        : "CRIAR FATURA SEGURA"
                      : "AGUARDANDO CONEXÃO"}
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
                      <strong>+{formatCma(item.creditedCma)} CMA</strong>
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
            <article><b>2</b><span><strong>LIQUIDAÇÃO</strong><small>A assinatura, o valor e o recebimento em USDT TRC20 são conferidos.</small></span></article>
            <article><b>3</b><span><strong>CRÉDITO CMA</strong><small>O valor líquido, após reserva de 3%, entra uma única vez no livro-razão.</small></span></article>
          </div>
          <p className="wallet-provider-notice">
            <strong>{wallet?.deposits?.mode === "sandbox" ? "AMBIENTE DE TESTES: NÃO ENVIE DINHEIRO REAL." : wallet?.deposits?.enabled ? "DEPÓSITOS CONTROLADOS PELO SERVIDOR." : "DEPÓSITO AINDA DESATIVADO."}</strong>{" "}
            Nunca envie criptomoeda para um endereço ou fatura que não tenha sido gerado
            dentro desta tela após a ativação oficial.
          </p>
        </section>
      )}

      <footer className="conversion-safety-note">
        <div><b>UMA ÚNICA DIREÇÃO</b><p>BTC ou DOGE → CMA. CMA não volta para cripto.</p></div>
        <div><b>SEM SAQUE DE CMA</b><p>O CMA compra somente itens e serviços internos.</p></div>
        <div><b>REGISTRO INDIVIDUAL</b><p>Cada conta tem saldos e histórico separados no servidor.</p></div>
        <a href="https://www.coingecko.com" target="_blank" rel="noreferrer">
          DADOS DE MERCADO: COINGECKO
        </a>
      </footer>
    </section>
  );
}
