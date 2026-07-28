import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Monte sua sala, organize racks e conquiste poder temporário no primeiro minigame validado pelo servidor.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Packet Catch está online: jogue, ganhe poder temporário e fortaleça sua sala.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og-packet-catch.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — Packet Catch online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Packet Catch está online: jogue, ganhe poder temporário e fortaleça sua sala.",
    images: ["/og-packet-catch.png"],
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
