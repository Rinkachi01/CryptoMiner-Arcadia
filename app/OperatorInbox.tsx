"use client";

import { useEffect, useMemo, useState } from "react";
import type { PoolAllocations } from "./game-server";
import type { OnboardingStatus } from "./onboarding-rules";
import { useArcadiaLanguage } from "./i18n";

type GuideTarget = "mine" | "pools" | "inventory" | "games" | "career";

type GamesSummary = {
  totals?: {
    totalPlays?: number;
  };
};

type OperatorInboxProps = {
  energySeconds: number;
  batteryCount: number;
  rackCount: number;
  installedMinerCount: number;
  poolAllocations: PoolAllocations;
  secondsLeft: number;
  onboarding: OnboardingStatus | null;
  refreshKey: number;
  onNavigate: (target: GuideTarget) => void;
};

export function OperatorInbox({
  energySeconds,
  batteryCount,
  rackCount,
  installedMinerCount,
  poolAllocations,
  secondsLeft,
  onboarding,
  refreshKey,
  onNavigate,
}: OperatorInboxProps) {
  const { locale } = useArcadiaLanguage();
  const english = locale !== "pt-BR";
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<GamesSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/games/summary", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        setSummary((await response.json()) as GamesSummary);
      })
      .catch(() => {
        // O guia continua funcional com os dados da conta principal.
      });
    return () => controller.abort();
  }, [refreshKey]);

  const totalAllocation =
    poolAllocations.cma +
    poolAllocations.btc +
    poolAllocations.doge +
    poolAllocations.ltc;
  const totalPlays = Math.max(0, Number(summary?.totals?.totalPlays ?? 0));

  const steps = [
    ...(onboarding?.eligible
      ? [
          {
            id: "kit",
            label: english ? "Receive your starter kit" : "Receba seu kit inicial",
            detail: english ? "Only the rack and Byte Spark are registered" : "Somente rack e Byte Spark registrados",
            complete: onboarding.milestones.kitDelivered,
            target: "mine" as const,
          },
        ]
      : []),
    ...(!onboarding?.eligible
      ? [
          {
            id: "rack",
            label: english ? "Install your first rack" : "Instale seu primeiro rack",
            detail:
              rackCount > 0 ? `${rackCount} rack(s) ${english ? "installed" : "instalado(s)"}` : english ? "Open the room" : "Abra a sala",
            complete: rackCount > 0,
            target: "mine" as const,
          },
        ]
      : []),
    {
      id: "miner",
      label: english ? "Equip a miner" : "Equipe um minerador",
      detail:
        installedMinerCount > 0
          ? `${installedMinerCount} ${english ? "equipment item(s) operating" : "equipamento(s) operando"}`
          : english ? "Choose a rack slot" : "Escolha um slot do rack",
      complete: onboarding?.eligible
        ? onboarding.milestones.minerInstalled
        : installedMinerCount > 0,
      target: "inventory" as const,
    },
    {
      id: "arcade",
      label: onboarding?.eligible
        ? english ? "Complete the Arcade Tour" : "Complete o Tour do Arcade"
        : english ? "Complete a minigame" : "Conclua um minigame",
      detail: onboarding?.eligible
        ? english ? "Play Packet Catch, Hash Match and Circuit Rush" : "Jogue Packet Catch, Hash Match e Circuit Rush"
        : totalPlays > 0
          ? `${totalPlays} ${english ? "game(s) recorded" : "partida(s) registrada(s)"}`
          : english ? "Visit the Arcade" : "Visite o Arcade",
      complete: onboarding?.eligible
        ? onboarding.milestones.arcadeCompleted
        : totalPlays > 0,
      target: "games" as const,
    },
    {
      id: "energy",
      label: onboarding?.eligible
        ? english ? "Earn and activate energy" : "Conquiste e ative energia"
        : english ? "Keep the room powered" : "Mantenha a sala energizada",
      detail:
        energySeconds > 0
          ? english ? "Energy active" : "Energia ativa"
          : onboarding?.eligible
            ? english ? "Claim the Tour battery in the Operator Center" : "Resgate a bateria do Tour na Central do Operador"
            : english ? "Use or claim a battery" : "Use ou resgate uma bateria",
      complete: onboarding?.eligible
        ? onboarding.milestones.energyOnline
        : energySeconds > 0,
      target: onboarding?.eligible ? ("career" as const) : ("mine" as const),
    },
    {
      id: "pools",
      label: english ? "Distribute 100% of your power" : "Distribua 100% do poder",
      detail:
        totalAllocation === 100
          ? `${poolAllocations.cma}% CMA · ${poolAllocations.btc}% BTC · ${poolAllocations.doge}% DOGE · ${poolAllocations.ltc}% LTC`
          : `${totalAllocation}% ${english ? "distributed" : "distribuído"}`,
      complete: onboarding?.eligible
        ? onboarding.milestones.poolsConfirmed
        : totalAllocation === 100,
      target: "pools" as const,
    },
    ...(onboarding?.eligible
      ? [
          {
            id: "first-block",
            label: english ? "Receive your first block" : "Receba seu primeiro bloco",
            detail: onboarding.milestones.firstBlockCredited
              ? english ? "Reward recorded in your history" : "Recompensa registrada no histórico"
              : english ? "Keep energy and power active" : "Mantenha energia e poder ativos",
            complete: onboarding.milestones.firstBlockCredited,
            target: "pools" as const,
          },
        ]
      : []),
  ];
  const completedSteps = steps.filter((step) => step.complete).length;

  const notifications = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      detail: string;
      target: GuideTarget;
      severity: "attention" | "good" | "info";
    }> = [];
    if (energySeconds <= 0) {
      items.push({
        id: "energy-empty",
        label: english ? "Mining paused" : "Mineração pausada",
        detail: onboarding?.eligible
          ? english ? "Complete the Arcade Tour to earn your first battery." : "Complete o Tour do Arcade para conquistar sua primeira bateria."
          : english ? "Your energy is empty. Use a battery to resume production." : "Sua energia acabou. Use uma bateria para voltar a produzir.",
        target: onboarding?.eligible ? "games" : "mine",
        severity: "attention",
      });
    } else if (energySeconds <= 3 * 60 * 60) {
      items.push({
        id: "energy-low",
        label: english ? "Energy below 3 hours" : "Energia abaixo de 3 horas",
        detail: `${batteryCount} ${english ? "battery(ies) available in inventory." : "bateria(s) disponível(is) no inventário."}`,
        target: "mine",
        severity: "attention",
      });
    }
    if (installedMinerCount === 0) {
      items.push({
        id: "no-miner",
        label: english ? "No miner installed" : "Nenhum minerador instalado",
        detail: english ? "Open Inventory and choose equipment for the rack." : "Abra o inventário e escolha um equipamento para o rack.",
        target: "inventory",
        severity: "attention",
      });
    }
    if (secondsLeft <= 60) {
      items.push({
        id: "block",
        label: english ? "Block closing soon" : "Bloco quase fechado",
        detail: english ? "Less than one minute until the next settlement." : "Menos de um minuto para o próximo processamento.",
        target: "pools",
        severity: "info",
      });
    }
    return items;
  }, [
    batteryCount,
    energySeconds,
    english,
    installedMinerCount,
    onboarding?.eligible,
    secondsLeft,
  ]);

  function navigate(target: GuideTarget) {
    setOpen(false);
    onNavigate(target);
  }

  return (
    <>
      <button
        className="operator-inbox-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="operator-inbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span>!</span>
        <b>{notifications.length}</b>
        <small>{english ? "GUIDE & ALERTS" : "GUIA E AVISOS"}</small>
      </button>

      {open && (
        <aside
          className="operator-inbox"
          id="operator-inbox"
          role="dialog"
          aria-modal="false"
          aria-label={english ? "Account guide and alerts" : "Guia e avisos da conta"}
        >
          <header>
            <div>
              <span>{english ? "OPERATOR CENTER" : "CENTRAL DO OPERADOR"}</span>
              <strong>{english ? "Next steps" : "Próximos passos"}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              {english ? "CLOSE" : "FECHAR"}
            </button>
          </header>

          <section className="operator-guide-progress">
            <div>
              <span>{english ? "ACCOUNT SETUP" : "CONFIGURAÇÃO DA CONTA"}</span>
              <strong>{completedSteps} / {steps.length}</strong>
            </div>
            <i>
              <em style={{ width: `${(completedSteps / steps.length) * 100}%` }} />
            </i>
          </section>

          <section className="operator-guide-steps">
            {steps.map((step, index) => (
              <button
                className={step.complete ? "complete" : ""}
                type="button"
                key={step.id}
                onClick={() => navigate(step.target)}
              >
                <b>{step.complete ? "✓" : String(index + 1).padStart(2, "0")}</b>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
                <em>{english ? "OPEN" : "ABRIR"}</em>
              </button>
            ))}
          </section>

          <section className="operator-live-alerts">
            <div>
              <span>{english ? "NOW" : "AGORA"}</span>
              <strong>{notifications.length} {english ? "useful alert(s)" : "aviso(s) útil(eis)"}</strong>
            </div>
            {notifications.length === 0 ? (
              <p>{english ? "Account is organized. No urgent action right now." : "Conta organizada. Nenhuma ação urgente neste momento."}</p>
            ) : (
              notifications.map((item) => (
                <button
                  className={item.severity}
                  type="button"
                  key={item.id}
                  onClick={() => navigate(item.target)}
                >
                  <i />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </button>
              ))
            )}
          </section>
        </aside>
      )}
    </>
  );
}
