"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PACKET_CATCH_TARGET_LIFETIME_MS,
  type PacketCatchEvent,
  type PacketTarget,
} from "./packet-catch-rules";

type Phase = "idle" | "loading" | "playing" | "finishing" | "result";
type Limits = { hourRemaining: number; dayRemaining: number };
type GameSession = {
  sessionId: string;
  nonce: string;
  durationMs: number;
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<GameSession | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [clickedIds, setClickedIds] = useState<string[]>([]);
  const [events, setEvents] = useState<PacketCatchEvent[]>([]);
  const [message, setMessage] = useState(
    "Clique apenas nos pacotes azuis. Pacotes vermelhos retiram pontos.",
  );
  const [limits, setLimits] = useState<Limits>({
    hourRemaining: 5,
    dayRemaining: 15,
  });
  const [result, setResult] = useState<{
    score: number;
    rewardPowerGh: number;
  } | null>(null);
  const localStartedAt = useRef(0);
  const eventsRef = useRef<PacketCatchEvent[]>([]);
  const finishStarted = useRef(false);

  useEffect(() => {
    void fetch("/api/games/packet-catch", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          limits?: Limits;
        };
        if (response.ok && data.limits) setLimits(data.limits);
      })
      .catch(() => {
        setMessage("O painel de partidas será atualizado ao iniciar.");
      });
  }, []);

  const finishGame = useCallback(async (activeSession: GameSession) => {
    if (finishStarted.current) return;
    finishStarted.current = true;
    setPhase("finishing");
    try {
      const response = await fetch("/api/games/packet-catch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finish",
          sessionId: activeSession.sessionId,
          nonce: activeSession.nonce,
          durationMs: activeSession.durationMs,
          events: eventsRef.current,
        }),
      });
      const data = (await response.json()) as {
        score?: number;
        rewardPowerGh?: number;
        limits?: Limits;
        message?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Partida não validada.");
      setResult({
        score: data.score ?? 0,
        rewardPowerGh: data.rewardPowerGh ?? 0,
      });
      if (data.limits) setLimits(data.limits);
      setMessage(data.message ?? "Partida validada pelo servidor.");
      await onRefreshAccount();
      setPhase("result");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível encerrar a partida.",
      );
      setPhase("result");
    }
  }, [onRefreshAccount]);

  useEffect(() => {
    if (phase !== "playing" || !session) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - localStartedAt.current;
      setElapsedMs(Math.min(elapsed, session.durationMs));
      if (elapsed >= session.durationMs) void finishGame(session);
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
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Partida indisponível.");
      eventsRef.current = [];
      setEvents([]);
      finishStarted.current = false;
      setClickedIds([]);
      setElapsedMs(0);
      setSession(data);
      if (data.limits) setLimits(data.limits);
      localStartedAt.current = Date.now();
      setMessage("Capture os pacotes azuis e evite os vermelhos.");
      setPhase("playing");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar.",
      );
      setPhase("idle");
    }
  }

  function catchPacket(target: PacketTarget) {
    if (phase !== "playing" || clickedIds.includes(target.id)) return;
    const event = { targetId: target.id, atMs: Math.floor(elapsedMs) };
    eventsRef.current = [...eventsRef.current, event];
    setEvents((current) => [...current, event]);
    setClickedIds((current) => [...current, target.id]);
  }

  const liveScore = session
    ? Math.max(
        0,
        events.reduce((total, gameEvent) => {
          const target = session.targets.find(
            (item) => item.id === gameEvent.targetId,
          );
          return total + (target?.points ?? 0);
        }, 0),
      )
    : 0;
  const activeTargets =
    session?.targets.filter(
      (target) =>
        !clickedIds.includes(target.id) &&
        elapsedMs >= target.appearsAtMs &&
        elapsedMs <=
          target.appearsAtMs + PACKET_CATCH_TARGET_LIFETIME_MS,
    ) ?? [];

  return (
    <section className="games-view">
      <div className="games-hero live">
        <div>
          <span className="eyebrow">FASE 4 · PRIMEIRO JOGO AUTORITATIVO</span>
          <h2>Arcade de mineração</h2>
          <p>
            O Packet Catch já cria uma sessão única, valida cada clique e
            concede somente poder temporário. CMA e baterias continuam
            desativados até a medição de abuso e emissão.
          </p>
        </div>
        <div className="games-balance-seal live">
          <strong>{formatPower(temporaryPowerGh)}</strong>
          <span>PODER TEMPORÁRIO ATIVO</span>
          <small>expiração controlada no servidor</small>
        </div>
      </div>

      <div className="packet-catch-shell">
        <header>
          <div>
            <span>MINIGAME 01 · ONLINE</span>
            <h3>Packet Catch</h3>
          </div>
          <div className="packet-game-stats">
            <span>
              PONTOS <strong>{result?.score ?? liveScore}</strong>
            </span>
            <span>
              TEMPO{" "}
              <strong>
                {Math.max(
                  0,
                  Math.ceil(
                    ((session?.durationMs ?? 32_000) - elapsedMs) / 1000,
                  ),
                )}
                s
              </strong>
            </span>
            <span>
              RESTAM <strong>{limits.hourRemaining}/h</strong>
            </span>
          </div>
        </header>

        <div className="packet-game-layout">
          <div className="packet-board" aria-label="Área do Packet Catch">
            {Array.from({ length: 5 }, (_, lane) => (
              <i
                className="packet-lane"
                style={{ left: `${lane * 20}%` }}
                key={lane}
              />
            ))}
            {activeTargets.map((target) => {
              const progress =
                (elapsedMs - target.appearsAtMs) /
                PACKET_CATCH_TARGET_LIFETIME_MS;
              return (
                <button
                  type="button"
                  className={`packet-target ${target.kind}`}
                  style={{
                    left: `${target.lane * 20 + 3}%`,
                    top: `${5 + progress * 77}%`,
                  }}
                  onClick={() => catchPacket(target)}
                  key={target.id}
                  aria-label={
                    target.kind === "valid"
                      ? "Capturar pacote válido"
                      : "Pacote corrompido"
                  }
                >
                  <span>{target.kind === "valid" ? "DATA" : "ERR"}</span>
                  <b>{target.kind === "valid" ? `+${target.points}` : "-12"}</b>
                </button>
              );
            })}
            {phase !== "playing" && phase !== "finishing" && (
              <div className="packet-board-cover">
                <span>PC-01 · CANAL SEGURO</span>
                <strong>Capture dados válidos</strong>
                <p>Azul soma pontos. Vermelho reduz a pontuação.</p>
                <button
                  type="button"
                  onClick={startGame}
                  disabled={
                    phase === "loading" ||
                    limits.hourRemaining === 0 ||
                    limits.dayRemaining === 0
                  }
                >
                  {phase === "loading" ? "CONECTANDO..." : "INICIAR PARTIDA"}
                </button>
              </div>
            )}
            {phase === "finishing" && (
              <div className="packet-board-cover compact">
                <strong>Validando a partida...</strong>
                <p>O servidor está conferindo sequência, tempo e pontuação.</p>
              </div>
            )}
          </div>

          <aside className="packet-rules-panel">
            <span>REGRAS DA SESSÃO</span>
            <h4>Poder sem inflação</h4>
            <ul>
              <li>40 pontos: +90 GH/s</li>
              <li>80 pontos: +160 GH/s</li>
              <li>125 pontos: +240 GH/s</li>
              <li>O poder dura 6 horas</li>
              <li>5 partidas/h e 15/dia</li>
            </ul>
            <div className="packet-message" role="status" aria-live="polite">
              {message}
            </div>
            <small>
              {limits.dayRemaining} partidas ainda disponíveis nas últimas 24h.
            </small>
          </aside>
        </div>
      </div>

      <div className="games-grid upcoming">
        {[
          {
            name: "Hash Match",
            glyph: "◇",
            text: "Memória visual com pares de chips e dificuldade progressiva.",
          },
          {
            name: "Circuit Rush",
            glyph: "»",
            text: "Reflexo em circuitos com obstáculos e combos controlados.",
          },
        ].map((game, index) => (
          <article
            className="game-prototype-card"
            style={
              {
                "--game-color": index === 0 ? "#a9ff3f" : "#ffb33b",
              } as React.CSSProperties
            }
            key={game.name}
          >
            <div className="game-prototype-art compact">
              <span>{game.glyph}</span>
              <b>PRÓXIMA FASE</b>
            </div>
            <div className="game-prototype-info">
              <span>MINIGAME 0{index + 2}</span>
              <h3>{game.name}</h3>
              <p>{game.text}</p>
              <button type="button" disabled>
                EM DESENVOLVIMENTO
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
