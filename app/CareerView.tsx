"use client";

import { useState } from "react";
import { ActivityPanel } from "./ActivityPanel";
import { OperatorProgressPanel } from "./OperatorProgressPanel";
import { ReferralPanel } from "./ReferralPanel";
import { useArcadiaLanguage } from "./i18n";

type CareerTab = "overview" | "referrals" | "activity";

const tabs: Array<{
  id: CareerTab;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Visão geral",
    description: "Nível, desempenho e emissão",
  },
  {
    id: "referrals",
    label: "Indicações",
    description: "Seu link e cadastros",
  },
  {
    id: "activity",
    label: "Meu histórico",
    description: "Partidas, compras e energia",
  },
];

export function CareerView({
  initialTab = "overview",
}: {
  initialTab?: CareerTab;
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const [activeTab, setActiveTab] = useState<CareerTab>(initialTab);

  const tabCopy: Record<CareerTab, { label: string; description: string }> = {
    overview: { label: "Overview", description: "Level and performance" },
    referrals: { label: "Referrals", description: "Your link and signups" },
    activity: { label: "My history", description: "Rounds, purchases and energy" },
  };

  return (
    <section className="career-view">
      <div className="career-hero">
        <div>
          <span className="eyebrow">{english ? "OPERATOR CENTER · PERSONAL PROGRESS" : "CENTRAL DO OPERADOR · PROGRESSO PESSOAL"}</span>
          <h2>{english ? "Your Arcadia career" : "Sua carreira no Arcadia"}</h2>
          <p>
            {english
              ? "Track your level and validated progress in a focused space separate from the season and minigames."
              : "Acompanhe seu nível e seu progresso validado em um espaço separado da temporada e dos minigames."}
          </p>
        </div>
        <aside>
          <strong>3</strong>
          <span>{english ? "ORGANIZED AREAS" : "ÁREAS ORGANIZADAS"}</span>
          <small>{english ? "Server-controlled rewards" : "Recompensas controladas pelo servidor"}</small>
        </aside>
      </div>

      <nav className="career-tabs" aria-label={english ? "Operator center sections" : "Seções da Central do Operador"}>
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "active" : ""}
            type="button"
            aria-pressed={activeTab === tab.id}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{String(tabs.indexOf(tab) + 1).padStart(2, "0")}</span>
            <div>
              <strong>{english ? tabCopy[tab.id].label : tab.label}</strong>
              <small>{english ? tabCopy[tab.id].description : tab.description}</small>
            </div>
          </button>
        ))}
      </nav>

      <div className="career-content">
        {activeTab === "referrals" ? (
          <ReferralPanel />
        ) : activeTab === "activity" ? (
          <ActivityPanel refreshKey={0} />
        ) : (
          <OperatorProgressPanel
            refreshKey={0}
            section={activeTab}
          />
        )}
      </div>
    </section>
  );
}
