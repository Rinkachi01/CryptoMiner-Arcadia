import { getMiner } from "./game-rules.ts";

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
  // O identificador técnico permanece coin-link para não quebrar o histórico.
  "coin-link": "Coin Cascade",
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
      title: "Crédito administrativo do proprietário",
      description:
        "CMA virtual foi adicionado pelo proprietário para equilibrar a operação e validar compras.",
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
    return settledBlocks > 0 && metadata.settlementRecordedSeparately !== true
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
  if (action === "buy_miners" && typeof metadata.minerId === "string") {
    const minerName = getMiner(metadata.minerId)?.name ?? "Minerador";
    return {
      category: "equipment",
      title: quantity === 1 ? `${minerName} comprado` : `${quantity}x ${minerName} comprados`,
      description: "O equipamento foi enviado ao inventario pelo servidor.",
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
  if (action === "season_reward_claim") {
    const reward = objectValue(metadata.reward);
    const track = metadata.track === "premium" ? "Premium" : "gratuita";
    const level = Math.max(1, Math.floor(numberValue(metadata.level, 1)));
    if (reward.type === "miner") {
      const minerName = getMiner(String(reward.minerId ?? ""))?.name ?? "Minerador sazonal";
      return {
        category: "equipment",
        title: `${minerName} recebido pelo passe`,
        description: `Recompensa da trilha ${track}, nivel ${level}, adicionada ao inventario.`,
      };
    }
    if (reward.type === "power") {
      const days = Math.max(1, Math.floor(numberValue(reward.days, 1)));
      const powerGh = Math.max(0, Math.floor(numberValue(reward.powerGh, 0)));
      return {
        category: "arcade",
        title: "Poder do passe ativado",
        description: `${powerGh.toLocaleString("pt-BR")} GH/s temporarios por ${days} dia(s), trilha ${track}, nivel ${level}.`,
      };
    }
    return {
      category: "energy",
      title: "Bateria recebida pelo passe",
      description: `${Math.max(0, Math.floor(numberValue(reward.quantity, 0)))} bateria(s) da trilha ${track}, nivel ${level}.`,
    };
  }
  if (action === "referral_mining_share_out" || action === "referral_mining_bonus_source") {
    const cmaPercent = numberValue(metadata.cmaSharePercent, 8);
    const cryptoPercent = numberValue(metadata.cryptoSharePercent, 5);
    return {
      category: "mining",
      title: "Bônus de indicação processado",
      description: `${cmaPercent}% em CMA e ${cryptoPercent}% em BTC, DOGE e LTC foram calculados por bloco validado.`,
    };
  }
  if (action === "referral_mining_share_in" || action === "referral_mining_bonus_in") {
    const cmaPercent = numberValue(metadata.cmaSharePercent, 8);
    const cryptoPercent = numberValue(metadata.cryptoSharePercent, 5);
    return {
      category: "mining",
      title: "Bônus de indicação recebido",
      description: `${cmaPercent}% em CMA e ${cryptoPercent}% em BTC, DOGE e LTC da mineração validada de um indicado entraram no saldo.`,
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
      )}% · DOGE ${numberValue(allocations.doge)}% · LTC ${numberValue(
        allocations.ltc,
      )}%.`,
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
  if (action === "battery_cycle_claim") {
    return {
      category: "energy",
      title: "Bateria do ciclo de 12 horas resgatada",
      description: "A bateria gratuita foi adicionada ao inventario pelo servidor.",
    };
  }
  if (action === "season_quest_claim") {
    const xp = Math.max(0, Math.floor(numberValue(metadata.xp, 0)));
    return {
      category: "arcade",
      title: "Missao da temporada concluida",
      description: `+${xp} XP registrado no passe pelo servidor.`,
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
  if (action === "season_premium_purchase") {
    const isMax = Boolean(metadata.isMax);
    const priceCma = numberValue(metadata.priceCma);
    return {
      category: "economy",
      title: isMax ? "Orbit Pass MAX adquirido" : "Orbit Pass adquirido",
      description: `O acesso premium da temporada foi liberado por ${priceCma.toLocaleString("pt-BR")} CMA.`,
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
