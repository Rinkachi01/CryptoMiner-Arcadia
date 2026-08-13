"use client";

import { Component, type ReactNode } from "react";

type GameErrorBoundaryProps = {
  children: ReactNode;
  compact?: boolean;
  message?: string;
  onRecover?: () => void;
  resetKey?: string;
  title?: string;
};

type GameErrorBoundaryState = {
  hasError: boolean;
  errorMsg?: string;
};

export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  state: GameErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { hasError: true, errorMsg: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("GameErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(previousProps: GameErrorBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, errorMsg: undefined });
    }
  }

  private recover = () => {
    this.setState({ hasError: false, errorMsg: undefined });
    this.props.onRecover?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section
        className={`game-error-recovery${this.props.compact ? " compact" : ""}`}
        role="alert"
      >
        <span>SISTEMA DE RECUPERAÇÃO</span>
        <h2>{this.props.title ?? "A interface encontrou uma falha"}</h2>
        <p>
          {this.props.message ??
            "Seus dados continuam salvos no servidor. Recarregue a interface para continuar."}
        </p>
        <p style={{ color: "#ff4444", fontSize: "12px", fontFamily: "monospace", marginTop: "10px", wordBreak: "break-all" }}>
          Detalhe Técnico: {this.state.errorMsg}
        </p>
        <div>
          {this.props.onRecover && (
            <button type="button" onClick={this.recover}>
              VOLTAR À SALA
            </button>
          )}
          <button type="button" onClick={() => window.location.reload()}>
            RECARREGAR JOGO
          </button>
        </div>
      </section>
    );
  }
}
