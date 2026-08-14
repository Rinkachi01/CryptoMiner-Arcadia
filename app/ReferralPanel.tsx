"use client";

import { useEffect, useState } from "react";

type ReferralOverview = {
  code: string;
  invited: number;
  link: string;
  proposal: {
    miningRewardPercent: number;
    status: "active";
    validationDays: number;
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
          <span>PROGRAMA DE INDICAÇÃO · MINERAÇÃO COMPARTILHADA</span>
          <h3>Convide novos operadores</h3>
          <p>Receba uma parte das recompensas de mineração validadas dos operadores que entrarem pelo seu link.</p>
        </div>
        <aside><strong>{data.invited}</strong><span>CADASTROS VINCULADOS</span></aside>
      </header>
      <div className="referral-link-card">
        <span>{data.link}</span>
        <button type="button" onClick={() => void copyLink()}>COPIAR LINK</button>
      </div>
      <div className="referral-policy-grid">
        <article><strong>{data.proposal.miningRewardPercent}%</strong><span>da mineração validada</span></article>
        <article><strong>0%</strong><span>de emissão adicional</span></article>
        <article><strong>{data.proposal.validationDays} dias</strong><span>prazo antifraude</span></article>
        <article><strong>Contínua</strong><span>enquanto a indicação estiver ativa</span></article>
      </div>
      <p className="referral-note">A participação é descontada da recompensa do indicado, sem aumentar o valor fixo dos blocos. O modelo não desconta BTC, DOGE ou LTC minerados e não aumenta o valor fixo dos blocos.</p>
      {message && <p className="conversion-success" role="status">{message}</p>}
    </section>
  );
}
