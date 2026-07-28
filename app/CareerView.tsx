"use client";

import { useState } from "react";
import { OperatorProgressPanel } from "./OperatorProgressPanel";
import { SeasonPanel } from "./SeasonPanel";

type CareerTab = "overview" | "season" | "missions";

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
    description: "Bateria, liga e conquistas",
  },
];

export function CareerView({
  onRefreshAccount,
}: {
  onRefreshAccount: () => Promise<boolean>;
}) {
  const [activeTab, setActiveTab] = useState<CareerTab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  async function refreshAccount() {
    const refreshed = await onRefreshAccount();
    setRefreshKey((current) => current + 1);
    return refreshed;
  }

  return (
    <section className="career-view">
      <div className="career-hero">
        <div>
          <span className="eyebrow">CENTRAL DO OPERADOR · PROGRESSO PESSOAL</span>
          <h2>Sua carreira no Arcadia</h2>
          <p>
            Acompanhe seu nível, temporada e missões em um espaço separado dos
            minigames. Toda progressão continua validada pelo servidor.
          </p>
        </div>
        <aside>
          <strong>3</strong>
          <span>ÁREAS ORGANIZADAS</span>
          <small>Sem prêmio financeiro ou saque</small>
        </aside>
      </div>

      <nav className="career-tabs" aria-label="Seções da Central do Operador">
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
              <strong>{tab.label}</strong>
              <small>{tab.description}</small>
            </div>
          </button>
        ))}
      </nav>

      <div className="career-content">
        {activeTab === "season" ? (
          <SeasonPanel refreshKey={refreshKey} />
        ) : (
          <OperatorProgressPanel
            refreshKey={refreshKey}
            section={activeTab}
            onRefreshAccount={refreshAccount}
          />
        )}
      </div>
    </section>
  );
}
