"use client";

/* eslint-disable @next/next/no-img-element */

import { assetsManifest } from "./assets.manifest";
import type {
  OnboardingMilestones,
  OnboardingStatus,
} from "./onboarding-rules";

type FirstDayTarget = "mine" | "pools" | "games" | "career";

type FirstDayPanelProps = {
  status: OnboardingStatus | null;
  onNavigate: (target: FirstDayTarget) => void;
  onOpenStarterRack: () => void;
};

const stepDefinitions: Array<{
  id: keyof OnboardingMilestones;
  label: string;
  short: string;
  target: FirstDayTarget;
}> = [
  {
    id: "kitDelivered",
    label: "Kit entregue",
    short: "Rack e Byte Spark, somente",
    target: "mine",
  },
  {
    id: "minerInstalled",
    label: "Instale o Byte Spark",
    short: "Abra o rack e escolha um slot",
    target: "mine",
  },
  {
    id: "arcadeCompleted",
    label: "Complete o Tour do Arcade",
    short: "Jogue os três minigames",
    target: "games",
  },
  {
    id: "energyOnline",
    label: "Conquiste energia",
    short: "Resgate a bateria do Tour e use-a",
    target: "career",
  },
  {
    id: "poolsConfirmed",
    label: "Confirme sua pool",
    short: "Salve a distribuição do poder",
    target: "pools",
  },
  {
    id: "firstBlockCredited",
    label: "Receba o primeiro bloco",
    short: "A recompensa será registrada",
    target: "pools",
  },
];

export function FirstDayPanel({
  status,
  onNavigate,
  onOpenStarterRack,
}: FirstDayPanelProps) {
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
    onNavigate(target);
  }

  return (
    <section className="first-day-panel" aria-labelledby="first-day-title">
      <div className="first-day-kit-art" aria-hidden="true">
        <img className="first-day-rack" src={assetsManifest.rackBasic.path} alt="" />
        <img className="first-day-miner" src={assetsManifest.minerOne.path} alt="" />
      </div>

      <div className="first-day-copy">
        <span>PRIMEIRO DIA · KIT DO OPERADOR</span>
        <h2 id="first-day-title">Sua primeira operação já pode começar</h2>
        <p>
          O servidor entregou somente um rack e um Byte Spark. Para ligar a
          sala, conclua os três minigames, resgate a bateria na Central do
          Operador e use-a antes de disputar seu primeiro bloco.
        </p>
        <div className="first-day-progress">
          <div>
            <strong>{status.completedCount} de {status.totalSteps} etapas</strong>
            <span>{progress}% concluído</span>
          </div>
          <i aria-hidden="true">
            <em style={{ width: `${progress}%` }} />
          </i>
        </div>
      </div>

      <div className="first-day-next">
        <span>PRÓXIMA AÇÃO</span>
        <strong>{nextStep.label}</strong>
        <small>{nextStep.short}</small>
        <button
          type="button"
          onClick={() => openStep(nextStep.id, nextStep.target)}
        >
          CONTINUAR
        </button>
      </div>

      <ol className="first-day-steps">
        {stepDefinitions.map((step, index) => {
          const complete = status.milestones[step.id];
          return (
            <li className={complete ? "complete" : ""} key={step.id}>
              <button
                type="button"
                onClick={() => openStep(step.id, step.target)}
              >
                <b>{complete ? "✓" : index + 1}</b>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.short}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
