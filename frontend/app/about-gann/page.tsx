"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Compass, Sparkles } from "lucide-react";

export default function AboutGann() {
  const timeline = [
    { year: "1878", event: "William Delbert Gann born in Lufkin, Texas" },
    { year: "1908", event: "Begins trading cotton futures in Kansas City" },
    { year: "1920s", event: "Develops time-cycle and geometric market analysis" },
    { year: "1927", event: "Publishes Tunnel Thru the Air" },
    { year: "1940", event: "Publishes How to Make Profits in Commodities" },
    { year: "1949", event: "45 Years in Wall Street — autobiography and case studies" },
    { year: "1955", event: "Passes away; methods continue to influence traders worldwide" },
  ];

  const concepts = [
    {
      icon: <Clock className="w-5 h-5" />,
      title: "Time Cycles",
      description:
        "Markets move in recurring time intervals. Gann studied periods such as 30, 60, 90, 120, 180, and 360 days as windows where turning points were more likely.",
    },
    {
      icon: <Compass className="w-5 h-5" />,
      title: "Square of Nine",
      description:
        "A mathematical spiral grid linking price and time through geometry — used to identify support, resistance, and probable reversal zones.",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "Angles & Geometry",
      description:
        "Gann projected price movement along geometric angles (45°, 60°, and others), treating market structure as measurable rather than random.",
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: "Anchor Highs & Lows",
      description:
        "Every significant high or low became a time anchor. From that date, future cycle dates could be projected forward for research.",
    },
    {
      title: "Convergence",
      description:
        "When multiple cycle projections from different anchors landed near the same date, Gann treated the overlap as a higher-probability time window.",
    },
    {
      title: "Calendar Time",
      description:
        "ChronoGann projects cycles using calendar days from the anchor, then adjusts to real trading sessions when a raw date falls on a weekend or holiday.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-gray-100">
      <nav className="fixed w-full top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <Link href="/analyzer" className="text-sm px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">
            Open Analyzer
          </Link>
        </div>
      </nav>

      {/* Full-tab hero with blended portrait */}
      <section className="relative min-h-[88vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/wd-gann.png"
            alt="William Delbert Gann"
            fill
            priority
            className="object-cover object-[center_20%] scale-105 opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/30 via-[#050508]/70 to-[#050508]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050508] via-transparent to-[#050508]/80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,212,255,0.12),transparent_50%)]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16 pt-32 w-full">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <p className="text-cyan-400/80 text-sm uppercase tracking-[0.25em] mb-4">1878 — 1955</p>
            <h1 className="text-5xl sm:text-7xl font-bold mb-6 leading-tight">
              William Delbert
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">Gann</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
              Trader, mathematician, and author who devoted his life to the study of time, geometry,
              and recurring market cycles. His work remains the foundation of modern Gann time-cycle research.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Life overview */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl font-bold mb-6">The Man Behind the Method</h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                <strong className="text-white">W.D. Gann</strong> began his career in cotton futures and spent decades
                observing how markets responded at specific time intervals after major highs and lows.
              </p>
              <p>
                He combined mathematics, ancient number theory, and mechanical market study — controversial in his era,
                but remarkably influential today. His books, including <em>Tunnel Thru the Air</em> and{" "}
                <em>How to Make Profits in Commodities</em>, documented his approach to time and price.
              </p>
              <p>
                Gann did not treat markets as random. He believed time governed price — that the calendar itself
                held the key to when reversals were most likely to appear.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-8"
          >
            <h3 className="text-xl font-semibold text-cyan-300 mb-4">Legacy at a Glance</h3>
            <ul className="space-y-3 text-gray-300">
              {[
                "Pioneered time-cycle analysis tied to anchor highs and lows",
                "Developed geometric tools including the Square of Nine",
                "Published forecasts and trading courses for decades",
                "Influenced generations of technical and cycle analysts",
                "Methods still studied across stocks, commodities, and indices",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-cyan-400 mt-1">◆</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Timeline with portrait top-left */}
      <section className="py-20 px-4 bg-[#08080f]/80">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Timeline</h2>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-10 overflow-hidden">
            <div className="float-left mr-6 mb-4 w-36 sm:w-44 shrink-0">
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-cyan-500/30 shadow-[0_0_40px_rgba(0,212,255,0.15)]">
                <Image
                  src="/images/wd-gann.png"
                  alt="W.D. Gann portrait"
                  fill
                  className="object-cover object-top"
                />
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">W.D. Gann</p>
            </div>

            <div className="space-y-6">
              {timeline.map((item, i) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-4 clear-none"
                >
                  <div className="text-cyan-400 font-bold text-lg min-w-[4rem]">{item.year}</div>
                  <div className="text-gray-300 pb-4 border-b border-white/5 flex-1">{item.event}</div>
                </motion.div>
              ))}
            </div>
            <div className="clear-both" />
          </div>
        </div>
      </section>

      {/* Core concepts */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Core Concepts</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {concepts.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6 hover:border-cyan-500/30 transition-colors"
              >
                {c.icon && <div className="text-cyan-400 mb-3">{c.icon}</div>}
                <h3 className="text-lg font-semibold text-white mb-2">{c.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{c.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20 px-4 bg-[#08080f]/50">
        <div className="max-w-4xl mx-auto rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-cyan-500/5 p-10">
          <h2 className="text-3xl font-bold mb-6">Philosophy</h2>
          <p className="text-gray-300 mb-6 leading-relaxed">
            Gann argued that markets follow natural law — the same mathematical order found in astronomy,
            geometry, and physics. His core beliefs:
          </p>
          <ol className="space-y-4 text-gray-300">
            <li><strong className="text-white">Time and price are connected</strong> — major moves occur at specific time intervals.</li>
            <li><strong className="text-white">Geometry governs structure</strong> — patterns can be measured and projected.</li>
            <li><strong className="text-white">History repeats in time</strong> — past anchors seed future cycle windows.</li>
            <li><strong className="text-white">Convergence strengthens probability</strong> — overlapping cycles mark stronger zones.</li>
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Apply Gann&apos;s Time Logic</h2>
        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
          ChronoGann projects calendar-day cycles from your anchor dates, detects convergence,
          and optionally validates with backtesting — a research tool, not a price predictor.
        </p>
        <Link
          href="/analyzer"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
        >
          Start Analyzing
        </Link>
      </section>
    </div>
  );
}
