import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Jogue os três minigames, avance nas ligas e resgate uma bateria diária protegida pelo servidor.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Complete o Tour do Arcade e resgate uma bateria diária com validação segura do servidor.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site/og.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — bateria diária online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Tour diário, bateria protegida e minigames autoritativos.",
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
