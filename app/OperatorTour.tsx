"use client";

import { useState } from "react";
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
  text: string;
  target: TourTarget;
  action: "navigate" | "rack";
  label: string;
}> = [
  {
    title: "Seu kit já está na sala",
    text: "Você recebeu um rack e um minerador inicial. Abra o rack para instalar o Byte Spark e começar sua operação.",
    target: "mine",
    action: "rack",
    label: "Abrir rack",
  },
  {
    title: "Jogue para ativar energia",
    text: "Os minigames validam sua atividade e liberam energia para manter os mineradores ligados.",
    target: "games",
    action: "navigate",
    label: "Ir para minigames",
  },
  {
    title: "Escolha onde seu poder trabalha",
    text: "Na tela de pools, distribua o poder entre CMA, Bitcoin, Dogecoin e Litecoin. A recompensa de cada bloco é fixa.",
    target: "pools",
    action: "navigate",
    label: "Abrir pools",
  },
  {
    title: "Acompanhe seus blocos",
    text: "O servidor sincroniza a operação e mostra cada bloco processado no canto da tela. O saldo fica no extrato da carteira.",
    target: "career",
    action: "navigate",
    label: "Ver operação",
  },
];

export function OperatorTour({
  accountKey,
  status,
  onNavigate,
  onOpenStarterRack,
}: OperatorTourProps) {
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
            <span>PRIMEIRO ACESSO · TOUR DO OPERADOR</span>
            <strong>{stepIndex + 1}/{steps.length}</strong>
          </div>
          <button type="button" onClick={closeTour} aria-label="Fechar tour">
            ×
          </button>
        </header>
        <div className="operator-tour-progress" aria-hidden="true">
          {steps.map((_, index) => (
            <i key={index} className={index <= stepIndex ? "active" : ""} />
          ))}
        </div>
        <div className="operator-tour-body">
          <span className="operator-tour-kicker">PASSO {stepIndex + 1}</span>
          <h2 id="operator-tour-title">{step.title}</h2>
          <p>{step.text}</p>
          <div className="operator-tour-actions">
            <button type="button" className="secondary" onClick={closeTour}>
              Pular tour
            </button>
            <button type="button" onClick={continueToStep}>
              {step.label}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
