export type ArcadePlayLimits = {
  hourRemaining: number;
  dayRemaining: number;
};

export type ArcadeStartState = {
  disabled: boolean;
  label: string;
  reason: string;
  tone: "ready" | "loading" | "cooldown" | "limited";
};

export function formatArcadeCooldown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}`
    : `${seconds}s`;
}

export function describeArcadeStart({
  cooldownSeconds,
  limits,
  loading,
  loadingLabel,
  readyLabel,
}: {
  cooldownSeconds: number;
  limits: ArcadePlayLimits;
  loading: boolean;
  loadingLabel: string;
  readyLabel: string;
}): ArcadeStartState {
  if (loading) {
    return {
      disabled: true,
      label: loadingLabel,
      reason: "O servidor está criando uma sessão única e protegida.",
      tone: "loading",
    };
  }
  if (limits.dayRemaining <= 0) {
    return {
      disabled: true,
      label: "LIMITE DIÁRIO ATINGIDO",
      reason:
        "Você usou as partidas disponíveis nesta janela de 24 horas. O acesso volta automaticamente quando a janela renovar.",
      tone: "limited",
    };
  }
  if (limits.hourRemaining <= 0) {
    return {
      disabled: true,
      label: "LIMITE DA HORA ATINGIDO",
      reason:
        "A proteção do Arcade pausou novas partidas nesta hora. Seu progresso já está salvo; tente novamente quando a janela renovar.",
      tone: "limited",
    };
  }
  if (cooldownSeconds > 0) {
    const countdown = formatArcadeCooldown(cooldownSeconds);
    return {
      disabled: true,
      label: `RECARGA ${countdown}`,
      reason: `Aguarde ${countdown} para iniciar outra rodada. A recarga evita geração ilimitada de poder.`,
      tone: "cooldown",
    };
  }
  return {
    disabled: false,
    label: readyLabel,
    reason:
      "Sessão disponível. O resultado e o poder temporário serão conferidos pelo servidor.",
    tone: "ready",
  };
}
