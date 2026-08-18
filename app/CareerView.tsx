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
  const spanish = locale === "es";
  const [activeTab, setActiveTab] = useState<CareerTab>(initialTab);

  const tabCopy: Record<CareerTab, { label: string; description: string }> = {
    overview: {
      label: english ? "Overview" : spanish ? "Resumen" : "Visão geral",
      description: english
        ? "Level and performance"
        : spanish
          ? "Nivel y rendimiento"
          : "Nível, desempenho e emissão",
    },
    referrals: {
      label: english ? "Referrals" : spanish ? "Referencias" : "Indicações",
      description: english
        ? "Your link and signups"
        : spanish
          ? "Tu enlace y registros"
          : "Seu link e cadastros",
    },
    activity: {
      label: english ? "My history" : spanish ? "Mi historial" : "Meu histórico",
      description: english
        ? "Rounds, purchases and energy"
        : spanish
          ? "Partidas, compras y energía"
          : "Partidas, compras e energia",
    },
  };

  const copy = {
    eyebrow: english
      ? "OPERATOR CENTER · PERSONAL PROGRESS"
      : spanish
        ? "CENTRO DEL OPERADOR · PROGRESO PERSONAL"
        : "CENTRAL DO OPERADOR · PROGRESSO PESSOAL",
    title: english ? "Your Arcadia career" : spanish ? "Tu carrera en Arcadia" : "Sua carreira no Arcadia",
    description: english
      ? "Track your level and validated progress in a focused space separate from the season and minigames."
      : spanish
        ? "Sigue tu nivel y tu progreso validado en un espacio enfocado, separado de la temporada y los minijuegos."
        : "Acompanhe seu nível e seu progresso validado em um espaço separado da temporada e dos minigames.",
    areas: english ? "ORGANIZED AREAS" : spanish ? "ÁREAS ORGANIZADAS" : "ÁREAS ORGANIZADAS",
    rewards: english
      ? "Server-controlled rewards"
      : spanish
        ? "Recompensas controladas por el servidor"
        : "Recompensas controladas pelo servidor",
    navLabel: english
      ? "Operator center sections"
      : spanish
        ? "Secciones del centro del operador"
        : "Seções da Central do Operador",
  };

  return (
    <section className="career-view">
      <div className="career-hero">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <aside>
          <strong>3</strong>
          <span>{copy.areas}</span>
          <small>{copy.rewards}</small>
        </aside>
      </div>

      <nav className="career-tabs" aria-label={copy.navLabel}>
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
              <strong>{tabCopy[tab.id].label}</strong>
              <small>{tabCopy[tab.id].description}</small>
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
