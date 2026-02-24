import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = 'https://texasporker-production.up.railway.app';

export const metadata: Metadata = {
  title: '澳門皇家撲克 | Macau Royal Poker',
  description: '免費線上德州撲克遊戲 — AI對戰、每日獎勵、排行榜競技。立即加入澳門皇家撲克！',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: '澳門皇家撲克 | Macau Royal Poker',
    description: '🃏 免費線上德州撲克 — AI智能對戰、每日獎勵、連續登入禮金、全球排行榜。立即加入！',
    siteName: '澳門皇家撲克',
    locale: 'zh_TW',
    type: 'website',
    images: [{
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: '澳門皇家撲克 - Texas Hold\'em',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '澳門皇家撲克 | Macau Royal Poker',
    description: '🃏 免費線上德州撲克 — AI智能對戰、每日獎勵、排行榜競技',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="zh-TW">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700&family=Playfair+Display:wght@400;700&family=Roboto+Mono:wght@500&family=Spline+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
          <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </head>
        <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} bg-[#1a1a1a] text-white overflow-x-hidden antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
