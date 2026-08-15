"use client";

import { useState } from "react";
import { ActivityPanel } from "./ActivityPanel";
import { OperatorProgressPanel } from "./OperatorProgressPanel";
import { SeasonPanel } from "./SeasonPanel";
import { ReferralPanel } from "./ReferralPanel";
import { useArcadiaLanguage } from "./i18n";

type CareerTab = "overview" | "season" | "missions" | "referrals" | "activity";

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
    id: "season",
    label: "Temporada",
    description: "Ranking e ciclo competitivo",
  },
  {
    id: "missions",
    label: "Missões e carreira",
    description: "Bateria e conquistas",
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
  onRefreshAccount,
  initialTab = "overview",
}: {
  onRefreshAccount: () => Promise<boolean>;
  initialTab?: "overview" | "missions";
}) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  const [activeTab, setActiveTab] = useState<CareerTab>(initialTab);
  const [refreshKey, setRefreshKey] = useState(0);

  async function refreshAccount() {
    const refreshed = await onRefreshAccount();
    setRefreshKey((current) => current + 1);
    return refreshed;
  }

  const tabCopy: Record<CareerTab, { label: string; description: string }> = {
    overview: { label: "Overview", description: "Level, performance and emission" },
    season: { label: "Season", description: "Competitive cycle" },
    missions: { label: "Missions and career", description: "Batteries and achievements" },
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
              ? "Track your level, season and missions in a space separate from the minigames. All progress remains server-validated."
              : "Acompanhe seu nível, temporada e missões em um espaço separado dos minigames. Toda progressão continua validada pelo servidor."}
          </p>
        </div>
        <aside>
          <strong>5</strong>
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
        {activeTab === "overview" ? (
          <button
            className="career-season-callout"
            type="button"
            onClick={() => setActiveTab("season")}
          >
            <span>SEASON 01</span>
            <div>
              <strong>{english ? "Space Race" : "Corrida Espacial"}</strong>
              <small>{english ? "120 days · 50 levels · XP · rewards" : "120 dias · 50 níveis · XP · recompensas"}</small>
            </div>
            <b>{english ? "VIEW SEASON →" : "VER TEMPORADA →"}</b>
          </button>
        ) : null}
        {activeTab === "season" ? (
          <SeasonPanel
            refreshKey={refreshKey}
            onRefreshAccount={refreshAccount}
          />
        ) : activeTab === "referrals" ? (
          <ReferralPanel />
        ) : activeTab === "activity" ? (
          <ActivityPanel refreshKey={refreshKey} />
        ) : activeTab === "missions" ? (
          <div className="missions-tab-layout">
            <OperatorProgressPanel
              refreshKey={refreshKey}
              section={activeTab}
            />
          </div>
        ) : (
          <OperatorProgressPanel
            refreshKey={refreshKey}
            section={activeTab}
          />
        )}
      </div>
    </section>
  );
}
