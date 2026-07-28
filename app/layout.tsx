import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Monte sua sala e mantenha inventário, energia, compras, pools e blocos protegidos por uma conta autoritativa.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Progresso protegido: organize racks e mine CMA, Bitcoin e Dogecoin.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og-authoritative.png",
        width: 1721,
        height: 914,
        alt: "Crypto Miner Arcadia — progresso protegido",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Progresso protegido: organize racks e mine CMA, Bitcoin e Dogecoin.",
    images: ["/og-authoritative.png"],
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
