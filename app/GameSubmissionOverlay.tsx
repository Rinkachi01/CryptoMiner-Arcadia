export function GameSubmissionOverlay({
  gameLabel,
}: {
  gameLabel: string;
}) {
  return (
    <div className="game-submission-overlay" role="status" aria-live="polite">
      <span>TRANSMISSÃO SEGURA · {gameLabel.toUpperCase()}</span>
      <div className="game-submission-network" aria-hidden="true">
        <div className="submission-computer">
          <i />
          <b>CLIENTE</b>
        </div>
        <div className="submission-data-stream">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="submission-server">
          <i />
          <i />
          <i />
          <b>SERVIDOR</b>
        </div>
      </div>
      <strong>ENVIANDO PROVA DA PARTIDA</strong>
      <p>Pontuação, tempo e eventos estão sendo conferidos pelo servidor.</p>
      <div className="submission-progress">
        <i />
      </div>
    </div>
  );
}
