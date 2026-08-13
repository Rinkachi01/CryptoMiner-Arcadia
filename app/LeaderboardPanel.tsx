import { useEffect, useState } from "react";

type LeaderboardRow = {
  rank: number;
  accountId: string;
  displayName: string;
  powerGh: number;
};

type LeaderboardResponse = {
  generatedAt: number;
  leaderboard: LeaderboardRow[];
};

export function LeaderboardPanel() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const response = await fetch("/api/network/leaderboard", {
          signal: controller.signal,
        });
        const result = (await response.json()) as LeaderboardResponse & { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? "Não foi possível carregar o ranking.");
        }
        setLeaderboard(result.leaderboard || []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Erro desconhecido.");
        }
      } finally {
        setLoading(false);
      }
    }

    void fetchLeaderboard();

    return () => controller.abort();
  }, []);

  return (
    <div className="leaderboard-panel arcadia-panel">
      <header className="panel-header">
        <h2>Ranking de Poder</h2>
        <p>Os maiores mineradores da rede Arcadia.</p>
      </header>

      <div className="panel-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Sincronizando com a rede...</p>
          </div>
        ) : error ? (
          <p className="error-state">{error}</p>
        ) : leaderboard.length === 0 ? (
          <p className="empty-state">O ranking está vazio no momento.</p>
        ) : (
          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="col-rank">Posição</th>
                  <th className="col-name">Operador</th>
                  <th className="col-power">Poder Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.accountId} className={`leaderboard-row rank-${row.rank}`}>
                    <td className="col-rank">
                      <span className="rank-badge">#{row.rank}</span>
                    </td>
                    <td className="col-name">
                      <strong>{row.displayName}</strong>
                    </td>
                    <td className="col-power">
                      <span className="power-value">{formatPower(row.powerGh)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .leaderboard-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 30px;
        }
        .panel-header {
          margin-bottom: 30px;
          text-align: center;
        }
        .panel-header h2 {
          font-size: 32px;
          color: #fff;
          margin-bottom: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
        }
        .panel-header p {
          color: #aaa;
          font-size: 14px;
        }
        .panel-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid #222;
          border-radius: 12px;
          overflow: hidden;
        }
        .leaderboard-table-container {
          overflow-y: auto;
          flex: 1;
        }
        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .leaderboard-table th {
          background: #111;
          color: #888;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 15px 20px;
          border-bottom: 1px solid #333;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .leaderboard-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #222;
          vertical-align: middle;
        }
        .leaderboard-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .col-rank {
          width: 100px;
          text-align: center;
        }
        .col-power {
          text-align: right;
        }
        .rank-badge {
          display: inline-block;
          font-size: 14px;
          font-weight: bold;
          color: #888;
          background: #222;
          padding: 4px 12px;
          border-radius: 20px;
          min-width: 50px;
        }
        .col-name strong {
          color: #e0e0e0;
          font-size: 15px;
          letter-spacing: 0.5px;
        }
        .power-value {
          color: #00ff88;
          font-weight: bold;
          font-size: 15px;
          font-family: monospace;
          background: rgba(0, 255, 136, 0.1);
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(0, 255, 136, 0.2);
        }
        /* Top 3 Styling */
        .rank-1 .rank-badge {
          background: linear-gradient(135deg, #ffd700, #ffaa00);
          color: #000;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
        }
        .rank-2 .rank-badge {
          background: linear-gradient(135deg, #e0e0e0, #999);
          color: #000;
          box-shadow: 0 0 10px rgba(224, 224, 224, 0.4);
        }
        .rank-3 .rank-badge {
          background: linear-gradient(135deg, #cd7f32, #8b4513);
          color: #fff;
          box-shadow: 0 0 10px rgba(205, 127, 50, 0.4);
        }
        .rank-1 .col-name strong { color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,0.3); }
        .rank-2 .col-name strong { color: #e0e0e0; }
        .rank-3 .col-name strong { color: #cd7f32; }

        .loading-state, .error-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #888;
          font-size: 15px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0,255,136,0.1);
          border-top-color: #00ff88;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function formatPower(powerGh: number) {
  if (powerGh >= 1_000_000) {
    return `${(powerGh / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} PH/s`;
  }
  if (powerGh >= 1000) {
    return `${(powerGh / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} TH/s`;
  }
  return `${powerGh.toLocaleString("pt-BR")} GH/s`;
}
