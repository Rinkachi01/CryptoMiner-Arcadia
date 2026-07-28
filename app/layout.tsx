import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Organize sua sala, instale mineradores e conquiste poder temporário nos minigames validados pelo servidor.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Coin Arcade online: sobreviva à chuva de moedas no Packet Catch e encontre pares no Hash Match.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og-coin-arcade.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — Coin Arcade online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Coin Arcade online: Packet Catch e Hash Match com progressão de dificuldade.",
    images: ["/og-coin-arcade.png"],
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
