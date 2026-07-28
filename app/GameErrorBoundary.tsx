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
};

export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  state: GameErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GameErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: GameErrorBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  private recover = () => {
    this.setState({ hasError: false });
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
