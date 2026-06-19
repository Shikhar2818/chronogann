import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChronoGann - Time-Cycle Market Intelligence",
  description:
    "Analyze market cycles with time, confluence, and backtesting. Find the dates that matter.",
  keywords: [
    "market analysis",
    "gann cycles",
    "time cycles",
    "backtesting",
    "technical analysis",
    "trading",
  ],
  authors: [{ name: "ChronoGann" }],
  openGraph: {
    title: "ChronoGann - Time-Cycle Market Intelligence",
    description:
      "Analyze market cycles with time, confluence, and backtesting. Find the dates that matter.",
    type: "website",
    url: "https://chronogann.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased scroll-smooth`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <meta name="theme-color" content="#0f0f0f" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen flex flex-col bg-dark-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
