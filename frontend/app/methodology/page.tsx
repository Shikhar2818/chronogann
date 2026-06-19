"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-gray-100">
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-4">ChronoGann Methodology</h1>
        <p className="text-gray-400 mb-12 leading-relaxed">
          How the platform applies Gann time-cycle research — transparent, date-driven, and non-predictive.
        </p>

        <div className="space-y-10">
          {[
            {
              title: "1. Anchor Date",
              body: "You provide a significant high or low date, or select from auto-detected swing points. This anchor is day zero for all projections.",
            },
            {
              title: "2. Calendar-Day Cycles",
              body: "Cycles (30, 60, 90, 120, 180, 240, 270, 360, etc.) are added as calendar days from the anchor. Example: 2025-04-07 + 360 days = 2026-04-02.",
            },
            {
              title: "3. Trading-Day Adjustment",
              body: "If the raw date falls on a weekend or exchange holiday, the app shows the nearest previous and next trading sessions as the valid reaction window.",
            },
            {
              title: "4. Single vs Convergence",
              body: "Single mode projects from one anchor. Convergence mode projects from multiple anchors independently, then finds dates where cycles overlap within your tolerance window.",
            },
            {
              title: "5. Reaction Classification",
              body: "For past dates, price action near the window is classified as Major Top/Bottom, Higher Low, Lower High, Pullback, or No Reaction.",
            },
            {
              title: "6. Technical Confirmation",
              body: "RSI, MACD, moving averages, ATR, and volume may confirm a setup — they never create or move cycle dates.",
            },
            {
              title: "7. Backtest (Research)",
              body: "Optional historical validation using the same cycle math. Hit rates are reported per cycle length, anchor, and confluence zone.",
            },
          ].map((section) => (
            <section key={section.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-xl font-semibold text-cyan-300 mb-2">{section.title}</h2>
              <p className="text-gray-400 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/analyzer"
            className="inline-block px-8 py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400"
          >
            Try the Analyzer
          </Link>
        </div>
      </main>
    </div>
  );
}
