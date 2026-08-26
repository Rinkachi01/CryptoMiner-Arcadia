"use client";

import { useState } from "react";
import { assetsManifest } from "./assets.manifest";
import { useArcadiaLanguage } from "./i18n";
import type { OnboardingStatus } from "./onboarding-rules";

type TourTarget = "mine" | "games" | "pools" | "career" | "conversion" | "season" | "forge";

type OperatorTourProps = {
  accountKey: string;
  status: OnboardingStatus | null;
  stagingVisuals: boolean;
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
  image: string;
  imageAlt: string;
  visualClass?: string;
}> = [
  {
    title: "Comece pela sala de mineração",
    titleEn: "Start in the mining room",
    text: "A sala é o centro da operação. Abra um rack, instale seus mineradores e acompanhe poder, energia e próximo bloco no painel lateral.",
    textEn: "The room is the heart of your operation. Open a rack, install miners, and follow power, energy, and the next block in the side panel.",
    target: "mine",
    action: "rack",
    label: "Ver a sala",
    labelEn: "View the room",
    image: assetsManifest.roomOne.path,
    imageAlt: assetsManifest.roomOne.alt,
    visualClass: "room",
  },
  {
    title: "Sua carteira guarda os saldos",
    titleEn: "Your wallet holds your balances",
    text: "Na carteira você consulta CMA e as moedas recebidas, acompanha o histórico e encontra as opções de depósito, conversão e saque disponíveis para a sua conta.",
    textEn: "In the wallet you check CMA and received coins, review history, and find the deposit, conversion, and withdrawal options available to your account.",
    target: "conversion",
    action: "navigate",
    label: "Abrir carteira",
    labelEn: "Open wallet",
    image: assetsManifest.cmaCoin.path,
    imageAlt: assetsManifest.cmaCoin.alt,
    visualClass: "wallet",
  },
  {
    title: "Jogue minigames para progredir",
    titleEn: "Play minigames to progress",
    text: "Escolha um jogo, leia o objetivo antes de iniciar e conclua a partida. O servidor valida o resultado e registra XP e poder temporário quando a rodada é aprovada.",
    textEn: "Choose a game, read its objective before starting, and finish the round. The server validates the result and records XP and temporary power when approved.",
    target: "games",
    action: "navigate",
    label: "Ir para minigames",
    labelEn: "Go to minigames",
    image: "/assets/minigames/packet-catch-thumb.png",
    imageAlt: "Miniatura do minigame Packet Catch",
    visualClass: "game",
  },
  {
    title: "A temporada transforma XP em recompensas",
    titleEn: "The season turns XP into rewards",
    text: "Missões diárias, semanais e partidas válidas geram XP. Avance os níveis para resgatar baterias, mineradores, peças e recompensas do passe.",
    textEn: "Daily and weekly missions plus valid rounds grant XP. Advance through the levels to claim batteries, miners, parts, and pass rewards.",
    target: "season",
    action: "navigate",
    label: "Ver temporada",
    labelEn: "View season",
    image: "/assets/season/space-race/banner.png",
    imageAlt: "Banner da temporada Corrida Espacial",
    visualClass: "season",
  },
  {
    title: "Melhore sua operação na oficina",
    titleEn: "Improve your operation in the workshop",
    text: "Quando você tiver duas unidades idênticas ou peças suficientes, use a Oficina Arcadia para fundir e evoluir. O custo e os requisitos aparecem antes da confirmação.",
    textEn: "When you have two identical units or enough parts, use Arcadia Forge to merge and evolve them. The cost and requirements are shown before confirmation.",
    target: "forge",
    action: "navigate",
    label: "Abrir oficina",
    labelEn: "Open workshop",
    image: assetsManifest.rackBasic.path,
    imageAlt: assetsManifest.rackBasic.alt,
    visualClass: "forge",
  },
];

export function OperatorTour({
  accountKey,
  status,
  stagingVisuals,
  onNavigate,
  onOpenStarterRack,
}: OperatorTourProps) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const storageKey = `arcadia-intro-guide:v1:${accountKey.toLowerCase()}`;
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(storageKey) === "dismissed",
  );
  const [stepIndex, setStepIndex] = useState(0);
  // The workshop is a staging-only experience. Keep it out of the shared
  // production guide so the tour can never navigate a live account there.
  const guideSteps = stagingVisuals
    ? steps
    : steps.filter((item) => item.target !== "forge");

  // The visual guide is intentionally independent from the task checklist.
  // Existing accounts also get one clear explanation on their next visit,
  // while the checklist below the room remains authoritative for starter kits.
  if (!status || dismissed) return null;

  const step = guideSteps[stepIndex] ?? guideSteps[0];

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
    if (stepIndex >= guideSteps.length - 1) {
      closeTour();
    } else {
      setStepIndex((current) => current + 1);
    }
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
            <strong>{stepIndex + 1}/{guideSteps.length}</strong>
          </div>
          <button type="button" onClick={closeTour} aria-label={english ? "Close tour" : "Fechar tour"}>
            ×
          </button>
        </header>
        <div className="operator-tour-progress" aria-hidden="true">
          {guideSteps.map((_, index) => (
            <i key={index} className={index <= stepIndex ? "active" : ""} />
          ))}
        </div>
        <div className="operator-tour-body">
          <div className={`operator-tour-visual ${step.visualClass ?? ""}`}>
            <img src={step.image} alt={step.imageAlt} />
            {step.visualClass === "wallet" && (
              <div className="operator-tour-coin-row" aria-hidden="true">
                <img src={assetsManifest.dogecoin.path} alt="" />
                <img src={assetsManifest.litecoin.path} alt="" />
                <img src={assetsManifest.bitcoin.path} alt="" />
              </div>
            )}
          </div>
          <span className="operator-tour-kicker">{english ? "STEP" : "PASSO"} {stepIndex + 1}</span>
          <h2 id="operator-tour-title">{english ? step.titleEn : step.title}</h2>
          <p>{english ? step.textEn : step.text}</p>
          <div className="operator-tour-actions">
            <button type="button" className="secondary" onClick={closeTour}>
              {english ? "Close guide" : "Fechar guia"}
            </button>
            <button type="button" onClick={continueToStep}>
              {stepIndex >= guideSteps.length - 1
                ? english ? "Finish" : "Concluir"
                : english ? step.labelEn : step.label}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
