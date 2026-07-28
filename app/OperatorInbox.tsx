"use client";

import { useEffect, useMemo, useState } from "react";
import type { PoolAllocations } from "./game-server";
import type { OnboardingStatus } from "./onboarding-rules";

type GuideTarget = "mine" | "pools" | "inventory" | "games" | "career";

type GamesSummary = {
  totals?: {
    totalPlays?: number;
  };
  missions?: Array<{
    id: string;
    claimable?: boolean;
  }>;
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
    poolAllocations.cma + poolAllocations.btc + poolAllocations.doge;
  const totalPlays = Math.max(0, Number(summary?.totals?.totalPlays ?? 0));
  const missionClaimable =
    summary?.missions?.some((mission) => mission.claimable === true) ?? false;

  const steps = [
    ...(onboarding?.eligible
      ? [
          {
            id: "kit",
            label: "Receba seu kit inicial",
            detail: "Somente rack e Byte Spark registrados",
            complete: onboarding.milestones.kitDelivered,
            target: "mine" as const,
          },
        ]
      : []),
    ...(!onboarding?.eligible
      ? [
          {
            id: "rack",
            label: "Instale seu primeiro rack",
            detail:
              rackCount > 0 ? `${rackCount} rack(s) instalado(s)` : "Abra a sala",
            complete: rackCount > 0,
            target: "mine" as const,
          },
        ]
      : []),
    {
      id: "miner",
      label: "Equipe um minerador",
      detail:
        installedMinerCount > 0
          ? `${installedMinerCount} equipamento(s) operando`
          : "Escolha um slot do rack",
      complete: onboarding?.eligible
        ? onboarding.milestones.minerInstalled
        : installedMinerCount > 0,
      target: "inventory" as const,
    },
    {
      id: "arcade",
      label: onboarding?.eligible
        ? "Complete o Tour do Arcade"
        : "Conclua um minigame",
      detail: onboarding?.eligible
        ? "Jogue Packet Catch, Hash Match e Circuit Rush"
        : totalPlays > 0
          ? `${totalPlays} partida(s) registrada(s)`
          : "Visite o Arcade",
      complete: onboarding?.eligible
        ? onboarding.milestones.arcadeCompleted
        : totalPlays > 0,
      target: "games" as const,
    },
    {
      id: "energy",
      label: onboarding?.eligible
        ? "Conquiste e ative energia"
        : "Mantenha a sala energizada",
      detail:
        energySeconds > 0
          ? "Energia ativa"
          : onboarding?.eligible
            ? "Resgate a bateria do Tour na Central do Operador"
            : "Use ou resgate uma bateria",
      complete: onboarding?.eligible
        ? onboarding.milestones.energyOnline
        : energySeconds > 0,
      target: onboarding?.eligible ? ("career" as const) : ("mine" as const),
    },
    {
      id: "pools",
      label: "Distribua 100% do poder",
      detail:
        totalAllocation === 100
          ? `${poolAllocations.cma}% CMA · ${poolAllocations.btc}% BTC · ${poolAllocations.doge}% DOGE`
          : `${totalAllocation}% distribuído`,
      complete: onboarding?.eligible
        ? onboarding.milestones.poolsConfirmed
        : totalAllocation === 100,
      target: "pools" as const,
    },
    ...(onboarding?.eligible
      ? [
          {
            id: "first-block",
            label: "Receba seu primeiro bloco",
            detail: onboarding.milestones.firstBlockCredited
              ? "Recompensa registrada no histórico"
              : "Mantenha energia e poder ativos",
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
        label: "Mineração pausada",
        detail: onboarding?.eligible
          ? "Complete o Tour do Arcade para conquistar sua primeira bateria."
          : "Sua energia acabou. Use uma bateria para voltar a produzir.",
        target: onboarding?.eligible ? "games" : "mine",
        severity: "attention",
      });
    } else if (energySeconds <= 3 * 60 * 60) {
      items.push({
        id: "energy-low",
        label: "Energia abaixo de 3 horas",
        detail: `${batteryCount} bateria(s) disponível(is) no inventário.`,
        target: "mine",
        severity: "attention",
      });
    }
    if (installedMinerCount === 0) {
      items.push({
        id: "no-miner",
        label: "Nenhum minerador instalado",
        detail: "Abra o inventário e escolha um equipamento para o rack.",
        target: "inventory",
        severity: "attention",
      });
    }
    if (missionClaimable) {
      items.push({
        id: "mission",
        label: "Bateria do Tour pronta",
        detail: "Sua missão diária está concluída e aguardando resgate.",
        target: "career",
        severity: "good",
      });
    }
    if (secondsLeft <= 60) {
      items.push({
        id: "block",
        label: "Bloco quase fechado",
        detail: "Menos de um minuto para o próximo processamento.",
        target: "pools",
        severity: "info",
      });
    }
    return items;
  }, [
    batteryCount,
    energySeconds,
    installedMinerCount,
    missionClaimable,
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
        <small>GUIA E AVISOS</small>
      </button>

      {open && (
        <aside
          className="operator-inbox"
          id="operator-inbox"
          role="dialog"
          aria-modal="false"
          aria-label="Guia e avisos da conta"
        >
          <header>
            <div>
              <span>CENTRAL DO OPERADOR</span>
              <strong>Próximos passos</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              FECHAR
            </button>
          </header>

          <section className="operator-guide-progress">
            <div>
              <span>CONFIGURAÇÃO DA CONTA</span>
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
                <em>ABRIR</em>
              </button>
            ))}
          </section>

          <section className="operator-live-alerts">
            <div>
              <span>AGORA</span>
              <strong>{notifications.length} aviso(s) útil(eis)</strong>
            </div>
            {notifications.length === 0 ? (
              <p>Conta organizada. Nenhuma ação urgente neste momento.</p>
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
