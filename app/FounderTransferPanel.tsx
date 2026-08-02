"use client";

import { useState } from "react";

export function FounderTransferPanel() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState("");
  const [transferPackage, setTransferPackage] = useState("");

  async function generatePackage() {
    setBusy("export");
    setMessage("");
    try {
      const response = await fetch("/api/admin/account-transfer", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        error?: string;
        rowCount?: number;
        transferPackage?: string;
      };
      if (!response.ok || !data.transferPackage) {
        throw new Error(data.error ?? "Não foi possível gerar o pacote.");
      }
      setTransferPackage(data.transferPackage);
      setMessage(`Pacote assinado pronto: ${data.rowCount ?? 0} registros.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setBusy(null);
    }
  }

  async function importPackage() {
    setBusy("import");
    setMessage("");
    try {
      const response = await fetch("/api/admin/account-transfer", {
        body: JSON.stringify({ transferPackage }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível importar.");
      setMessage(data.message ?? "Migração concluída.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao importar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="founder-transfer-card">
      <span>MIGRAÇÃO ÚNICA · SOMENTE PROPRIETÁRIO</span>
      <h1>Transferir a conta fundadora</h1>
      <p>
        O pacote é assinado pelo servidor e só pode ser importado pela mesma
        identidade verificada. A conta de destino precisa estar sem atividade.
      </p>
      <div className="founder-transfer-actions">
        <button disabled={busy !== null} onClick={generatePackage} type="button">
          {busy === "export" ? "GERANDO…" : "GERAR PACOTE DESTA CONTA"}
        </button>
        <a href="/admin">VOLTAR À CENTRAL</a>
      </div>
      <label>
        Pacote assinado
        <textarea
          aria-label="Pacote assinado da conta fundadora"
          onChange={(event) => setTransferPackage(event.target.value)}
          placeholder="Gere no ambiente antigo ou cole aqui no ambiente público."
          rows={8}
          spellCheck={false}
          value={transferPackage}
        />
      </label>
      <button
        className="founder-transfer-import"
        disabled={busy !== null || transferPackage.length < 100}
        onClick={importPackage}
        type="button"
      >
        {busy === "import" ? "VALIDANDO E MIGRANDO…" : "IMPORTAR NESTA CONTA"}
      </button>
      {message && <div className="founder-transfer-message" role="status">{message}</div>}
      <small>
        O bloco atual é reiniciado no destino para impedir pagamento duplicado
        durante a mudança de servidor.
      </small>
    </section>
  );
}
