"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArcadeStartNotice } from "./ArcadeStartNotice";
import { describeArcadeStart } from "./arcade-start-rules";
import {
  applyCoinLinkMove,
  COIN_LINK_MAX_MOVES,
  coinLinkCoinPool,
  coinLinkTargetScore,
  type CoinLinkMove,
} from "./coin-link-rules";
import { gameCoins, type GameCoinId } from "./game-coin-catalog";
import { GameSubmissionOverlay } from "./GameSubmissionOverlay";
import { PlaysCounter } from "./PlaysCounter";
import { DropNotification } from "./DropNotification";
import type { GameDropValue } from "./drop-types";

type Limits = { hourRemaining: number; dayRemaining: number };
type CoinLinkSession = {
  sessionId: string;
  nonce: string;
  seed: string;
  difficulty: number;
  durationMs: number;
  targetScore: number;
  board: GameCoinId[];
};

type BoardMotion = {
  phase: "swapping" | "matching" | "falling" | "invalid";
  indices: number[];
  cascade: number;
};

type CascadeMoment = {
  cascades: number;
  maxRun: number;
  sizeBonus: number;
};

const coinById = new Map(gameCoins.map((coin) => [coin.id, coin]));

function waitForAnimation(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function CoinLinkView({
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
  const [session, setSession] = useState<CoinLinkSession | null>(null);
  const [board, setBoard] = useState<GameCoinId[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState(
    "Troque duas moedas vizinhas e forme linhas com três ou mais.",
  );
  const [reward, setReward] = useState(0);
  const [drop, setDrop] = useState<GameDropValue>(null);
  const [lastGain, setLastGain] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [motion, setMotion] = useState<BoardMotion | null>(null);
  const [cascadeMoment, setCascadeMoment] = useState<CascadeMoment | null>(null);
  const eventsRef = useRef<CoinLinkMove[]>([]);
  const boardRef = useRef<GameCoinId[]>([]);
  const scoreRef = useRef(0);
  const localStartedAt = useRef(0);
  const finishStarted = useRef(false);
  const resolvingRef = useRef(false);
  const animationRunRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch("/api/games/coin-link", { cache: "no-store" })
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
      activeSession: CoinLinkSession,
      outcome: "complete" | "timeout" | "exhausted",
      events: CoinLinkMove[],
      durationMs: number,
    ) => {
      if (finishStarted.current) return;
      finishStarted.current = true;
      setPhase("finishing");
      const submissionStartedAt = performance.now();
      try {
        const response = await fetch("/api/games/coin-link", {
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
          score?: number;
          rewardPowerGh?: number;
          nextDifficulty?: number;
          nextPlayAt?: number;
          limits?: Limits;
          message?: string;
          error?: string;
          drop?: GameDropValue;
        };
        if (!response.ok) throw new Error(data.error ?? "Combinação recusada.");
        setScore(data.score ?? scoreRef.current);
        setReward(data.rewardPowerGh ?? 0);
        setDrop(data.drop ?? null);
        setDifficulty(data.nextDifficulty ?? activeSession.difficulty);
        setNextPlayAt(data.nextPlayAt ?? 0);
        if (data.limits) setLimits(data.limits);
        setMessage(data.message ?? "Rodada conferida pelo servidor.");
        await onRefreshAccount();
      } catch (error) {
        setReward(0);
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível validar a rodada.",
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
      if (elapsed >= session.durationMs && !resolvingRef.current) {
        void finishGame(
          session,
          "timeout",
          eventsRef.current,
          session.durationMs,
        );
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [finishGame, phase, session]);

  async function startGame() {
    setPhase("loading");
    setMessage("Preparando um tabuleiro exclusivo...");
    setReward(0);
    setDrop(null);
    setLastGain(0);
    try {
      const response = await fetch("/api/games/coin-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await response.json()) as CoinLinkSession & {
        limits?: Limits;
        nextPlayAt?: number;
        error?: string;
      };
      if (!response.ok) {
        if (data.nextPlayAt) setNextPlayAt(data.nextPlayAt);
        throw new Error(data.error ?? "Coin Cascade indisponível.");
      }
      setSession(data);
      setDifficulty(data.difficulty);
      setBoard(data.board);
      boardRef.current = data.board;
      setSelected(null);
      setScore(0);
      setMoveCount(0);
      scoreRef.current = 0;
      resolvingRef.current = false;
      setResolving(false);
      setMotion(null);
      setCascadeMoment(null);
      setElapsedMs(0);
      eventsRef.current = [];
      finishStarted.current = false;
      localStartedAt.current = Date.now();
      if (data.limits) setLimits(data.limits);
      setMessage("Toque em uma moeda e depois em uma vizinha para combinar.");
      setPhase("playing");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar.",
      );
      setPhase("idle");
    }
  }

  async function chooseCoin(index: number) {
    if (!session || phase !== "playing" || resolvingRef.current) return;
    if (selected === null) {
      setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }

    const previousAt = eventsRef.current.at(-1)?.atMs ?? -1_000;
    const atMs = Math.max(Math.floor(elapsedMs), previousAt + 140);
    const result = applyCoinLinkMove(
      boardRef.current,
      session.seed,
      session.difficulty,
      eventsRef.current.length,
      selected,
      index,
    );
    if (!result.valid) {
      setSelected(index);
      setLastGain(0);
      setMotion({ phase: "invalid", indices: [selected, index], cascade: 0 });
      setMessage("Essa troca não formou uma linha. Escolha outra vizinha.");
      await waitForAnimation(260);
      setMotion(null);
      return;
    }

    const event = { from: selected, to: index, atMs };
    const nextEvents = [...eventsRef.current, event];
    const nextScore = scoreRef.current + result.score;
    eventsRef.current = nextEvents;
    setSelected(null);
    setLastGain(result.score);
    resolvingRef.current = true;
    setResolving(true);
    const animationRun = ++animationRunRef.current;
    const swappedBoard = [...boardRef.current];
    [swappedBoard[selected], swappedBoard[index]] = [
      swappedBoard[index],
      swappedBoard[selected],
    ];
    setBoard(swappedBoard);
    setMotion({
      phase: "swapping",
      indices: [selected, index],
      cascade: 0,
    });
    await waitForAnimation(150);

    for (const step of result.steps) {
      if (animationRunRef.current !== animationRun) return;
      setBoard(step.boardBeforeClear);
      setMotion({
        phase: "matching",
        indices: step.matchedIndices,
        cascade: step.cascade,
      });
      setCascadeMoment({
        cascades: step.cascade,
        maxRun: step.maxRun,
        sizeBonus: step.sizeBonus,
      });
      setMessage(
        step.maxRun >= 5
          ? `Super combinação de ${step.maxRun} moedas! +${step.score} pontos.`
          : step.maxRun === 4
            ? `Linha de 4 com bônus! +${step.score} pontos.`
            : step.cascade > 1
              ? `Cascata x${step.cascade}: +${step.score} pontos.`
              : `Combinação confirmada: +${step.score} pontos.`,
      );
      await waitForAnimation(step.maxRun >= 5 ? 330 : 260);
      setBoard(step.boardAfterRefill);
      setMotion({
        phase: "falling",
        indices: step.matchedIndices,
        cascade: step.cascade,
      });
      await waitForAnimation(260);
    }

    boardRef.current = result.board;
    scoreRef.current = nextScore;
    setBoard(result.board);
    setScore(nextScore);
    setMoveCount(nextEvents.length);
    setMotion(null);
    resolvingRef.current = false;
    setResolving(false);
    setMessage(
      result.reshuffled
        ? `Sem trocas disponíveis: tabuleiro reorganizado. +${result.score} pontos.`
        : result.cascades > 1
        ? `Cascata x${result.cascades} concluída: +${result.score} pontos.`
        : `Combinação concluída: +${result.score} pontos.`,
    );

    if (nextScore >= session.targetScore) {
      void finishGame(session, "complete", nextEvents, atMs);
    } else if (nextEvents.length >= COIN_LINK_MAX_MOVES) {
      void finishGame(session, "exhausted", nextEvents, atMs);
    }
  }

  const cooldownSeconds = Math.max(
    0,
    Math.ceil((nextPlayAt - clockNow) / 1000),
  );
  const secondsLeft = Math.max(
    0,
    Math.ceil(((session?.durationMs ?? 46_000) - elapsedMs) / 1000),
  );
  const targetScore = session?.targetScore ?? coinLinkTargetScore(difficulty);
  const startState = describeArcadeStart({
    cooldownSeconds,
    limits,
    loading: phase === "loading",
    loadingLabel: "MONTANDO TABULEIRO...",
    readyLabel: "INICIAR COIN CASCADE",
  });
  const visibleCoins = useMemo(
    () =>
      coinLinkCoinPool(session?.difficulty ?? difficulty)
        .map((id) => coinById.get(id))
        .filter((coin) => coin !== undefined),
    [difficulty, session?.difficulty],
  );

  return (
    <section className="coin-link-shell">
      <header>
        <div>
          <span>MINIGAME 04 · ESTRATÉGIA</span>
          <h3>Coin Cascade</h3>
          <p>Combine moedas, provoque cascatas e alcance a meta do servidor.</p>
        </div>
        <div className="coin-link-status">
          <span>
            NÍVEL <strong>{session?.difficulty ?? difficulty}</strong>
          </span>
          <span>
            PONTOS <strong>{score}/{targetScore}</strong>
          </span>
          <span>
            JOGADAS <strong>{moveCount}/{COIN_LINK_MAX_MOVES}</strong>
          </span>
          <span>
            TEMPO <strong>{phase === "playing" ? `${secondsLeft}s` : "—"}</strong>
          </span>
        </div>
      </header>

      <div className="coin-link-layout">
        <div className="coin-link-board-wrap">
          <div className="coin-link-goal-row">
            <div>
              <span>META DA RODADA</span>
              <strong>{Math.min(score, targetScore)} / {targetScore}</strong>
            </div>
            <small>
              {difficulty <= 4
                ? "5 moedas · mais chances de cascata"
                : difficulty <= 8
                  ? "6 moedas · dificuldade intermediária"
                  : "7 moedas · combinações mais raras"}
            </small>
          </div>
          <div className="coin-link-progress" aria-label="Progresso da meta">
            <i style={{ width: `${Math.min(100, (score / targetScore) * 100)}%` }} />
          </div>
          <div
            className={`coin-link-board ${resolving ? "resolving" : ""}`}
            aria-label="Tabuleiro Coin Cascade"
            aria-busy={resolving}
          >
            {cascadeMoment && resolving && (
              <div className="coin-link-combo" aria-live="assertive">
                <span>
                  {cascadeMoment.maxRun >= 5
                    ? `SUPER ${cascadeMoment.maxRun}`
                    : cascadeMoment.maxRun === 4
                      ? "LINHA DE 4"
                      : `CASCADE x${cascadeMoment.cascades}`}
                </span>
                <strong>
                  {cascadeMoment.sizeBonus > 0
                    ? `BÔNUS +${cascadeMoment.sizeBonus}`
                    : cascadeMoment.cascades > 1
                      ? `MULTIPLICADOR x${cascadeMoment.cascades}`
                      : "COMBINAÇÃO"}
                </strong>
              </div>
            )}
            {board.map((coinId, index) => {
              const coin = coinById.get(coinId);
              const isMotionTarget = motion?.indices.includes(index) ?? false;
              const classes = [
                selected === index ? "selected" : "",
                isMotionTarget ? `motion-${motion?.phase}` : "",
                motion?.phase === "falling" ? "board-falling" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  type="button"
                  className={classes}
                  onPointerDown={() => void chooseCoin(index)}
                  disabled={phase !== "playing" || resolving}
                  aria-label={`${coin?.name ?? coinId}, ${coin?.points ?? 0} pontos`}
                  key={`${index}-${coinId}`}
                >
                  {coin && <img src={coin.asset} alt="" />}
                  <span>+{coin?.points ?? 0}</span>
                </button>
              );
            })}
            {phase !== "playing" && phase !== "finishing" && (
              <div className="coin-link-cover">
                <span>TABULEIRO 6 × 6 · META {targetScore}</span>
                <strong>
                  {reward > 0 ? `+${reward} GH/s` : "Combine e evolua"}
                </strong>
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
            {phase === "finishing" && (
              <GameSubmissionOverlay gameLabel="Coin Cascade" />
            )}
          </div>
        </div>

        <aside>
          <span>PAINEL DE COMBINAÇÕES</span>
          <h4>{lastGain > 0 ? `+${lastGain} pontos` : "Moedas da rodada"}</h4>
          <div className="coin-link-values">
            {visibleCoins.map((coin) => (
              <div key={coin.id}>
                <img src={coin.asset} alt="" />
                <span>{coin.symbol}</span>
                <b>+{coin.points}</b>
              </div>
            ))}
          </div>
          <div className="coin-link-combo-guide">
            <div><b>3</b><span>combinação normal</span></div>
            <div><b>4</b><span>bônus de linha longa</span></div>
            <div><b>5+</b><span>super combinação</span></div>
          </div>
          <ul>
            <li>Linhas de 4 e 5+ recebem bônus progressivo.</li>
            <li>Novas quedas podem criar cascatas pela sorte.</li>
            <li>Trocas sem combinação não gastam jogada.</li>
          </ul>
          <p role="status" aria-live="polite">{message}</p>
          <PlaysCounter remaining={limits.dayRemaining} />
        </aside>
      </div>
      <DropNotification dropAmount={drop} />
    </section>
  );
}
