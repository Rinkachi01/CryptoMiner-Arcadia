"use client";

import { useState } from "react";
import { useArcadiaLanguage } from "./i18n";
import type { OnboardingStatus } from "./onboarding-rules";

type TourTarget = "mine" | "games" | "pools" | "career";

type OperatorTourProps = {
  accountKey: string;
  status: OnboardingStatus | null;
  onNavigate: (target: TourTarget) => void;
  onOpenStarterRack: () => void;
};

const steps: Array<{
  title: string;
  titleEn: string;
  text: string;
  textEn: string;
  target: TourTarget;
  action: "navigate" | "rack";
  label: string;
  labelEn: string;
}> = [
  {
    title: "Seu kit já está na sala",
    titleEn: "Your starter kit is in the room",
    text: "Você recebeu um rack e um minerador inicial. Abra o rack para instalar o Byte Spark e começar sua operação.",
    textEn: "You received a rack and a starter miner. Open the rack to install Byte Spark and begin your operation.",
    target: "mine",
    action: "rack",
    label: "Abrir rack",
    labelEn: "Open rack",
  },
  {
    title: "Jogue para ativar energia",
    titleEn: "Play to activate energy",
    text: "Os minigames validam sua atividade e liberam energia para manter os mineradores ligados.",
    textEn: "Minigames validate your activity and release energy to keep your miners running.",
    target: "games",
    action: "navigate",
    label: "Ir para minigames",
    labelEn: "Go to minigames",
  },
  {
    title: "Escolha onde seu poder trabalha",
    titleEn: "Choose where your power works",
    text: "Na tela de pools, distribua o poder entre CMA, Bitcoin, Dogecoin e Litecoin. A recompensa de cada bloco é fixa.",
    textEn: "In Pools, distribute power across CMA, Bitcoin, Dogecoin, and Litecoin. Each block has a fixed reward.",
    target: "pools",
    action: "navigate",
    label: "Abrir pools",
    labelEn: "Open pools",
  },
  {
    title: "Acompanhe seus blocos",
    titleEn: "Track your blocks",
    text: "O servidor sincroniza a operação e mostra cada bloco processado no canto da tela. O saldo fica no extrato da carteira.",
    textEn: "The server syncs your operation and shows each processed block in the corner of the screen. Your balance is recorded in the wallet ledger.",
    target: "career",
    action: "navigate",
    label: "Ver operação",
    labelEn: "View operation",
  },
];

export function OperatorTour({
  accountKey,
  status,
  onNavigate,
  onOpenStarterRack,
}: OperatorTourProps) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const storageKey = `arcadia-operator-tour:${accountKey.toLowerCase()}`;
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(storageKey) === "dismissed",
  );

  if (!status?.eligible || status.completed || dismissed) return null;

  const stepIndex = Math.min(steps.length - 1, status.completedCount);
  const step = steps[stepIndex] ?? steps[0];

  function closeTour() {
    window.localStorage.setItem(storageKey, "dismissed");
    setDismissed(true);
  }

  function continueToStep() {
    if (step.action === "rack") {
      onOpenStarterRack();
    } else {
      onNavigate(step.target);
    }
    closeTour();
  }

  return (
    <div className="operator-tour-backdrop" role="presentation">
      <section
        className="operator-tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operator-tour-title"
      >
        <header>
          <div>
            <span>{english ? "FIRST ACCESS · OPERATOR TOUR" : "PRIMEIRO ACESSO · TOUR DO OPERADOR"}</span>
            <strong>{stepIndex + 1}/{steps.length}</strong>
          </div>
          <button type="button" onClick={closeTour} aria-label={english ? "Close tour" : "Fechar tour"}>
            ×
          </button>
        </header>
        <div className="operator-tour-progress" aria-hidden="true">
          {steps.map((_, index) => (
            <i key={index} className={index <= stepIndex ? "active" : ""} />
          ))}
        </div>
        <div className="operator-tour-body">
          <span className="operator-tour-kicker">{english ? "STEP" : "PASSO"} {stepIndex + 1}</span>
          <h2 id="operator-tour-title">{english ? step.titleEn : step.title}</h2>
          <p>{english ? step.textEn : step.text}</p>
          <div className="operator-tour-actions">
            <button type="button" className="secondary" onClick={closeTour}>
              {english ? "Skip tour" : "Pular tour"}
            </button>
            <button type="button" onClick={continueToStep}>
              {english ? step.labelEn : step.label}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
