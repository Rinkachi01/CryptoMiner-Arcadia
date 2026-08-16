"use client";

/* eslint-disable @next/next/no-img-element */

import { assetsManifest } from "./assets.manifest";
import { useArcadiaLanguage } from "./i18n";
import type {
  OnboardingMilestones,
  OnboardingStatus,
} from "./onboarding-rules";

type FirstDayTarget = "mine" | "pools" | "games" | "career";

type FirstDayPanelProps = {
  batteryCount: number;
  status: OnboardingStatus | null;
  onNavigate: (target: FirstDayTarget) => void;
  onOpenStarterRack: () => void;
  onActivateEnergy: () => void;
};

const stepDefinitions: Array<{
  id: keyof OnboardingMilestones;
  label: string;
  labelEn: string;
  short: string;
  shortEn: string;
  target: FirstDayTarget;
}> = [
  {
    id: "kitDelivered",
    label: "Kit entregue",
    labelEn: "Starter kit delivered",
    short: "Rack e Byte Spark, somente",
    shortEn: "Rack and Byte Spark only",
    target: "mine",
  },
  {
    id: "minerInstalled",
    label: "Instale o Byte Spark",
    labelEn: "Install Byte Spark",
    short: "Abra o rack e escolha um slot",
    shortEn: "Open the rack and choose a slot",
    target: "mine",
  },
  {
    id: "arcadeCompleted",
    label: "Complete o Tour do Arcade",
    labelEn: "Complete the Arcade Tour",
    short: "Jogue os três minigames",
    shortEn: "Play the three minigames",
    target: "games",
  },
  {
    id: "energyOnline",
    label: "Conquiste energia",
    labelEn: "Earn energy",
    short: "Resgate a bateria do Tour e use-a",
    shortEn: "Claim and use the Tour battery",
    target: "career",
  },
  {
    id: "poolsConfirmed",
    label: "Confirme sua pool",
    labelEn: "Confirm your pool",
    short: "Salve a distribuição do poder",
    shortEn: "Save your power allocation",
    target: "pools",
  },
  {
    id: "firstBlockCredited",
    label: "Receba o primeiro bloco",
    labelEn: "Receive your first block",
    short: "A recompensa será registrada",
    shortEn: "The reward will be recorded",
    target: "pools",
  },
];

export function FirstDayPanel({
  batteryCount,
  status,
  onNavigate,
  onOpenStarterRack,
  onActivateEnergy,
}: FirstDayPanelProps) {
  const { locale } = useArcadiaLanguage();
  const english = locale === "en";
  if (!status?.eligible || status.completed) return null;

  const nextStep =
    stepDefinitions.find((step) => !status.milestones[step.id]) ??
    stepDefinitions[stepDefinitions.length - 1];
  const progress = Math.round(
    (status.completedCount / status.totalSteps) * 100,
  );

  function openStep(
    id: keyof OnboardingMilestones,
    target: FirstDayTarget,
  ) {
    if (id === "minerInstalled") {
      onOpenStarterRack();
      return;
    }
    if (id === "energyOnline" && batteryCount > 0) {
      onActivateEnergy();
      return;
    }
    onNavigate(target);
  }

  const nextStepLabel =
    nextStep.id === "energyOnline" && batteryCount > 0
      ? english ? "Power the room" : "Ative a sala"
      : english ? nextStep.labelEn : nextStep.label;
  const nextStepShort =
    nextStep.id === "energyOnline" && batteryCount > 0
      ? english ? "Use the battery you earned" : "Use agora a bateria conquistada"
      : english ? nextStep.shortEn : nextStep.short;

  return (
    <section className="first-day-panel" aria-labelledby="first-day-title">
      <div className="first-day-kit-art" aria-hidden="true">
        <img className="first-day-rack" src={assetsManifest.rackBasic.path} alt="" />
        <img className="first-day-miner" src={assetsManifest.minerOne.path} alt="" />
      </div>

      <div className="first-day-copy">
        <span>{english ? "FIRST DAY · OPERATOR KIT" : "PRIMEIRO DIA · KIT DO OPERADOR"}</span>
        <h2 id="first-day-title">{english ? "Your first operation is ready" : "Sua primeira operação já pode começar"}</h2>
        <p>
          {english
            ? "The server delivered only a rack and Byte Spark. Complete the three minigames, claim the battery in the Operator Center, and use it before competing for your first block."
            : "O servidor entregou somente um rack e um Byte Spark. Para ligar a sala, conclua os três minigames, resgate a bateria na Central do Operador e use-a antes de disputar seu primeiro bloco."}
        </p>
        <div className="first-day-progress">
          <div>
            <strong>{status.completedCount} {english ? "of" : "de"} {status.totalSteps} {english ? "steps" : "etapas"}</strong>
            <span>{progress}% {english ? "complete" : "concluído"}</span>
          </div>
          <i aria-hidden="true">
            <em style={{ width: `${progress}%` }} />
          </i>
        </div>
      </div>

      <div className="first-day-next">
        <span>{english ? "NEXT ACTION" : "PRÓXIMA AÇÃO"}</span>
        <strong>{nextStepLabel}</strong>
        <small>{nextStepShort}</small>
        {/* Compatibilidade com leitores e snapshots antigos: Continuar: ${nextStepLabel} */}
        <button
          type="button"
          aria-label={`${english ? "Continue" : "Continuar"}: ${nextStepLabel}`}
          onClick={() => openStep(nextStep.id, nextStep.target)}
        >
          {english ? "CONTINUE" : "CONTINUAR"}
        </button>
      </div>

      <ol className="first-day-steps">
        {stepDefinitions.map((step, index) => {
          const complete = status.milestones[step.id];
          const current = step.id === nextStep.id;
          return (
            <li
              className={`${complete ? "complete" : ""} ${current ? "current" : ""}`}
              key={step.id}
            >
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => openStep(step.id, step.target)}
              >
                <b>{complete ? "✓" : index + 1}</b>
                <span>
                  <strong>{english ? step.labelEn : step.label}</strong>
                  <small>{english ? step.shortEn : step.short}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
