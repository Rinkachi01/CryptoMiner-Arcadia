import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Interface acessível, Arcade organizado e uma Central do Operador separada no Crypto Miner Arcadia.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Minigames em primeiro plano, textos maiores e carreira organizada em uma área própria.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site/og.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — interface pixel art mais clara com três minigames, Central do Operador e controle A+",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Interface mais clara, Arcade direto e Central do Operador com abas.",
    images: [
      "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site/og.png",
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
