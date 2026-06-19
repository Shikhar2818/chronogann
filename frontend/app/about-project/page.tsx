"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function AboutProject() {
  const features = [
    {
      title: "Single-Anchor Analysis",
      points: [
        "Select one historical high or low",
        "Project cycles: 30, 60, 90, 120, 180, 240, 270, 360 days",
        "Detect actual price reaction at projected dates",
        "Support custom cycle lengths",
        "Calculate historical hit rates for that specific asset",
      ],
    },
    {
      title: "Convergence Analysis",
      points: [
        "Use 4–5 major highs/lows as anchor points",
        "Project cycles from each anchor simultaneously",
        "Detect clustering/overlap of projected dates",
        "Score confluence strength",
        "Identify high-probability reversal zones",
      ],
    },
    {
      title: "Backtesting",
      points: [
        "Test cycles against historical anchor points",
        "Measure hit rate by cycle length",
        "Measure hit rate by asset type",
        "Compare single-anchor vs. convergence performance",
        "Classify reactions: Major Top, Bottom, Higher Low, Lower High, Pullback",
      ],
    },
    {
      title: "Technical Confirmation",
      points: [
        "RSI (oversold/overbought levels)",
        "MACD (bullish/bearish crossovers)",
        "Moving Averages (trend context)",
        "ATR (volatility context)",
        "Volume analysis (confirmation strength)",
      ],
    },
  ];

  const markets = [
    { name: "Indian Stocks", data: "NSE symbols via yfinance" },
    { name: "US Stocks", data: "NYSE, NASDAQ via yfinance" },
    { name: "Indices", data: "NIFTY, Sensex, S&P 500" },
    { name: "Forex Pairs", data: "EUR/USD, GBP/USD, INR/USD" },
    { name: "Commodities", data: "Gold, Oil, Natural Gas futures" },
    { name: "Crypto", data: "BTC, ETH, BNB, USDT pairs" },
  ];

  const workflow = [
    {
      step: 1,
      title: "Select Asset & Time Period",
      desc: "Choose a stock, index, currency pair, or commodity. Select the historical data range.",
    },
    {
      step: 2,
      title: "Set Anchor Date(s)",
      desc: "Enter a significant high or low date manually, or pick from auto-detected swing anchors. No chart clicking required.",
    },
    {
      step: 3,
      title: "Choose Cycle Preset",
      desc: "Select Core (8 cycles), Extended (4 cycles), Advanced (4 cycles), or define custom cycles.",
    },
    {
      step: 4,
      title: "Run Analysis",
      desc: "The system projects future dates, adjusts for weekends/holidays, and scores technical confirmation.",
    },
    {
      step: 5,
      title: "Review Results",
      desc: "See projected dates, historical hit rates, confluence scores, and indicator confirmation.",
    },
    {
      step: 6,
      title: "Export & Share",
      desc: "Export analysis as PNG image or PDF for sharing with colleagues and clients.",
    },
  ];

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-dark-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-neon-cyan hover:text-neon-cyan/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="pt-20">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-6xl mx-auto px-4 py-20"
        >
          <h1 className="text-5xl font-bold mb-6">About ChronoGann</h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            A modern platform bringing W.D. Gann's time-cycle analysis into the
            professional research and trading workflow. No signup, no fees, pure analysis.
          </p>
        </motion.section>

        {/* What It Does */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="bg-dark-900/50 py-20 px-4"
        >
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-12">What ChronoGann Does</h2>
            <p className="text-lg text-gray-300 mb-12 max-w-3xl">
              ChronoGann is a quantitative market research tool that helps you discover
              high-probability reversal dates using Gann-style time-cycle logic, historical
              backtesting, and technical confirmation.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="glass-card p-8"
                >
                  <h3 className="text-2xl font-bold mb-4 text-neon-cyan">
                    {feature.title}
                  </h3>
                  <ul className="space-y-3">
                    {feature.points.map((point, j) => (
                      <li key={j} className="flex items-start gap-3 text-gray-300">
                        <CheckCircle className="w-5 h-5 text-neon-green flex-shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Why It's Different */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="py-20 px-4"
        >
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-12">Why It's Different</h2>
            <div className="space-y-6">
              {[
                {
                  title: "Not a Stock Predictor",
                  desc: "We don't predict future prices. Instead, we identify date ranges where reversals historically occurred, based on cycle patterns.",
                },
                {
                  title: "Research-Focused, Not Trading-Focused",
                  desc: "ChronoGann is for analysis, backtesting, and understanding market behavior—not for placing live orders or managing positions.",
                },
                {
                  title: "No Black Box",
                  desc: "Every projection is transparent. You see which cycles converge, why, and the historical hit rate for that specific cycle on that specific asset.",
                },
                {
                  title: "Multi-Market",
                  desc: "Test cycles on stocks, indices, forex, commodities, and crypto. Compare which cycle lengths work best on different asset types.",
                },
                {
                  title: "Professional Grade",
                  desc: "Designed for analysts, traders, and researchers. Polished UI, fast backtesting, confidence scoring, and export functionality.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="glass-card p-8 border-l-2 border-neon-cyan"
                >
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-300">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* How It Works */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="bg-dark-900/50 py-20 px-4"
        >
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-12">Workflow</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {workflow.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="glass-card p-8"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-purple rounded-lg flex items-center justify-center font-bold text-lg">
                        {item.step}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                      <p className="text-gray-300">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Markets Supported */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="py-20 px-4"
        >
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-center">Markets & Data Sources</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {markets.map((market, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  className="glass-card p-6 text-center"
                >
                  <h4 className="font-bold text-lg mb-2">{market.name}</h4>
                  <p className="text-sm text-gray-400">{market.data}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Technical Details */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="bg-dark-900/50 py-20 px-4"
        >
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-12">Technical Details</h2>
            <div className="space-y-6">
              <div className="glass-card p-8">
                <h3 className="text-xl font-bold mb-4">Holiday & Weekend Handling</h3>
                <p className="text-gray-300 mb-4">
                  Gann cycles are measured in calendar days from the anchor date. If a raw cycle
                  date lands on a weekend or holiday, we show the nearest trading-day window.
                  Reaction tolerance: ±1, ±2, or ±3 trading days.
                </p>
              </div>
              <div className="glass-card p-8">
                <h3 className="text-xl font-bold mb-4">Cycle Presets</h3>
                <p className="text-gray-300 mb-4">
                  <strong>Core:</strong> 30, 60, 90, 120, 180, 240, 270, 360 | <strong>Extended:</strong> 45,
                  135, 225, 315 | <strong>Advanced:</strong> 72, 144, 365, 720 | <strong>Custom:</strong> User-defined
                </p>
              </div>
              <div className="glass-card p-8">
                <h3 className="text-xl font-bold mb-4">Reaction Classification</h3>
                <p className="text-gray-300">
                  <strong>Major Top:</strong> New high with reversal | <strong>Major Bottom:</strong> New low with
                  reversal | <strong>Higher Low:</strong> Upside reaction | <strong>Lower High:</strong> Downside
                  reaction | <strong>Pullback:</strong> Minor move near anchor | <strong>No Reaction:</strong> Price
                  unresponsive
                </p>
              </div>
              <div className="glass-card p-8">
                <h3 className="text-xl font-bold mb-4">Hit Rate Calculation</h3>
                <p className="text-gray-300">
                  Hit rate = (Number of Cycles with Reaction) / (Total Cycles Tested) × 100%
                  <br />
                  Broken down by cycle length and asset type for deeper insight.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* No Signup CTA */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="py-20 px-4"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Analyze?</h2>
            <p className="text-xl text-gray-300 mb-8">
              No signup. No fees. No restrictions. Start analyzing market cycles immediately.
            </p>
            <Link
              href="/analyzer"
              className="btn-primary inline-flex items-center gap-2"
            >
              Launch Analyzer
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
