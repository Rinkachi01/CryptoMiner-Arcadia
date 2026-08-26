"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArcadeStartNotice } from "./ArcadeStartNotice";
import { describeArcadeStart } from "./arcade-start-rules";
import { DropNotification } from "./DropNotification";
import { GameSubmissionOverlay } from "./GameSubmissionOverlay";
import type { GameDropValue } from "./drop-types";
import {
  applyCrypto2048Move,
  CRYPTO_2048_RANKS,
  createCrypto2048Board,
  crypto2048TargetScore,
  type Crypto2048Cell,
  type Crypto2048Direction,
  type Crypto2048Move,
} from "./crypto-2048-rules";
import { PlaysCounter } from "./PlaysCounter";

type Phase = "idle" | "loading" | "playing" | "finishing" | "result";
type Limits = { hourRemaining: number; dayRemaining: number };
type GameSession = {
  sessionId: string;
  nonce: string;
  seed: string;
  durationMs: number;
  difficulty: number;
  board: Crypto2048Cell[];
  targetScore: number;
};
type ResultState = {
  outcome: "completed" | "gameover" | "timeout";
  score: number;
  rewardPowerGh: number;
  maxRank: number;
  drop?: GameDropValue;
};

function rankInfo(rank: number) {
  return CRYPTO_2048_RANKS.find((item) => item.rank === rank) ?? {
    rank,
    symbol: `R${rank}`,
    name: `Rank ${rank}`,
    color: "lime",
  };
}

function formatSeconds(value: number) {
  return `${Math.max(0, Math.ceil(value / 1000))}s`;
}

export function Crypto2048View({
  onRefreshAccount,
}: {
  onRefreshAccount: () => Promise<boolean>;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [difficulty, setDifficulty] = useState(1);
  const [nextPlayAt, setNextPlayAt] = useState(0);
  const [clockNow, setClockNow] = useState(0);
  const [limits, setLimits] = useState<Limits>({ hourRemaining: 6, dayRemaining: 18 });
  const [session, setSession] = useState<GameSession | null>(null);
  const [board, setBoard] = useState<Crypto2048Cell[]>(() => createCrypto2048Board("preview", 1));
  const [score, setScore] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [maxRank, setMaxRank] = useState(1);
  const [targetScore, setTargetScore] = useState(() => crypto2048TargetScore(1));
  const [message, setMessage] = useState("Funda moedas iguais e suba pelos ranks.");
  const [result, setResult] = useState<ResultState | null>(null);
  const [lastMerge, setLastMerge] = useState<number | null>(null);
  const [moveDirection, setMoveDirection] = useState<Crypto2048Direction | null>(null);
  const localStartedAt = useRef(0);
  const sessionRef = useRef<GameSession | null>(null);
  const boardRef = useRef(board);
  const scoreRef = useRef(0);
  const eventsRef = useRef<Crypto2048Move[]>([]);
  const finishStarted = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const refreshArcadeAccount = useCallback(async () => onRefreshAccount(), [onRefreshAccount]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch("/api/games/crypto-2048", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          serverTime?: number;
          difficulty?: number;
          nextPlayAt?: number;
          targetScore?: number;
          limits?: Limits;
        };
        if (!response.ok) return;
        setClockNow(data.serverTime ?? Date.now());
        setDifficulty(data.difficulty ?? 1);
        setNextPlayAt(data.nextPlayAt ?? 0);
        setTargetScore(data.targetScore ?? crypto2048TargetScore(data.difficulty ?? 1));
        if (data.limits) setLimits(data.limits);
      })
      .catch(() => setMessage("O Crypto 2048 será sincronizado ao iniciar a partida."));
  }, []);

  const finishGame = useCallback(
    async (
      activeSession: GameSession,
      outcome: "complete" | "gameover" | "timeout",
      events: Crypto2048Move[],
      durationMs: number,
    ) => {
      if (finishStarted.current) return;
      finishStarted.current = true;
      setPhase("finishing");
      const submissionStartedAt = performance.now();
      try {
        const response = await fetch("/api/games/crypto-2048", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finish",
            sessionId: activeSession.sessionId,
            nonce: activeSession.nonce,
            durationMs,
            outcome,
            events,
          }),
        });
        const data = (await response.json()) as {
          outcome?: "completed" | "gameover" | "timeout";
          score?: number;
          maxRank?: number;
          targetScore?: number;
          rewardPowerGh?: number;
          drop?: GameDropValue;
          nextDifficulty?: number;
          nextPlayAt?: number;
          limits?: Limits;
          message?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Partida não validada.");
        setResult({
          outcome: data.outcome ?? (outcome === "complete" ? "completed" : outcome),
          score: data.score ?? scoreRef.current,
          maxRank: data.maxRank ?? maxRank,
          rewardPowerGh: data.rewardPowerGh ?? 0,
          drop: data.drop,
        });
        setTargetScore(data.targetScore ?? activeSession.targetScore);
        setDifficulty(data.nextDifficulty ?? activeSession.difficulty);
        setNextPlayAt(data.nextPlayAt ?? 0);
        if (data.limits) setLimits(data.limits);
        setMessage(data.message ?? "Partida validada pelo servidor.");
        await refreshArcadeAccount();
        await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, 720 - (performance.now() - submissionStartedAt))));
        setPhase("result");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível encerrar a partida.");
        setPhase("idle");
      } finally {
        finishStarted.current = false;
      }
    },
    [maxRank, refreshArcadeAccount],
  );

  useEffect(() => {
    if (phase !== "playing" || !session) return;
    const timer = window.setInterval(() => {
      const nextElapsed = Math.max(0, Date.now() - localStartedAt.current);
      setElapsedMs(nextElapsed);
      if (nextElapsed >= session.durationMs) {
        void finishGame(
          session,
          scoreRef.current >= session.targetScore ? "complete" : "timeout",
          eventsRef.current,
          session.durationMs,
        );
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [finishGame, phase, session]);

  const startGame = useCallback(async () => {
    setPhase("loading");
    setMessage("Criando um tabuleiro validado pelo servidor...");
    try {
      const response = await fetch("/api/games/crypto-2048", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await response.json()) as {
        sessionId?: string;
        nonce?: string;
        seed?: string;
        durationMs?: number;
        difficulty?: number;
        board?: Crypto2048Cell[];
        targetScore?: number;
        limits?: Limits;
        error?: string;
      };
      if (!response.ok || !data.sessionId || !data.nonce || !data.seed || !data.board) {
        throw new Error(data.error ?? "Não foi possível iniciar o tabuleiro.");
      }
      const activeSession: GameSession = {
        sessionId: data.sessionId,
        nonce: data.nonce,
        seed: data.seed,
        durationMs: data.durationMs ?? 46_000,
        difficulty: data.difficulty ?? difficulty,
        board: data.board,
        targetScore: data.targetScore ?? crypto2048TargetScore(data.difficulty ?? difficulty),
      };
      sessionRef.current = activeSession;
      setSession(activeSession);
      boardRef.current = data.board;
      setBoard(data.board);
      eventsRef.current = [];
      scoreRef.current = 0;
      setScore(0);
      setMoveCount(0);
      setMaxRank(Math.max(1, ...data.board.filter((cell): cell is number => cell !== null)));
      setElapsedMs(0);
      setLastMerge(null);
      setMoveDirection(null);
      setTargetScore(activeSession.targetScore);
      setResult(null);
      if (data.limits) setLimits(data.limits);
      localStartedAt.current = Date.now();
      finishStarted.current = false;
      setMessage(`Alcance ${activeSession.targetScore} pontos para concluir a rodada.`);
      setPhase("playing");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o jogo.");
      setPhase("idle");
    }
  }, [difficulty]);

  const handleMove = useCallback(
    (direction: Crypto2048Direction) => {
      if (phase !== "playing" || !sessionRef.current || finishStarted.current) return;
      const activeSession = sessionRef.current;
      const atMs = Math.max(0, Math.round(Date.now() - localStartedAt.current));
      const move = applyCrypto2048Move(
        boardRef.current,
        activeSession.seed,
        activeSession.difficulty,
        eventsRef.current.length,
        direction,
      );
      if (!move.valid) {
        setMessage("Esse movimento não altera o tabuleiro.");
        return;
      }
      const event = { direction, atMs } satisfies Crypto2048Move;
      const nextEvents = [...eventsRef.current, event];
      eventsRef.current = nextEvents;
      boardRef.current = move.board;
      setBoard(move.board);
      const nextScore = scoreRef.current + move.score;
      scoreRef.current = nextScore;
      setScore(nextScore);
      setMoveCount(nextEvents.length);
      setMaxRank(move.maxRank);
      setLastMerge(move.mergedRanks.length > 0 ? Math.max(...move.mergedRanks) : null);
      setMoveDirection(direction);
      window.setTimeout(() => setMoveDirection(null), 180);
      if (nextScore >= activeSession.targetScore) {
        setMessage(`Meta de ${activeSession.targetScore} pontos alcançada. Validando a rodada...`);
        void finishGame(activeSession, "complete", nextEvents, atMs);
      } else {
        setMessage(move.mergedRanks.length > 0 ? `Fusão realizada: rank ${Math.max(...move.mergedRanks)}.` : "Boa jogada. Continue combinando.");
        if (move.gameOver) void finishGame(activeSession, "gameover", nextEvents, atMs);
      }
    },
    [finishGame, phase],
  );

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (phase !== "playing" || finishStarted.current) return;
    event.preventDefault();
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [phase]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || phase !== "playing") return;
    event.preventDefault();
    setDragOffset({
      x: Math.max(-38, Math.min(38, event.clientX - start.x)),
      y: Math.max(-38, Math.min(38, event.clientY - start.y)),
    });
  }, [phase]);

  const handlePointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    event.preventDefault();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    dragStartRef.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const direction: Crypto2048Direction = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
    handleMove(direction);
  }, [handleMove]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== "playing") return;
      const direction = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const)[event.key];
      if (!direction) return;
      event.preventDefault();
      handleMove(direction);
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleMove, phase]);

  const cooldownSeconds = Math.max(0, Math.ceil((nextPlayAt - clockNow) / 1000));
  const startState = describeArcadeStart({
    cooldownSeconds,
    limits,
    loading: phase === "loading",
    loadingLabel: "CONECTANDO...",
    readyLabel: "INICIAR CRYPTO 2048",
  });
  const remainingMs = session ? Math.max(0, session.durationMs - elapsedMs) : 0;
  const currentDifficulty = session?.difficulty ?? difficulty;
  const currentTargetScore = session?.targetScore ?? targetScore;

  return (
    <section className="crypto-2048-shell" aria-label="Minigame Crypto 2048">
      <header className="crypto-2048-header">
        <div>
          <span className="eyebrow">MINIGAME 06 · CRIPTO-MESCLAGEM</span>
          <h3>Crypto 2048</h3>
          <p>Deslize as moedas, funda os ranks e alcance a meta de pontos do nível.</p>
        </div>
        <div className="crypto-2048-stats">
          <span>NÍVEL <b>{currentDifficulty}</b></span>
          <span>PONTOS <b>{score}/{currentTargetScore}</b></span>
          <span>MOVIMENTOS <b>{moveCount}</b></span>
          <span>MAIOR RANK <b>{rankInfo(maxRank).symbol}</b></span>
          <span>TEMPO <b>{phase === "playing" ? formatSeconds(remainingMs) : "—"}</b></span>
        </div>
      </header>
      <div className="crypto-2048-layout">
        <div className="crypto-2048-board-wrap">
          <div
            className={`crypto-2048-board${moveDirection ? ` is-sliding slide-${moveDirection}` : ""}${isDragging ? " is-dragging" : ""}`}
            role="grid"
            aria-label="Tabuleiro 4 por 4 do Crypto 2048"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            style={{ "--drag-x": `${dragOffset.x}px`, "--drag-y": `${dragOffset.y}px` } as CSSProperties}
          >
            {board.map((cell, index) => {
              const info = cell === null ? null : rankInfo(cell);
              return (
                <div className="crypto-2048-cell" role="gridcell" key={`${index}-${cell ?? "empty"}-${moveCount}`}>
                  {info ? (
                    <div className={`crypto-2048-tile rank-${Math.min(info.rank, 7)} ${lastMerge === info.rank ? "is-new" : ""}`} aria-label={`${info.name}, rank ${info.rank}`}>
                      {info.asset ? <img src={info.asset} alt="" /> : <strong>{info.symbol}</strong>}
                      <small>R{info.rank}</small>
                    </div>
                  ) : <span className="crypto-2048-empty" aria-hidden="true" />}
                </div>
              );
            })}
            {phase !== "playing" && phase !== "finishing" && (
              <div className="crypto-2048-cover">
                <span>CRYPTO 2048 · NÍVEL {currentDifficulty}</span>
                <strong>{result?.outcome === "gameover" ? "Tabuleiro bloqueado" : result?.outcome === "timeout" ? "Tempo esgotado" : result?.rewardPowerGh ? `+${result.rewardPowerGh} GH/s` : "Funda moedas iguais"}</strong>
                <p>{message}</p>
                <ArcadeStartNotice state={startState} />
                <button type="button" onClick={startGame} disabled={startState.disabled}>{startState.label}</button>
              </div>
            )}
            {phase === "finishing" && <GameSubmissionOverlay gameLabel="Crypto 2048" />}
          </div>
          <div className="crypto-2048-controls" aria-label="Controles do Crypto 2048">
            <span />
            <button type="button" onClick={() => handleMove("up")} aria-label="Mover para cima" disabled={phase !== "playing"}>↑</button>
            <span />
            <button type="button" onClick={() => handleMove("left")} aria-label="Mover para a esquerda" disabled={phase !== "playing"}>←</button>
            <button type="button" onClick={() => handleMove("down")} aria-label="Mover para baixo" disabled={phase !== "playing"}>↓</button>
            <button type="button" onClick={() => handleMove("right")} aria-label="Mover para a direita" disabled={phase !== "playing"}>→</button>
          </div>
          <p className="crypto-2048-message" role="status" aria-live="polite">{message}</p>
        </div>
        <aside className="crypto-2048-rules">
          <span className="eyebrow">COMO JOGAR</span>
          <h4>Uma fusão por movimento</h4>
          <p>Use as setas, arraste o tabuleiro com mouse/toque ou use os botões. Cada par igual se funde uma única vez por jogada.</p>
          <div className="crypto-2048-target" aria-live="polite">
            <span>META DO NÍVEL {currentDifficulty}</span>
            <strong>{currentTargetScore} pontos</strong>
            <small>Conclua ao alcançar a meta; não é preciso esperar o cronômetro.</small>
          </div>
          <div className="crypto-2048-rank-list">
            {CRYPTO_2048_RANKS.map((item) => (
              <span key={item.rank} className={`rank-${Math.min(item.rank, 7)}`}>
                {item.asset ? <img src={item.asset} alt="" /> : <b>{item.symbol}</b>}
                <small>R{item.rank}</small>
              </span>
            ))}
          </div>
          <p className="crypto-2048-hint">A meta encerra a rodada assim que for alcançada; se o tempo acabar antes, não há recompensa. O replay é conferido pelo servidor.</p>
          <PlaysCounter remaining={limits.dayRemaining} />
        </aside>
      </div>
      <DropNotification dropAmount={result?.drop ?? null} />
    </section>
  );
}
