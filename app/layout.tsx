import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Mineração virtual com blocos fixos, três pools e economia controlada pelo servidor.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "CMA, BTC e DOGE disputam blocos fixos: mais poder muda sua participação, nunca o orçamento total.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site/og-fixed-block.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — mineradores disputando um bloco fixo nas três pools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Bloco fixo, poder em disputa e economia validada pelo servidor.",
    images: [
      "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site/og-fixed-block.png",
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
