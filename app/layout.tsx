import type { Metadata, Viewport } from "next";
import "./globals.css";

const publicBaseUrl =
  process.env.PUBLIC_BASE_URL ??
  "https://crypto-miner-arcadia.criptomineracardia.workers.dev";
const publicIndexingEnabled =
  process.env.PUBLIC_INDEXING_ENABLED?.trim().toLowerCase() === "true";

export const metadata: Metadata = {
  metadataBase: new URL(publicBaseUrl),
  title: "Crypto Miner Arcadia",
  description:
    "Mineração virtual com seis salas, blocos fixos, quatro pools e economia controlada pelo servidor.",
  robots: {
    follow: publicIndexingEnabled,
    index: publicIndexingEnabled,
    noarchive: !publicIndexingEnabled,
  },
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Salas de mineração, energia, Arcade e progressão medidos pelo servidor.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — salas, energia, pools e Arcade",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Mineração virtual com progressão, energia, pools globais e Arcade.",
    images: ["/og.png"],
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
