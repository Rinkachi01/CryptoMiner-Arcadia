import type { ArcadeStartState } from "./arcade-start-rules";

export function ArcadeStartNotice({ state }: { state: ArcadeStartState }) {
  return (
    <div
      className={`arcade-start-notice ${state.tone}`}
      role="status"
      aria-live="polite"
    >
      <i aria-hidden="true" />
      <span>{state.reason}</span>
    </div>
  );
}
