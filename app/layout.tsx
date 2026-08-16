import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "./i18n";

const publicBaseUrl =
  process.env.PUBLIC_BASE_URL ??
  "https://cryptominerarcadia.com";
const publicIndexingEnabled =
  process.env.PUBLIC_INDEXING_ENABLED?.trim().toLowerCase() === "true";

export const metadata: Metadata = {
  metadataBase: new URL(publicBaseUrl),
  alternates: {
    canonical: "/",
  },
  title: "Crypto Miner Arcadia",
  description:
    "Virtual mining with six rooms, fixed blocks, four pools, and a server-controlled economy.",
  robots: {
    follow: publicIndexingEnabled,
    index: publicIndexingEnabled,
    noarchive: !publicIndexingEnabled,
  },
  other: {
    "bitmedia-site-verification": "ba3dc562b6b7ef271be834d1a5e0b04d",
    coinzilla: "ca715cdb144abc5b2c1d3dd5bd682363",
  },
  icons: {
    icon: "/assets/brand/cma-coin.png",
    shortcut: "/assets/brand/cma-coin.png",
  },
  openGraph: {
    title: "Crypto Miner Arcadia",
    description:
      "Mining rooms, energy, Arcade games, and progress measured by the server.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-arcade-v3.png",
        width: 1672,
        height: 941,
        alt: "Crypto Miner Arcadia — mining rooms, energy, pools, and Arcade",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Miner Arcadia",
    description:
      "Virtual mining with progress, energy, global pools, and Arcade games.",
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
    <html lang="en">
      <head>
        <meta
          name="bitmedia-site-verification"
          content="ba3dc562b6b7ef271be834d1a5e0b04d"
        />
        <meta
          name="coinzilla"
          content="ca715cdb144abc5b2c1d3dd5bd682363"
        />
      </head>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
