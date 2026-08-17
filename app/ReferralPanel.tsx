"use client";

import { useEffect, useState } from "react";
import { useArcadiaLanguage } from "./i18n";

type ReferralOverview = {
  code: string;
  invited: number;
  link: string;
  proposal: {
    miningRewardPercent: number;
    eligibilityHours: number;
    minimumCompletedGames: number;
    perReferralCapCma: number;
    weeklyCapCma: number;
    status: "active";
  };
};

export function ReferralPanel() {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const [data, setData] = useState<ReferralOverview | null>(null);
  const [message, setMessage] = useState(english ? "Loading your link…" : "Carregando seu link…");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/referrals", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as ReferralOverview & { error?: string };
        if (!response.ok) throw new Error(result.error ?? (english ? "Referrals unavailable." : "Indicações indisponíveis."));
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
          setMessage(error instanceof Error ? error.message : english ? "Referrals unavailable." : "Indicações indisponíveis.");
        }
      });
    return () => controller.abort();
  }, [english]);

  if (!data) return <section className="referral-panel loading">{message}</section>;

  async function copyLink() {
    await navigator.clipboard.writeText(data!.link);
    setMessage(english ? "Link copied." : "Link copiado.");
  }

  return (
    <section className="referral-panel">
      <header>
        <div>
          <span>{english ? "REFERRAL PROGRAM · SHARED MINING" : "PROGRAMA DE INDICAÇÃO · MINERAÇÃO COMPARTILHADA"}</span>
          <h3>{english ? "Invite new operators" : "Convide novos operadores"}</h3>
          <p>{english ? "Receive a share of validated mining rewards from operators who join through your link." : "Receba uma parte das recompensas de mineração validadas dos operadores que entrarem pelo seu link."}</p>
        </div>
        <aside><strong>{data.invited}</strong><span>{english ? "LINKED SIGNUPS" : "CADASTROS VINCULADOS"}</span></aside>
      </header>
      <div className="referral-link-card">
        <span>{data.link}</span>
        <button type="button" onClick={() => void copyLink()}>{english ? "COPY LINK" : "COPIAR LINK"}</button>
      </div>
      <div className="referral-policy-grid">
        <article><strong>{data.proposal.miningRewardPercent}%</strong><span>{english ? "of validated mining" : "da mineração validada"}</span></article>
        <article><strong>0%</strong><span>{english ? "additional emission" : "de emissão adicional"}</span></article>
        <article><strong>{data.proposal.perReferralCapCma} CMA</strong><span>{english ? "maximum per referred operator" : "máximo por operador indicado"}</span></article>
        <article><strong>{data.proposal.weeklyCapCma} CMA</strong><span>{english ? "weekly cap per referrer" : "teto semanal por indicador"}</span></article>
      </div>
      <p className="referral-note">{english ? `The share is released after ${data.proposal.eligibilityHours} hours and ${data.proposal.minimumCompletedGames} completed games. It is deducted from the invitee's validated reward without increasing fixed block values.` : `A participação é liberada após ${data.proposal.eligibilityHours} horas e ${data.proposal.minimumCompletedGames} partidas concluídas. Ela é descontada da recompensa validada do indicado sem aumentar o valor fixo dos blocos.`}</p>
      {message && <p className="conversion-success" role="status">{message}</p>}
    </section>
  );
}
