import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Organize racks, instale mineradores e jogue três minigames validados pelo servidor.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Três minigames online: Packet Catch, Hash Match e Circuit Rush com progressão autoritativa.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og-arcade-v3.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — três minigames online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Packet Catch, Hash Match e Circuit Rush com dificuldade progressiva.",
    images: ["/og-arcade-v3.png"],
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
