"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, TrendingUp, Zap, Database, Share2 } from "lucide-react";

export default function Home() {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const features = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Single & Convergence Analysis",
      description:
        "Project cycles from one anchor or detect confluence from multiple historical highs and lows",
    },
    {
      icon: <Database className="w-8 h-8" />,
      title: "Comprehensive Backtesting",
      description:
        "Test cycle effectiveness against historical data, calculate hit rates, and measure reliability",
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Technical Confirmation",
      description:
        "RSI, MACD, Moving Averages, and ATR overlay to confirm or reject cycle signals",
    },
    {
      icon: <Share2 className="w-8 h-8" />,
      title: "Export & Save",
      description:
        "Export analyses as branded PNG images or PDFs for sharing with colleagues and clients",
    },
  ];

  const markets = [
    { name: "Stocks", symbols: "NSE, NYSE, NASDAQ" },
    { name: "Indices", symbols: "NIFTY, Sensex, S&P 500" },
    { name: "Forex", symbols: "EUR/USD, GBP/USD, INR/USD" },
    { name: "Crypto", symbols: "BTC, ETH, BNB" },
    { name: "Commodities", symbols: "Gold, Oil, Natural Gas" },
  ];

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-dark-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold gradient-text">ChronoGann</div>
          <div className="flex gap-4">
            <Link
              href="/cycle-projector"
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-800 transition-colors"
            >
              Projector
            </Link>
            <Link
              href="/analyzer"
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-800 transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/about-gann"
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-800 transition-colors"
            >
              About Gann
            </Link>
            <Link
              href="/about-project"
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-800 transition-colors"
            >
              About Project
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        initial="initial"
        animate="animate"
        variants={stagger}
        className="min-h-screen flex items-center justify-center pt-20 px-4"
      >
        <div className="max-w-6xl mx-auto text-center">
          <motion.h1
            variants={fadeIn}
            className="text-6xl md:text-7xl font-bold mb-6 leading-tight"
          >
            Analyze Market <br />
            <span className="gradient-text">Time Cycles</span>
          </motion.h1>

          <motion.p
            variants={fadeIn}
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto"
          >
            Discover high-probability reversal zones using Gann-style time-cycle
            analysis, backtesting, and technical confirmation.
          </motion.p>

          <motion.p
            variants={fadeIn}
            className="text-lg text-neon-cyan font-semibold mb-12"
          >
            Find the dates that matter.
          </motion.p>

          <motion.div
            variants={fadeIn}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/analyzer"
              className="btn-primary flex items-center justify-center gap-2 group"
            >
              Start Analyzing
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/cycle-projector"
              className="px-6 py-3 rounded-lg font-semibold text-gray-100 border border-gray-600 hover:border-neon-cyan hover:text-neon-cyan transition-all duration-200"
            >
              Cycle Date Projector
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="py-20 px-4 bg-dark-900/50"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            Premium Analysis Tools
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="glass-card p-8 hover:shadow-neon transition-all duration-300"
              >
                <div className="text-neon-cyan mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Market Coverage */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="py-20 px-4"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            Market Coverage
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">
            {markets.map((market, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className="glass-card p-6 text-center hover:border-neon-cyan/50 transition-colors"
              >
                <h4 className="font-bold text-lg mb-2">{market.name}</h4>
                <p className="text-sm text-gray-400">{market.symbols}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="py-20 px-4 bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Analyze?</h2>
          <p className="text-xl text-gray-300 mb-8">
            No signup required. Start analyzing market cycles immediately.
          </p>
          <Link
            href="/analyzer"
            className="btn-primary inline-flex items-center justify-center gap-2 group text-lg"
          >
            Launch Analyzer
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center text-gray-400">
          <p className="mb-4">ChronoGann &copy; 2026 - Time-Cycle Market Intelligence</p>
          <div className="flex justify-center gap-6">
            <Link href="/about-gann" className="hover:text-neon-cyan transition-colors">
              About Gann
            </Link>
            <Link href="/about-project" className="hover:text-neon-cyan transition-colors">
              About Project
            </Link>
            <Link href="/methodology" className="hover:text-neon-cyan transition-colors">
              Methodology
            </Link>
            <Link href="/cycle-projector" className="hover:text-neon-cyan transition-colors">
              Cycle Projector
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
