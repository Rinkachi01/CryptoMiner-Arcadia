"use client";

import { useEffect, useState } from "react";
import { useArcadiaLanguage } from "./i18n";

type ReferralOverview = {
  code: string;
  invited: number;
  link: string;
  proposal: {
    cmaRewardPercent: number;
    cryptoRewardPercent: number;
    eligibilityHours: number;
    minimumCompletedGames: number;
    payoutMode: "per_validated_block";
    hasPayoutCap: boolean;
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
          <p>{english ? "Receive a bonus on every validated block mined by operators who join through your link." : "Receba um bônus em cada bloco validado minerado pelos operadores que entrarem pelo seu link."}</p>
        </div>
        <aside><strong>{data.invited}</strong><span>{english ? "LINKED SIGNUPS" : "CADASTROS VINCULADOS"}</span></aside>
      </header>
      <div className="referral-link-card">
        <span>{data.link}</span>
        <button type="button" onClick={() => void copyLink()}>{english ? "COPY LINK" : "COPIAR LINK"}</button>
      </div>
      <div className="referral-policy-grid">
        <article><strong>{data.proposal.cmaRewardPercent}%</strong><span>{english ? "of each CMA block" : "de cada bloco CMA"}</span></article>
        <article><strong>{data.proposal.cryptoRewardPercent}%</strong><span>{english ? "of each BTC, DOGE or LTC block" : "de cada bloco BTC, DOGE ou LTC"}</span></article>
        <article><strong>{english ? "PER BLOCK" : "POR BLOCO"}</strong><span>{english ? "paid as blocks are validated" : "pago conforme os blocos são validados"}</span></article>
        <article><strong>{data.proposal.hasPayoutCap ? "CAP" : english ? "NO CAP" : "SEM TETO"}</strong><span>{english ? "no accumulated balance" : "sem recompensa acumulada"}</span></article>
      </div>
      <p className="referral-note">{english ? `After ${data.proposal.eligibilityHours} hours and ${data.proposal.minimumCompletedGames} completed games, the bonus is credited block by block. The invited operator keeps the full block reward; no balance is accumulated and the program does not change the fixed reward per block.` : `Após ${data.proposal.eligibilityHours} horas e ${data.proposal.minimumCompletedGames} partidas concluídas, o bônus é creditado bloco a bloco. O operador indicado mantém a recompensa integral do bloco; não há saldo acumulado e o programa não altera a recompensa fixa por bloco.`}</p>
      {message && <p className="conversion-success" role="status">{message}</p>}
    </section>
  );
}
