"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { gameCoins } from "./game-coin-catalog";
import { GameSubmissionOverlay } from "./GameSubmissionOverlay";

type Limits = { hourRemaining: number; dayRemaining: number };
type Reveal = {
  cardId: string;
  coinId: string;
  symbol: string;
  name: string;
  asset: string;
  points: number;
};
type CardState = {
  id: string;
  reveal?: Reveal;
  matched: boolean;
};
type HashSession = {
  sessionId: string;
  nonce: string;
  difficulty: number;
  durationMs: number;
  cards: Array<{ id: string }>;
};

export function HashMatchView({
  onRefreshAccount,
}: {
  onRefreshAccount: () => Promise<boolean>;
}) {
  const [phase, setPhase] = useState<
    "idle" | "loading" | "playing" | "finishing" | "result"
  >("idle");
  const [difficulty, setDifficulty] = useState(1);
  const [nextPlayAt, setNextPlayAt] = useState(0);
  const [limits, setLimits] = useState<Limits>({
    hourRemaining: 6,
    dayRemaining: 18,
  });
  const [session, setSession] = useState<HashSession | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    "Encontre os pares de moedas antes que o tempo termine.",
  );
  const [reward, setReward] = useState(0);
  const [clockNow, setClockNow] = useState(0);
  const localStartedAt = useRef(0);
  const timeoutSent = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    for (const coin of gameCoins) {
      const image = new window.Image();
      image.src = coin.asset;
    }
  }, []);

  useEffect(() => {
    void fetch("/api/games/hash-match", { cache: "no-store" })
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
      .catch(() => setMessage("O estado será carregado ao iniciar."));
  }, []);

  const finishTimeout = useCallback(
    async (activeSession: HashSession) => {
      if (timeoutSent.current) return;
      timeoutSent.current = true;
      setPending(true);
      setPhase("finishing");
      try {
        const response = await fetch("/api/games/hash-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "timeout",
            sessionId: activeSession.sessionId,
            nonce: activeSession.nonce,
          }),
        });
        const data = (await response.json()) as {
          nextPlayAt?: number;
          message?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Tempo encerrado.");
        setNextPlayAt(data.nextPlayAt ?? 0);
        setMessage(data.message ?? "Tempo encerrado.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Tempo encerrado.");
      } finally {
        setReward(0);
        setPending(false);
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        setPhase("result");
      }
    },
    [],
  );

  useEffect(() => {
    if (phase !== "playing" || !session) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - localStartedAt.current;
      setElapsedMs(Math.min(elapsed, session.durationMs));
      if (elapsed >= session.durationMs) void finishTimeout(session);
    }, 80);
    return () => window.clearInterval(timer);
  }, [finishTimeout, phase, session]);

  async function startGame() {
    setPhase("loading");
    setMessage("Montando um tabuleiro seguro...");
    setReward(0);
    try {
      const response = await fetch("/api/games/hash-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await response.json()) as HashSession & {
        nextPlayAt?: number;
        limits?: Limits;
        error?: string;
      };
      if (!response.ok) {
        if (data.nextPlayAt) setNextPlayAt(data.nextPlayAt);
        throw new Error(data.error ?? "Hash Match indisponível.");
      }
      setSession(data);
      setDifficulty(data.difficulty);
      setCards(data.cards.map((card) => ({ ...card, matched: false })));
      if (data.limits) setLimits(data.limits);
      setMoves(0);
      setElapsedMs(0);
      timeoutSent.current = false;
      localStartedAt.current = Date.now();
      setMessage("Memorize as moedas e encontre todos os pares.");
      setPhase("playing");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar.",
      );
      setPhase("idle");
    }
  }

  async function flipCard(cardId: string) {
    if (!session || phase !== "playing" || pending) return;
    setPending(true);
    let unlockDelay = 40;
    try {
      const response = await fetch("/api/games/hash-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flip",
          sessionId: session.sessionId,
          nonce: session.nonce,
          cardId,
        }),
      });
      const data = (await response.json()) as {
        reveals?: Reveal[];
        matched?: boolean;
        matchedCardIds?: string[];
        completed?: boolean;
        moves?: number;
        rewardPowerGh?: number;
        nextDifficulty?: number;
        nextPlayAt?: number;
        message?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Carta recusada.");
      const reveals = data.reveals ?? [];
      setCards((current) =>
        current.map((card) => {
          const reveal = reveals.find((item) => item.cardId === card.id);
          return {
            ...card,
            reveal: reveal ?? card.reveal,
            matched:
              card.matched || Boolean(data.matchedCardIds?.includes(card.id)),
          };
        }),
      );
      setMoves(data.moves ?? moves);

      if (data.completed) {
        setPhase("finishing");
        setReward(data.rewardPowerGh ?? 0);
        setDifficulty(data.nextDifficulty ?? difficulty);
        setNextPlayAt(data.nextPlayAt ?? 0);
        setMessage(data.message ?? "Todos os pares foram encontrados.");
        await new Promise((resolve) => window.setTimeout(resolve, 780));
        await onRefreshAccount();
        setPhase("result");
      } else if (reveals.length === 2 && !data.matched) {
        unlockDelay = 430;
        window.setTimeout(() => {
          const ids = new Set(reveals.map((item) => item.cardId));
          setCards((current) =>
            current.map((card) =>
              ids.has(card.id) && !card.matched
                ? { ...card, reveal: undefined }
                : card,
            ),
          );
        }, 420);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível virar.",
      );
    } finally {
      window.setTimeout(() => setPending(false), unlockDelay);
    }
  }

  const cooldownSeconds = Math.max(
    0,
    Math.ceil((nextPlayAt - clockNow) / 1000),
  );
  const secondsLeft = Math.max(
    0,
    Math.ceil(((session?.durationMs ?? 0) - elapsedMs) / 1000),
  );

  return (
    <section className="hash-match-shell">
      <header>
        <div>
          <span>MINIGAME 02 · MEMÓRIA AUTORITATIVA</span>
          <h3>Hash Match</h3>
          <p>
            As moedas são reveladas pelo servidor uma carta por vez.
          </p>
        </div>
        <div className="hash-status">
          <span>
            NÍVEL <strong>{difficulty}</strong>
          </span>
          <span>
            JOGADAS <strong>{moves}</strong>
          </span>
          <span>
            TEMPO <strong>{phase === "playing" ? secondsLeft : "—"}</strong>
          </span>
        </div>
      </header>

      <div className="hash-match-layout">
        <div
          className={`hash-board cards-${cards.length}`}
          aria-label="Tabuleiro de memória"
        >
          {cards.map((card) => (
            <button
              type="button"
              className={`hash-card ${card.reveal ? "revealed" : ""} ${
                card.matched ? "matched" : ""
              }`}
              onPointerDown={() => flipCard(card.id)}
              disabled={
                phase !== "playing" ||
                pending ||
                card.matched ||
                Boolean(card.reveal)
              }
              key={card.id}
              aria-label={
                card.reveal
                  ? `${card.reveal.name} revelada`
                  : "Virar carta de moeda"
              }
            >
              <span className="hash-card-back">CMA</span>
              {card.reveal && (
                <span className="hash-card-face">
                  <img src={card.reveal.asset} alt="" />
                  <b>{card.reveal.symbol}</b>
                </span>
              )}
            </button>
          ))}

          {phase === "finishing" && (
            <GameSubmissionOverlay gameLabel="Hash Match" />
          )}

          {phase !== "playing" && phase !== "finishing" && (
            <div className="hash-board-cover">
              <span>CRIPTO-MEMÓRIA</span>
              <strong>
                {phase === "result" && reward > 0
                  ? `+${reward} GH/s`
                  : "Encontre os pares"}
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
                  ? "MONTANDO..."
                  : cooldownSeconds > 0
                    ? `RECARGA ${cooldownSeconds}s`
                    : "INICIAR HASH MATCH"}
              </button>
            </div>
          )}
        </div>

        <aside>
          <span>COMO FUNCIONA</span>
          <h4>Memória sob pressão</h4>
          <ul>
            <li>Encontre todos os pares para vencer.</li>
            <li>Mais pares aparecem nos níveis altos.</li>
            <li>O tempo diminui conforme a dificuldade.</li>
            <li>O poder só é emitido após validação.</li>
          </ul>
          <div className="packet-message" role="status" aria-live="polite">
            {message}
          </div>
          <small>
            {limits.dayRemaining} tabuleiros disponíveis nas últimas 24h.
          </small>
        </aside>
      </div>
    </section>
  );
}
