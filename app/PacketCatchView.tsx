"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { CircuitRushView } from "./CircuitRushView";
import { gameCoins } from "./game-coin-catalog";
import { GameSubmissionOverlay } from "./GameSubmissionOverlay";
import { HashMatchView } from "./HashMatchView";
import {
  PACKET_CATCH_STARTING_LIVES,
  type PacketCatchEvent,
  type PacketTarget,
} from "./packet-catch-rules";

type Phase = "idle" | "loading" | "playing" | "finishing" | "result";
type Limits = { hourRemaining: number; dayRemaining: number };
type GameSession = {
  sessionId: string;
  nonce: string;
  durationMs: number;
  difficulty: number;
  targets: PacketTarget[];
};

function formatPower(powerGh: number) {
  if (powerGh >= 1000) {
    return `${(powerGh / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} TH/s`;
  }
  return `${powerGh.toLocaleString("pt-BR")} GH/s`;
}

export function PacketCatchView({
  temporaryPowerGh,
  onRefreshAccount,
}: {
  temporaryPowerGh: number;
  onRefreshAccount: () => Promise<boolean>;
}) {
  const [activeGame, setActiveGame] = useState<
    "packet" | "hash" | "circuit"
  >("packet");
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<GameSession | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [clickedIds, setClickedIds] = useState<string[]>([]);
  const [lives, setLives] = useState(PACKET_CATCH_STARTING_LIVES);
  const [events, setEvents] = useState<PacketCatchEvent[]>([]);
  const [message, setMessage] = useState(
    "Capture as moedas e nunca clique na bomba.",
  );
  const [limits, setLimits] = useState<Limits>({
    hourRemaining: 8,
    dayRemaining: 24,
  });
  const [difficulty, setDifficulty] = useState(1);
  const [nextPlayAt, setNextPlayAt] = useState(0);
  const [clockNow, setClockNow] = useState(0);
  const [result, setResult] = useState<{
    outcome: "completed" | "bomb" | "lives";
    score: number;
    rewardPowerGh: number;
  } | null>(null);
  const localStartedAt = useRef(0);
  const eventsRef = useRef<PacketCatchEvent[]>([]);
  const finishStarted = useRef(false);
  const missedIdsRef = useRef(new Set<string>());

  const refreshArcadeAccount = useCallback(async () => {
    const refreshed = await onRefreshAccount();
    return refreshed;
  }, [onRefreshAccount]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch("/api/games/packet-catch", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          serverTime?: number;
          limits?: Limits;
          difficulty?: number;
          nextPlayAt?: number;
        };
        if (!response.ok) return;
        setClockNow(data.serverTime ?? 0);
        if (data.limits) setLimits(data.limits);
        setDifficulty(data.difficulty ?? 1);
        setNextPlayAt(data.nextPlayAt ?? 0);
      })
      .catch(() => {
        setMessage("O painel de partidas será atualizado ao iniciar.");
      });
  }, []);

  const finishGame = useCallback(
    async (
      activeSession: GameSession,
      endReason: "complete" | "bomb" | "lives",
      finalEvents: PacketCatchEvent[],
      durationMs: number,
    ) => {
      if (finishStarted.current) return;
      finishStarted.current = true;
      setPhase("finishing");
      const submissionStartedAt = performance.now();
      try {
        const response = await fetch("/api/games/packet-catch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finish",
            sessionId: activeSession.sessionId,
            nonce: activeSession.nonce,
            durationMs,
            endReason,
            events: finalEvents,
          }),
        });
        const data = (await response.json()) as {
          outcome?: "completed" | "bomb" | "lives";
          score?: number;
          rewardPowerGh?: number;
          nextDifficulty?: number;
          nextPlayAt?: number;
          limits?: Limits;
          message?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Partida não validada.");
        setResult({
          outcome: data.outcome ?? "completed",
          score: data.score ?? 0,
          rewardPowerGh: data.rewardPowerGh ?? 0,
        });
        setDifficulty(data.nextDifficulty ?? activeSession.difficulty);
        setNextPlayAt(data.nextPlayAt ?? 0);
        if (data.limits) setLimits(data.limits);
        setMessage(data.message ?? "Partida validada pelo servidor.");
        await refreshArcadeAccount();
        await new Promise((resolve) =>
          window.setTimeout(
            resolve,
            Math.max(0, 720 - (performance.now() - submissionStartedAt)),
          ),
        );
        setPhase("result");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível encerrar a partida.",
        );
        await new Promise((resolve) =>
          window.setTimeout(
            resolve,
            Math.max(0, 720 - (performance.now() - submissionStartedAt)),
          ),
        );
        setPhase("result");
      }
    },
    [refreshArcadeAccount],
  );

  useEffect(() => {
    if (phase !== "playing" || !session) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - localStartedAt.current;
      setElapsedMs(Math.min(elapsed, session.durationMs));
      const caughtIds = new Set(
        eventsRef.current.map((event) => event.targetId),
      );
      const newlyMissed = session.targets
        .filter(
          (target) =>
            target.kind === "coin" &&
            target.appearsAtMs + target.lifetimeMs <= elapsed &&
            !caughtIds.has(target.id) &&
            !missedIdsRef.current.has(target.id),
        )
        .sort(
          (first, second) =>
            first.appearsAtMs +
            first.lifetimeMs -
            (second.appearsAtMs + second.lifetimeMs),
        );
      for (const target of newlyMissed) {
        missedIdsRef.current.add(target.id);
      }
      if (newlyMissed.length > 0) {
        const remainingLives = Math.max(
          0,
          PACKET_CATCH_STARTING_LIVES - missedIdsRef.current.size,
        );
        setLives(remainingLives);
        if (remainingLives > 0) {
          setMessage(
            `Moeda perdida. ${remainingLives} ${
              remainingLives === 1 ? "vida restante" : "vidas restantes"
            }.`,
          );
        } else {
          const thirdMiss = session.targets
            .filter((target) => missedIdsRef.current.has(target.id))
            .sort(
              (first, second) =>
                first.appearsAtMs +
                first.lifetimeMs -
                (second.appearsAtMs + second.lifetimeMs),
            )[PACKET_CATCH_STARTING_LIVES - 1];
          setMessage("Três moedas tocaram o chão. Rodada encerrada.");
          void finishGame(
            session,
            "lives",
            eventsRef.current,
            thirdMiss
              ? thirdMiss.appearsAtMs + thirdMiss.lifetimeMs
              : Math.floor(elapsed),
          );
          return;
        }
      }
      if (elapsed >= session.durationMs) {
        void finishGame(
          session,
          "complete",
          eventsRef.current,
          session.durationMs,
        );
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [finishGame, phase, session]);

  async function startGame() {
    setPhase("loading");
    setMessage("Criando uma sessão segura...");
    setResult(null);
    try {
      const response = await fetch("/api/games/packet-catch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await response.json()) as GameSession & {
        limits?: Limits;
        nextPlayAt?: number;
        error?: string;
      };
      if (!response.ok) {
        if (data.nextPlayAt) setNextPlayAt(data.nextPlayAt);
        throw new Error(data.error ?? "Partida indisponível.");
      }
      eventsRef.current = [];
      setEvents([]);
      finishStarted.current = false;
      setClickedIds([]);
      setLives(PACKET_CATCH_STARTING_LIVES);
      missedIdsRef.current = new Set();
      setElapsedMs(0);
      setSession(data);
      setDifficulty(data.difficulty);
      if (data.limits) setLimits(data.limits);
      localStartedAt.current = Date.now();
      setMessage("Clique nas moedas. Uma bomba encerra tudo.");
      setPhase("playing");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar.",
      );
      setPhase("idle");
    }
  }

  function catchTarget(target: PacketTarget) {
    if (
      !session ||
      phase !== "playing" ||
      clickedIds.includes(target.id)
    ) {
      return;
    }
    const event = { targetId: target.id, atMs: Math.floor(elapsedMs) };
    const nextEvents = [...eventsRef.current, event];
    eventsRef.current = nextEvents;
    setEvents((current) => [...current, event]);
    setClickedIds((current) => [...current, target.id]);
    if (target.kind === "bomb") {
      setMessage("Bomba atingida. A partida foi perdida.");
      void finishGame(session, "bomb", nextEvents, event.atMs);
    }
  }

  const liveScore = session
    ? events.reduce((total, gameEvent) => {
        const target = session.targets.find(
          (item) => item.id === gameEvent.targetId,
        );
        return target?.kind === "coin" ? total + target.points : 0;
      }, 0)
    : 0;
  const activeTargets =
    session?.targets.filter(
      (target) =>
        !clickedIds.includes(target.id) &&
        elapsedMs >= target.appearsAtMs &&
        elapsedMs <= target.appearsAtMs + target.lifetimeMs,
    ) ?? [];
  const cooldownSeconds = Math.max(
    0,
    Math.ceil((nextPlayAt - clockNow) / 1000),
  );

  return (
    <section className="games-view">
      <div className="games-hero live">
        <div>
          <span className="eyebrow">ARCADE ARCADIA · DIFICULDADE PROGRESSIVA</span>
          <h2>Minigames de mineração</h2>
          <p>
            Vença para avançar de nível. A dificuldade e a recarga crescem com
            a atividade, e toda recompensa continua validada no servidor.
          </p>
        </div>
        <div className="games-balance-seal live">
          <strong>{formatPower(temporaryPowerGh)}</strong>
          <span>PODER TEMPORÁRIO ATIVO</span>
          <small>Packet Catch + Hash Match</small>
        </div>
      </div>

      <div className="games-hub-body">
        <nav className="game-selector-list" aria-label="Lista de minigames">
          <button
            type="button"
            className={activeGame === "packet" ? "active packet" : "packet"}
            onClick={() => setActiveGame("packet")}
            aria-pressed={activeGame === "packet"}
          >
            <span>01</span>
            <strong>Packet Catch</strong>
            <small>Capture moedas e evite bombas</small>
            <b>ONLINE</b>
          </button>
          <button
            type="button"
            className={activeGame === "hash" ? "active hash" : "hash"}
            onClick={() => setActiveGame("hash")}
            aria-pressed={activeGame === "hash"}
          >
            <span>02</span>
            <strong>Hash Match</strong>
            <small>Encontre os pares de moedas</small>
            <b>ONLINE</b>
          </button>
          <button
            type="button"
            className={
              activeGame === "circuit" ? "active circuit" : "circuit"
            }
            onClick={() => setActiveGame("circuit")}
            aria-pressed={activeGame === "circuit"}
          >
            <span>03</span>
            <strong>Circuit Rush</strong>
            <small>Siga o pulso e evite bloqueios</small>
            <b>NOVO</b>
          </button>
        </nav>

        <div className="active-game-stage">
          {activeGame === "packet" && (
            <div className="packet-catch-shell">
        <header>
          <div>
            <span>MINIGAME 01 · CAÇA-MOEDAS</span>
            <h3>Packet Catch</h3>
          </div>
          <div className="packet-game-stats">
            <span>
              NÍVEL <strong>{session?.difficulty ?? difficulty}</strong>
            </span>
            <span>
              PONTOS <strong>{result?.score ?? liveScore}</strong>
            </span>
            <span>
              TEMPO{" "}
              <strong>
                {Math.max(
                  0,
                  Math.ceil(
                    ((session?.durationMs ?? 30_000) - elapsedMs) / 1000,
                  ),
                )}
                s
              </strong>
            </span>
            <span className="packet-lives">
              VIDAS{" "}
              <strong aria-label={`${lives} vidas restantes`}>
                {Array.from(
                  { length: PACKET_CATCH_STARTING_LIVES },
                  (_, index) => (
                    <i className={index < lives ? "active" : ""} key={index}>
                      ♥
                    </i>
                  ),
                )}
              </strong>
            </span>
          </div>
        </header>

        <div className="packet-game-layout">
          <div className="packet-board coin-rain" aria-label="Área do Packet Catch">
            <div className="packet-ground" aria-hidden="true">
              LINHA DE PERDA
            </div>
            {Array.from({ length: 5 }, (_, lane) => (
              <i
                className="packet-lane"
                style={{ left: `${lane * 20}%` }}
                key={lane}
              />
            ))}
            {activeTargets.map((target) => {
              const progress =
                (elapsedMs - target.appearsAtMs) / target.lifetimeMs;
              return (
                <button
                  type="button"
                  className={`falling-target ${target.kind}`}
                  style={{
                    left: `${target.lane * 20 + 4}%`,
                    top: `${3 + progress * 80}%`,
                  }}
                  onPointerDown={() => catchTarget(target)}
                  key={target.id}
                  aria-label={
                    target.kind === "bomb"
                      ? "Bomba: não clique"
                      : `Capturar ${target.symbol}, ${target.points} pontos`
                  }
                >
                  {target.kind === "coin" && target.asset ? (
                    <>
                      <img src={target.asset} alt="" />
                      <b>+{target.points}</b>
                    </>
                  ) : (
                    <span className="bomb-sprite" aria-hidden="true">
                      <i />
                    </span>
                  )}
                </button>
              );
            })}
            {phase !== "playing" && phase !== "finishing" && (
              <div className="packet-board-cover">
                <span>CHUVA DE MOEDAS · NÍVEL {difficulty}</span>
                <strong>
                  {result?.outcome === "bomb"
                    ? "Bomba atingida"
                    : result?.outcome === "lives"
                      ? "Vidas esgotadas"
                    : result?.rewardPowerGh
                      ? `+${result.rewardPowerGh} GH/s`
                      : "Capture as moedas"}
                </strong>
                <p>{message}</p>
                <button
                  type="button"
                  onClick={startGame}
                  disabled={
                    phase === "loading" ||
                    cooldownSeconds > 0 ||
                    limits.hourRemaining === 0 ||
                    limits.dayRemaining === 0
                  }
                >
                  {phase === "loading"
                    ? "CONECTANDO..."
                    : cooldownSeconds > 0
                      ? `RECARGA ${cooldownSeconds}s`
                      : "INICIAR PARTIDA"}
                </button>
              </div>
            )}
            {phase === "finishing" && (
              <GameSubmissionOverlay gameLabel="Packet Catch" />
            )}
          </div>

          <aside className="packet-rules-panel coin-values-panel">
            <span>VALOR DAS MOEDAS</span>
            <h4>Cada clique conta</h4>
            <div className="coin-points-grid">
              {gameCoins.map((coin) => (
                <div key={coin.id}>
                  <img src={coin.asset} alt="" />
                  <span>{coin.symbol}</span>
                  <b>+{coin.points}</b>
                </div>
              ))}
            </div>
            <div className="bomb-warning">
              <span className="bomb-sprite small" aria-hidden="true">
                <i />
              </span>
              <p>
                <strong>BOMBA</strong>
                encerra a partida sem pontos e sem poder
              </p>
            </div>
            <div className="life-warning">
              <strong>3 VIDAS</strong>
              <p>Cada moeda que tocar o chão remove uma vida.</p>
            </div>
            <div className="packet-message" role="status" aria-live="polite">
              {message}
            </div>
            <small>
              {limits.dayRemaining} partidas disponíveis nas últimas 24h.
            </small>
          </aside>
        </div>
            </div>
          )}

          {activeGame === "hash" && (
            <HashMatchView onRefreshAccount={refreshArcadeAccount} />
          )}

          {activeGame === "circuit" && (
            <CircuitRushView onRefreshAccount={refreshArcadeAccount} />
          )}
        </div>
      </div>
    </section>
  );
}
