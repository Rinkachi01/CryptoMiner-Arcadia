export type ActivityCategory =
  | "account"
  | "mining"
  | "arcade"
  | "economy"
  | "equipment"
  | "energy";

export type ActivityPresentation = {
  category: ActivityCategory;
  title: string;
  description: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

const gameLabels: Record<string, string> = {
  "packet-catch": "Packet Catch",
  "hash-match": "Hash Match",
  "circuit-rush": "Circuit Rush",
};

export function gameLabel(gameId: string) {
  return gameLabels[gameId] ?? "Minigame Arcadia";
}

export function presentLedgerActivity(
  action: string,
  metadataValue: unknown,
): ActivityPresentation {
  const metadata = objectValue(metadataValue);
  const quantity = Math.max(1, Math.floor(numberValue(metadata.quantity, 1)));

  if (action === "account_initialized") {
    return {
      category: "account",
      title: "Conta protegida criada",
      description:
        "O servidor iniciou seu inventário, sua carteira e sua trilha de auditoria.",
    };
  }
  if (action === "starter_kit_granted") {
    return {
      category: "account",
      title: "Kit inicial entregue",
      description:
        "Um rack e um Byte Spark foram registrados pelo servidor. Energia e moedas precisam ser conquistadas no jogo.",
    };
  }
  if (action === "admin_test_cma_grant") {
    return {
      category: "economy",
      title: "Crédito de teste do proprietário",
      description:
        "CMA virtual foi adicionado para validar compras e o crescimento controlado da rede beta.",
    };
  }
  if (action === "credit_crypto_deposit") {
    const asset = String(metadata.creditedAsset ?? "CRIPTO");
    const credited = numberValue(metadata.creditedAtomic) / 100_000_000;
    return {
      category: "economy",
      title: `Depósito em ${asset} confirmado`,
      description: `${credited.toLocaleString("pt-BR", {
        maximumFractionDigits: 8,
      })} ${asset} foram creditados no saldo interno. A conversão para CMA depende de confirmação manual do jogador.`,
    };
  }
  if (action === "block_settlement") {
    const settledBlocks = Math.max(
      1,
      Math.floor(numberValue(metadata.settledBlocks, 1)),
    );
    return {
      category: "mining",
      title:
        settledBlocks === 1
          ? "Bloco de mineração processado"
          : `${settledBlocks} blocos de mineração processados`,
      description:
        "A participação nas pools foi calculada e registrada pelo servidor.",
    };
  }
  if (action === "sync") {
    const settledBlocks = Math.max(
      0,
      Math.floor(numberValue(metadata.settledBlocks, 0)),
    );
    return settledBlocks > 0
      ? {
          category: "mining",
          title:
            settledBlocks === 1
              ? "Bloco de mineração processado"
              : `${settledBlocks} blocos de mineração processados`,
          description:
            "A sincronização atualizou as recompensas calculadas pelo servidor.",
        }
      : {
          category: "account",
          title: "Conta sincronizada",
          description: "O navegador recebeu a versão mais recente do servidor.",
        };
  }
  if (action === "set_wallet_symbol") {
    return {
      category: "account",
      title: "Moeda principal da carteira alterada",
      description: "A preferência de visualização da carteira foi atualizada.",
    };
  }
  if (action === "set_active_room") {
    return {
      category: "equipment",
      title: "Sala ativa alterada",
      description: "A sala selecionada para organização foi atualizada.",
    };
  }
  if (action === "buy_room") {
    const roomName =
      typeof metadata.roomName === "string"
        ? metadata.roomName
        : "Laboratório Noturno";
    const priceCma = Math.max(0, numberValue(metadata.priceCma));
    return {
      category: "economy",
      title: `${roomName} desbloqueado`,
      description:
        priceCma > 0
          ? `A expansão permanente foi comprada por ${priceCma.toLocaleString("pt-BR")} CMA.`
          : "A nova sala foi adicionada permanentemente à conta.",
    };
  }
  if (action === "buy_miners") {
    return {
      category: "economy",
      title:
        quantity === 1 ? "Minerador comprado" : `${quantity} mineradores comprados`,
      description: "Os equipamentos foram enviados ao inventário.",
    };
  }
  if (action === "buy_racks") {
    return {
      category: "economy",
      title: quantity === 1 ? "Rack comprado" : `${quantity} racks comprados`,
      description: "Os racks foram enviados ao inventário.",
    };
  }
  if (action === "buy_batteries") {
    return {
      category: "economy",
      title:
        quantity === 1 ? "Bateria comprada" : `${quantity} baterias compradas`,
      description: "As baterias foram enviadas ao inventário de energia.",
    };
  }
  if (action === "open_supply_crate") {
    const supplyCrate = objectValue(metadata.supplyCrate);
    const reward = objectValue(supplyCrate.reward);
    const rewardLabel =
      typeof reward.label === "string" ? reward.label : "item surpresa";
    return {
      category: "economy",
      title: "Caixa Arcadia aberta",
      description: `${rewardLabel} foi entregue pelo sorteio autoritativo.`,
    };
  }
  if (action === "place_rack") {
    return {
      category: "equipment",
      title: "Rack instalado na sala",
      description: "O servidor validou a posição antes de salvar o layout.",
    };
  }
  if (action === "install_miner") {
    return {
      category: "equipment",
      title: "Minerador instalado",
      description:
        "O equipamento passou do inventário para um slot válido do rack.",
    };
  }
  if (action === "remove_miner") {
    return {
      category: "equipment",
      title: "Minerador removido",
      description: "O equipamento voltou com segurança para o inventário.",
    };
  }
  if (action === "remove_all_miners") {
    return {
      category: "equipment",
      title: "Rack esvaziado",
      description: `${quantity} equipamento(s) retornaram ao inventário.`,
    };
  }
  if (action === "apply_allocations") {
    const allocations = objectValue(metadata.allocations);
    return {
      category: "mining",
      title: "Distribuição de poder atualizada",
      description: `CMA ${numberValue(allocations.cma)}% · BTC ${numberValue(
        allocations.btc,
      )}% · DOGE ${numberValue(allocations.doge)}%.`,
    };
  }
  if (action === "use_battery") {
    return {
      category: "energy",
      title: "Bateria utilizada",
      description: "A reserva de energia da sala recebeu mais horas de operação.",
    };
  }
  if (action === "claim_energy") {
    return {
      category: "energy",
      title: "Recarga gratuita resgatada",
      description: "O ciclo de energia de 12 horas foi confirmado pelo servidor.",
    };
  }
  if (action === "daily_mission_battery") {
    return {
      category: "energy",
      title: "Bateria do Tour do Arcade resgatada",
      description:
        "Os três minigames do ciclo foram verificados antes da entrega.",
    };
  }

  return {
    category: "account",
    title: "Atividade da conta registrada",
    description:
      "Uma alteração validada foi adicionada ao histórico do servidor.",
  };
}

export function presentGameSession(
  gameId: string,
  status: string,
  score: number,
  difficulty: number,
): ActivityPresentation {
  const label = gameLabel(gameId);
  const completed = status === "completed";
  return {
    category: "arcade",
    title: completed ? `${label} concluído` : `${label} encerrado`,
    description: completed
      ? `${score.toLocaleString("pt-BR")} pontos na dificuldade ${difficulty}.`
      : `A tentativa terminou sem recompensa na dificuldade ${difficulty}.`,
  };
}
