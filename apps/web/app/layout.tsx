import type { Metadata } from "next";
import { Instrument_Serif, Space_Grotesk } from "next/font/google";
import { LINKU_PRODUCT_NAME, LINKU_TAGLINE } from "@linku/config";
import { siteEnv } from "@/lib/site";
import "./globals.css";

const displayFont = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteEnv.siteUrl),
  title: {
    default: LINKU_PRODUCT_NAME,
    template: `%s | ${LINKU_PRODUCT_NAME}`,
  },
  description: LINKU_TAGLINE,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>{children}</body>
    </html>
  );
}
