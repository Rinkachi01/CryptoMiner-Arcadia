"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import type { ConversionAssetId } from "./conversion-rules";

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
  conversionEnabled: false;
  error?: string;
  policy?: {
    cmaUsdReference: number;
    feeBps: number;
    minimumUsd: number;
    oneWayOnly: boolean;
    withdrawableCma: boolean;
  };
  quote?: Quote;
  rates?: MarketRate[];
};

const assetVisuals: Record<ConversionAssetId, { asset: string; name: string }> = {
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

function formatCma(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
  });
}

export function ConversionView() {
  const [asset, setAsset] = useState<ConversionAssetId>("BTC");
  const [amount, setAmount] = useState("0.0001");
  const [rates, setRates] = useState<MarketRate[]>([]);
  const [policy, setPolicy] = useState<ConversionResponse["policy"]>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/conversion", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as ConversionResponse;
        if (!response.ok || !payload.rates || !payload.policy) {
          throw new Error(payload.error ?? "Não foi possível consultar o mercado.");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setRates(payload.rates!);
        setPolicy(payload.policy);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message || "Cotação indisponível.");
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

  async function requestQuote() {
    setQuoting(true);
    setQuote(null);
    setError("");
    try {
      const response = await fetch("/api/conversion", {
        body: JSON.stringify({ amount, asset }),
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

  return (
    <section className="conversion-center">
      <header className="conversion-hero">
        <div>
          <span>CENTRAL DE CONVERSÃO · PRÉVIA PROTEGIDA</span>
          <h2>Transforme valor de mercado em CMA</h2>
          <p>
            O CMA usa a referência econômica interna de <strong>1 CMA = US$ 1</strong>.
            Ele serve para compras dentro do Arcadia e não pode ser sacado.
          </p>
        </div>
        <aside>
          <b>SIMULAÇÃO ATIVA</b>
          <strong>DEPÓSITOS BLOQUEADOS</strong>
          <small>Nenhum saldo é movimentado nesta fase.</small>
        </aside>
      </header>

      <div className="conversion-rate-strip" aria-live="polite">
        {(["BTC", "DOGE", "LTC"] as ConversionAssetId[]).map((id) => {
          const rate = rates.find((item) => item.asset === id);
          return (
            <button
              className={asset === id ? "active" : ""}
              type="button"
              key={id}
              onClick={() => {
                setAsset(id);
                setQuote(null);
              }}
            >
              <img src={assetVisuals[id].asset} alt="" />
              <span>
                <small>{assetVisuals[id].name}</small>
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
                }}
                aria-label={`Quantidade em ${asset}`}
              />
            </label>
            <b>{asset}</b>
          </div>

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
              <span>MÍNIMO DA PRÉVIA</span>
              <strong>{formatUsd(policy?.minimumUsd ?? 1)}</strong>
            </div>
          </div>

          <button
            className="conversion-quote-button"
            type="button"
            disabled={loading || quoting || !selectedRate}
            onClick={() => void requestQuote()}
          >
            {quoting ? "VALIDANDO NO SERVIDOR…" : "GERAR COTAÇÃO DE 5 MINUTOS"}
          </button>
          {error && <p className="conversion-error">{error}</p>}
        </section>

        <section className={`conversion-receipt ${quote ? "ready" : ""}`}>
          <span>02 · RESULTADO DA PRÉVIA</span>
          {!quote ? (
            <div className="conversion-empty">
              <b>CMA</b>
              <strong>Aguardando quantidade</strong>
              <p>A cotação será calculada e registrada pelo servidor.</p>
            </div>
          ) : (
            <>
              <div className="conversion-receipt-main">
                <small>VOCÊ RECEBERIA</small>
                <strong>{formatCma(quote.netCma)} CMA</strong>
                <span>cotação válida até {new Date(quote.expiresAt).toLocaleTimeString("pt-BR")}</span>
              </div>
              <dl>
                <div>
                  <dt>Valor de mercado</dt>
                  <dd>{formatUsd(quote.grossUsd)}</dd>
                </div>
                <div>
                  <dt>CMA bruto</dt>
                  <dd>{formatCma(quote.grossCma)} CMA</dd>
                </div>
                <div>
                  <dt>Reserva de {(quote.feeBps / 100).toFixed(2)}%</dt>
                  <dd>-{formatCma(quote.feeCma)} CMA</dd>
                </div>
                <div>
                  <dt>Cotação usada</dt>
                  <dd>1 {quote.asset} = {formatUsd(quote.rateUsd)}</dd>
                </div>
              </dl>
              <button type="button" disabled>
                CONVERTER — AGUARDANDO PROVEDOR
              </button>
              {!quote.eligible && (
                <p className="conversion-error">A prévia está abaixo do mínimo econômico.</p>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="conversion-safety-note">
        <div>
          <b>UMA ÚNICA DIREÇÃO</b>
          <p>BTC, DOGE ou LTC → CMA. Não existe conversão de CMA para cripto.</p>
        </div>
        <div>
          <b>SEM SAQUE DE CMA</b>
          <p>O CMA só compra mineradores, racks, energia, salas e itens internos.</p>
        </div>
        <div>
          <b>COTAÇÃO DO SERVIDOR</b>
          <p>Preço de referência do CoinGecko, com cache e validade limitada.</p>
        </div>
        <a href="https://www.coingecko.com" target="_blank" rel="noreferrer">
          DADOS DE MERCADO: COINGECKO
        </a>
      </footer>
    </section>
  );
}
