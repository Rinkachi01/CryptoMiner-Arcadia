import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://crypto-miner-arcadia-game.mateusmoraes12345678.chatgpt.site",
  ),
  title: "Crypto Miner Arcadia",
  description:
    "Monte sua sala, divida o poder entre CMA, Bitcoin e Dogecoin e mantenha sua mineração virtual energizada.",
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Divida, mine e evolua: CMA, Bitcoin e Dogecoin em blocos de 10 minutos.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og-multimining.png",
        width: 1727,
        height: 911,
        alt: "Crypto Miner Arcadia — divida, mine e evolua",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Divida, mine e evolua: CMA, Bitcoin e Dogecoin em blocos de 10 minutos.",
    images: ["/og-multimining.png"],
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
