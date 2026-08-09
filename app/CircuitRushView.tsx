"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArcadeStartNotice } from "./ArcadeStartNotice";
import { describeArcadeStart } from "./arcade-start-rules";
import type { CircuitEvent, CircuitStep } from "./circuit-rush-rules";
import { GameSubmissionOverlay } from "./GameSubmissionOverlay";

type Limits = { hourRemaining: number; dayRemaining: number };
type CircuitSession = {
  sessionId: string;
  nonce: string;
  difficulty: number;
  durationMs: number;
  steps: CircuitStep[];
};

export function CircuitRushView({
  onRefreshAccount,
}: {
  onRefreshAccount: () => Promise<boolean>;
}) {
  const [phase, setPhase] = useState<
    "idle" | "loading" | "playing" | "finishing" | "result"
  >("idle");
  const [difficulty, setDifficulty] = useState(1);
  const [nextPlayAt, setNextPlayAt] = useState(0);
  const [clockNow, setClockNow] = useState(0);
  const [limits, setLimits] = useState<Limits>({
    hourRemaining: 6,
    dayRemaining: 18,
  });
  const [session, setSession] = useState<CircuitSession | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState(
    "Siga o pulso verde e não toque nos circuitos vermelhos.",
  );
  const [reward, setReward] = useState(0);
  const localStartedAt = useRef(0);
  const eventsRef = useRef<CircuitEvent[]>([]);
  const finishStarted = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch("/api/games/circuit-rush", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          serverTime?: number;
          difficulty?: number;
          nextPlayAt?: number;
          limits?: Limits;
        };
        if (!response.ok) return;
        setClockNow(data.serverTime ?? 0);
        setDifficulty(data.difficulty ?? 1);
        setNextPlayAt(data.nextPlayAt ?? 0);
        if (data.limits) setLimits(data.limits);
      })
      .catch(() => setMessage("O painel será atualizado ao iniciar."));
  }, []);

  const finishGame = useCallback(
    async (
      activeSession: CircuitSession,
      outcome: "complete" | "failed" | "timeout",
      events: CircuitEvent[],
      durationMs: number,
    ) => {
      if (finishStarted.current) return;
      finishStarted.current = true;
      setPhase("finishing");
      const submissionStartedAt = performance.now();
      try {
        const response = await fetch("/api/games/circuit-rush", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finish",
            sessionId: activeSession.sessionId,
            nonce: activeSession.nonce,
            outcome,
            events,
            durationMs,
          }),
        });
        const data = (await response.json()) as {
          rewardPowerGh?: number;
          nextDifficulty?: number;
          nextPlayAt?: number;
          limits?: Limits;
          message?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Circuito recusado.");
        setReward(data.rewardPowerGh ?? 0);
        setDifficulty(data.nextDifficulty ?? activeSession.difficulty);
        setNextPlayAt(data.nextPlayAt ?? 0);
        if (data.limits) setLimits(data.limits);
        setMessage(data.message ?? "Circuito processado.");
        await onRefreshAccount();
      } catch (error) {
        setReward(0);
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível validar o circuito.",
        );
      } finally {
        await new Promise((resolve) =>
          window.setTimeout(
            resolve,
            Math.max(0, 720 - (performance.now() - submissionStartedAt)),
          ),
        );
        setPhase("result");
      }
    },
    [onRefreshAccount],
  );

  useEffect(() => {
    if (phase !== "playing" || !session) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - localStartedAt.current;
      setElapsedMs(Math.min(elapsed, session.durationMs));
      if (elapsed >= session.durationMs) {
        void finishGame(
          session,
          "timeout",
          eventsRef.current,
          session.durationMs,
        );
      }
    }, 70);
    return () => window.clearInterval(timer);
  }, [finishGame, phase, session]);

  async function startGame() {
    setPhase("loading");
    setMessage("Sincronizando o circuito...");
    setReward(0);
    try {
      const response = await fetch("/api/games/circuit-rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await response.json()) as CircuitSession & {
        nextPlayAt?: number;
        limits?: Limits;
        error?: string;
      };
      if (!response.ok) {
        if (data.nextPlayAt) setNextPlayAt(data.nextPlayAt);
        throw new Error(data.error ?? "Circuit Rush indisponível.");
      }
      setSession(data);
      setDifficulty(data.difficulty);
      setStepIndex(0);
      setElapsedMs(0);
      eventsRef.current = [];
      finishStarted.current = false;
      localStartedAt.current = Date.now();
      if (data.limits) setLimits(data.limits);
      setMessage("Clique no núcleo verde. Vermelho encerra a partida.");
      setPhase("playing");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar.",
      );
      setPhase("idle");
    }
  }

  function chooseCell(cell: number) {
    if (!session || phase !== "playing") return;
    const step = session.steps[stepIndex];
    if (!step) return;
    const lastEventAt = eventsRef.current.at(-1)?.atMs ?? -1_000;
    const event = {
      stepId: step.id,
      cell,
      atMs: Math.max(Math.floor(elapsedMs), lastEventAt + 90),
    };
    const nextEvents = [...eventsRef.current, event];
    eventsRef.current = nextEvents;

    if (cell !== step.targetCell) {
      setMessage("Circuito vermelho atingido. Corrida encerrada.");
      void finishGame(session, "failed", nextEvents, event.atMs);
      return;
    }

    if (stepIndex + 1 >= session.steps.length) {
      setMessage("Sequência concluída. Validando velocidade...");
      void finishGame(session, "complete", nextEvents, event.atMs);
      return;
    }
    setStepIndex((current) => current + 1);
  }

  const activeStep = session?.steps[stepIndex];
  const cooldownSeconds = Math.max(
    0,
    Math.ceil((nextPlayAt - clockNow) / 1000),
  );
  const secondsLeft = Math.max(
    0,
    Math.ceil(((session?.durationMs ?? 29_000) - elapsedMs) / 1000),
  );
  const startState = describeArcadeStart({
    cooldownSeconds,
    limits,
    loading: phase === "loading",
    loadingLabel: "SINCRONIZANDO...",
    readyLabel: "INICIAR CIRCUIT RUSH",
  });

  return (
    <section className="circuit-rush-shell">
      <header>
        <div>
          <span>MINIGAME 03 · REFLEXO</span>
          <h3>Circuit Rush</h3>
          <p>Complete a sequência antes do tempo sem tocar nos bloqueios.</p>
        </div>
        <div className="hash-status">
          <span>
            NÍVEL <strong>{difficulty}</strong>
          </span>
          <span>
            PULSOS{" "}
            <strong>
              {stepIndex}/{session?.steps.length ?? "—"}
            </strong>
          </span>
          <span>
            TEMPO <strong>{phase === "playing" ? secondsLeft : "—"}</strong>
          </span>
        </div>
      </header>

      <div className="circuit-rush-layout">
        <div className="circuit-board" aria-label="Tabuleiro de Circuit Rush">
          {Array.from({ length: 16 }, (_, cell) => {
            const target = activeStep?.targetCell === cell;
            const decoy = activeStep?.decoyCells.includes(cell);
            return (
              <button
                type="button"
                className={`${target ? "target" : ""} ${decoy ? "decoy" : ""}`}
                onPointerDown={() => chooseCell(cell)}
                disabled={phase !== "playing" || (!target && !decoy)}
                aria-label={
                  target
                    ? "Núcleo verde: clique"
                    : decoy
                      ? "Circuito vermelho: não clique"
                      : "Circuito inativo"
                }
                key={cell}
              >
                <i />
                <span>{String(cell + 1).padStart(2, "0")}</span>
              </button>
            );
          })}

          {phase === "finishing" && (
            <GameSubmissionOverlay gameLabel="Circuit Rush" />
          )}

          {phase !== "playing" && phase !== "finishing" && (
            <div className="circuit-board-cover">
              <span>ROTA DE REAÇÃO</span>
              <strong>{reward > 0 ? `+${reward} GH/s` : "Circuit Rush"}</strong>
              <p>{message}</p>
              <ArcadeStartNotice state={startState} />
              <button
                type="button"
                onClick={startGame}
                disabled={startState.disabled}
              >
                {startState.label}
              </button>
            </div>
          )}
        </div>

        <aside>
          <span>COMO FUNCIONA</span>
          <h4>Verde avança</h4>
          <ul>
            <li>Toque apenas no núcleo verde pulsante.</li>
            <li>Qualquer circuito vermelho encerra a rodada.</li>
            <li>Mais bloqueios aparecem nos níveis altos.</li>
            <li>A velocidade é conferida pelo servidor.</li>
          </ul>
          <div className="packet-message" role="status" aria-live="polite">
            {message}
          </div>
          <small>
            {limits.dayRemaining} corridas disponíveis nas últimas 24h.
          </small>
        </aside>
      </div>
    </section>
  );
}
