"use client";

import { useEffect, useState } from "react";

type ReferralOverview = {
  code: string;
  invited: number;
  link: string;
  proposal: {
    earningWindowDays: number;
    eligibleSpendPercent: number;
    status: "tracking";
    validationDays: number;
    weeklyCapCma: number;
  };
};

export function ReferralPanel() {
  const [data, setData] = useState<ReferralOverview | null>(null);
  const [message, setMessage] = useState("Carregando seu link…");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/referrals", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as ReferralOverview & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Indicações indisponíveis.");
        return result;
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setMessage("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : "Indicações indisponíveis.");
        }
      });
    return () => controller.abort();
  }, []);

  if (!data) return <section className="referral-panel loading">{message}</section>;

  async function copyLink() {
    await navigator.clipboard.writeText(data!.link);
    setMessage("Link copiado.");
  }

  return (
    <section className="referral-panel">
      <header>
        <div>
          <span>PROGRAMA DE INDICAÇÃO · FASE DE RASTREAMENTO</span>
          <h3>Convide novos operadores</h3>
          <p>O código já identifica cadastros reais. O bônus só será liberado depois da validação econômica e antifraude.</p>
        </div>
        <aside><strong>{data.invited}</strong><span>CADASTROS VINCULADOS</span></aside>
      </header>
      <div className="referral-link-card">
        <span>{data.link}</span>
        <button type="button" onClick={() => void copyLink()}>COPIAR LINK</button>
      </div>
      <div className="referral-policy-grid">
        <article><strong>{data.proposal.eligibleSpendPercent}%</strong><span>das compras elegíveis em CMA</span></article>
        <article><strong>{data.proposal.weeklyCapCma} CMA</strong><span>teto semanal por indicador</span></article>
        <article><strong>{data.proposal.validationDays} dias</strong><span>prazo antifraude</span></article>
        <article><strong>{data.proposal.earningWindowDays} dias</strong><span>janela por indicado</span></article>
      </div>
      <p className="referral-note">O modelo não desconta BTC, DOGE ou LTC minerados e não aumenta o valor fixo dos blocos.</p>
      {message && <p className="conversion-success" role="status">{message}</p>}
    </section>
  );
}
