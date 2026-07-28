import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Mineração virtual com blocos fixos, três pools, Central de Tarefas e economia controlada pelo servidor.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Central de Tarefas, feedback beta e mineração em blocos fixos nas pools CMA, BTC e DOGE.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site/og-tasks-beta.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — Central de Tarefas em um laboratório pixel art",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Nova Central de Tarefas e canal direto de feedback do beta.",
    images: [
      "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site/og-tasks-beta.png",
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080b11",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
