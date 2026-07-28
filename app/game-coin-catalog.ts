export type GameCoinId =
  | "usdt"
  | "doge"
  | "trx"
  | "xrp"
  | "matic"
  | "ltc"
  | "bnb"
  | "eth"
  | "sol"
  | "xmr"
  | "cma"
  | "btc";

export type GameCoin = {
  id: GameCoinId;
  symbol: string;
  name: string;
  asset: string;
  points: number;
  weight: number;
};

export const gameCoins: GameCoin[] = [
  {
    id: "usdt",
    symbol: "USDT",
    name: "Tether",
    asset: "/assets/coins/usdt.png",
    points: 4,
    weight: 15,
  },
  {
    id: "doge",
    symbol: "DOGE",
    name: "Dogecoin",
    asset: "/assets/coins/doge.svg",
    points: 5,
    weight: 14,
  },
  {
    id: "trx",
    symbol: "TRX",
    name: "TRON",
    asset: "/assets/coins/trx.png",
    points: 6,
    weight: 12,
  },
  {
    id: "xrp",
    symbol: "XRP",
    name: "XRP",
    asset: "/assets/coins/xrp.svg",
    points: 7,
    weight: 11,
  },
  {
    id: "matic",
    symbol: "MATIC",
    name: "Polygon",
    asset: "/assets/coins/matic.svg",
    points: 8,
    weight: 10,
  },
  {
    id: "ltc",
    symbol: "LTC",
    name: "Litecoin",
    asset: "/assets/coins/ltc.svg",
    points: 9,
    weight: 9,
  },
  {
    id: "bnb",
    symbol: "BNB",
    name: "BNB",
    asset: "/assets/coins/binance.png",
    points: 10,
    weight: 8,
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    asset: "/assets/coins/ethereum.png",
    points: 12,
    weight: 7,
  },
  {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    asset: "/assets/coins/solana.png",
    points: 13,
    weight: 6,
  },
  {
    id: "xmr",
    symbol: "XMR",
    name: "Monero",
    asset: "/assets/coins/xmr.svg",
    points: 14,
    weight: 5,
  },
  {
    id: "cma",
    symbol: "CMA",
    name: "Crypto Miner Arcadia",
    asset: "/assets/brand/cma-coin.png",
    points: 16,
    weight: 4,
  },
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    asset: "/assets/coins/btc.svg",
    points: 18,
    weight: 3,
  },
];

export function getGameCoin(id: string) {
  return gameCoins.find((coin) => coin.id === id);
}
