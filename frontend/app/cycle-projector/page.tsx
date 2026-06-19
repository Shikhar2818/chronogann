'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Copy,
  Download,
  Loader2,
  Check,
  Clock,
  Layers,
  Target,
} from 'lucide-react';
import {
  api,
  ApiError,
  type ProjectorResult,
  type ProjectorAnchorResult,
  type ProjectorConvergence,
} from '../../lib/api';

const CORE_CYCLES = [30, 60, 90, 120, 180, 240, 270, 360];
const EXTENDED_CYCLES = [45, 72, 135, 144, 225, 315, 365, 720];

const MARKETS = [
  { id: 'india', label: 'India — Stocks & Indices (NSE/BSE)' },
  { id: 'us', label: 'United States — Stocks & Indices' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodity', label: 'Commodities' },
  { id: 'crypto', label: 'Crypto (24/7)' },
];

const TOLERANCE_OPTIONS = [
  { value: 0, label: 'Exact match' },
  { value: 1, label: '±1 day' },
  { value: 2, label: '±2 days' },
  { value: 3, label: '±3 days' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function buildExportText(result: ProjectorResult): string {
  const lines = [
    'ChronoGann — Cycle Date Projector',
    `Symbol: ${result.symbol || '(market benchmark)'}`,
    `Anchors: ${result.anchor_dates.join(', ')}`,
    `Market: ${result.calendar_label}`,
    `Calendar: ${result.calendar_source}`,
    `Cycles: ${result.cycles_used.join(', ')}`,
    `Tolerance: ${result.tolerance_days === 0 ? 'exact' : `±${result.tolerance_days} days`}`,
    '',
  ];

  for (const anchor of result.anchors) {
    lines.push(`--- Anchor ${anchor.anchor_index}: ${anchor.anchor_date} ---`);
    lines.push('Cycle\tRaw Date\tAdjusted\tTrading Window\tNote');
    for (const p of anchor.projections) {
      lines.push(
        `${p.cycle_length}\t${p.projected_date_str}\t${p.adjusted_date_str}\t${p.zone_start_str} – ${p.zone_end_str}\t${p.adjustment_note}`
      );
    }
    lines.push('');
  }

  if (result.convergence.length > 0) {
    lines.push('--- Convergence / Confluence ---');
    for (const c of result.convergence) {
      lines.push(
        `Date: ${c.convergence_date_str} | ${c.strength_label} | ${c.match_status} | Tolerance: ${c.tolerance_days}`
      );
      for (const o of c.overlaps) {
        lines.push(
          `  Anchor ${o.anchor_index} (${o.anchor_date}): ${o.cycle_length}-day → ${o.projected_date_str}`
        );
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function AnchorProjectionsTable({ anchor }: { anchor: ProjectorAnchorResult }) {
  return (
    <>
      <div className="hidden md:block rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.04] text-left text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3">Cycle</th>
              <th className="px-4 py-3">Raw Date</th>
              <th className="px-4 py-3">Adjusted</th>
              <th className="px-4 py-3">Trading Window</th>
              <th className="px-4 py-3">Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {anchor.projections.map((p) => (
              <tr
                key={p.cycle_length}
                className={`border-t border-white/5 ${p.is_future ? 'bg-cyan-500/[0.04]' : ''}`}
              >
                <td className="px-4 py-3 font-semibold text-cyan-300">{p.cycle_length} days</td>
                <td className="px-4 py-3 text-white font-mono">{p.projected_date_str}</td>
                <td className="px-4 py-3 text-emerald-300 font-mono">{p.adjusted_date_str}</td>
                <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                  {p.zone_start_str} → {p.zone_end_str}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">{p.adjustment_note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {anchor.projections.map((p) => (
          <div
            key={p.cycle_length}
            className={`rounded-xl border p-4 ${
              p.is_future
                ? 'border-cyan-500/30 bg-cyan-500/[0.06]'
                : 'border-white/10 bg-white/[0.02]'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-lg font-bold text-cyan-300">{p.cycle_length}-day</span>
              {p.is_future && (
                <span className="text-[10px] uppercase tracking-wider text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded">
                  Upcoming
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Raw</p>
                <p className="font-mono text-white">{p.projected_date_str}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Adjusted</p>
                <p className="font-mono text-emerald-300">{p.adjusted_date_str}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-xs">Trading window</p>
                <p className="font-mono text-gray-300 text-xs">
                  {p.zone_start_str} → {p.zone_end_str}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{p.adjustment_note}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function ConvergenceCard({ zone }: { zone: ProjectorConvergence }) {
  const isTriple = zone.strength === 'triple';
  return (
    <div
      className={`rounded-xl border p-5 ${
        isTriple
          ? 'border-purple-500/40 bg-purple-500/[0.08]'
          : 'border-amber-500/30 bg-amber-500/[0.06]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Converging Date</p>
          <p className="text-2xl font-bold font-mono text-white">{zone.convergence_date_str}</p>
          <p className="text-sm text-emerald-300 font-mono mt-1">
            Adjusted: {zone.adjusted_date_str}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            Window: {zone.zone_start_str} → {zone.zone_end_str}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold ${
              isTriple
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {zone.strength_label}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${
              zone.match_status === 'exact'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-orange-500/15 text-orange-300'
            }`}
          >
            {zone.match_status === 'exact' ? 'Exact match' : `Near match (±${zone.spread_days}d)`}
          </span>
          <span className="text-[10px] text-gray-500">
            Tolerance: {zone.tolerance_days === 0 ? 'exact' : `±${zone.tolerance_days} days`}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {zone.overlaps.map((o, i) => (
          <div
            key={`${o.anchor_index}-${o.cycle_length}-${i}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm rounded-lg bg-black/30 px-3 py-2"
          >
            <span className="text-cyan-400 font-semibold">Anchor {o.anchor_index}</span>
            <span className="text-gray-400 font-mono text-xs">{o.anchor_date}</span>
            <span className="text-gray-500">→</span>
            <span className="text-white font-semibold">{o.cycle_length}-day</span>
            <span className="text-gray-500">→</span>
            <span className="font-mono text-white">{o.projected_date_str}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CycleProjectorPage() {
  const [anchorCount, setAnchorCount] = useState<1 | 2 | 3>(1);
  const [anchorDates, setAnchorDates] = useState<string[]>(['', '', '']);
  const [symbol, setSymbol] = useState('');
  const [marketType, setMarketType] = useState('india');
  const [selectedCycles, setSelectedCycles] = useState<number[]>([...CORE_CYCLES]);
  const [customCycle, setCustomCycle] = useState('');
  const [showExtended, setShowExtended] = useState(false);
  const [toleranceDays, setToleranceDays] = useState(0);
  const [futureOnly, setFutureOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectorResult | null>(null);
  const [copied, setCopied] = useState(false);

  const allCycleOptions = useMemo(
    () => [...new Set([...CORE_CYCLES, ...(showExtended ? EXTENDED_CYCLES : [])])].sort((a, b) => a - b),
    [showExtended]
  );

  const activeAnchors = anchorDates.slice(0, anchorCount);

  const setAnchorDate = (index: number, value: string) => {
    setAnchorDates((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const toggleCycle = (c: number) => {
    setSelectedCycles((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].sort((a, b) => a - b)
    );
  };

  const addCustomCycle = () => {
    const n = parseInt(customCycle, 10);
    if (n > 0 && !selectedCycles.includes(n)) {
      setSelectedCycles((prev) => [...prev, n].sort((a, b) => a - b));
    }
    setCustomCycle('');
  };

  const handleProject = useCallback(async () => {
    const dates = activeAnchors.map((d) => d.trim()).filter(Boolean);
    if (dates.length < anchorCount) {
      setError(`Enter all ${anchorCount} anchor date${anchorCount > 1 ? 's' : ''}.`);
      return;
    }
    if (selectedCycles.length === 0) {
      setError('Select at least one cycle length.');
      return;
    }
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await api.projectCycles({
        symbol: symbol.trim(),
        anchor_dates: dates,
        market_type: marketType,
        selected_cycles: selectedCycles,
        tolerance_days: toleranceDays,
        future_only: futureOnly,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Projection failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [activeAnchors, anchorCount, symbol, marketType, selectedCycles, toleranceDays, futureOnly]);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(buildExportText(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([buildExportText(result)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChronoGann-projector-${result.anchor_dates.join('_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#050508]">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050508]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <h1 className="text-sm sm:text-base font-semibold text-white">Cycle Date Projector</h1>
          <Link href="/analyzer" className="text-xs text-gray-400 hover:text-cyan-300 shrink-0">
            Full Analyzer →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-cyan-400/70 text-xs uppercase tracking-[0.2em] mb-2">
            Gann Calendar-Day Projection
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Cycle Date Projector</h2>
          <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
            Project cycle landing dates from 1, 2, or 3 anchor dates using exact calendar-day math.
            With multiple anchors, the page detects convergence where projected dates align.
          </p>
        </motion.section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
          {/* Anchor count selector */}
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider block mb-3">
              Number of Anchor Dates
            </span>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAnchorCount(n)}
                  className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    anchorCount === n
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {n} Date{n > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Market / calendar */}
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider block mb-3">
              Calendar / Market Selection
            </span>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs text-gray-500">Symbol (optional)</span>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. RELIANCE, AAPL, BTC-USD"
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:outline-none"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-gray-500">Market / Region</span>
                <select
                  value={marketType}
                  onChange={(e) => setMarketType(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  {MARKETS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Dynamic anchor date inputs */}
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider block mb-3">
              Anchor Date{anchorCount > 1 ? 's' : ''}
            </span>
            <div className={`grid gap-3 ${anchorCount > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : ''}`}>
              {Array.from({ length: anchorCount }, (_, i) => (
                <label key={i} className="block space-y-1.5">
                  <span className="text-xs text-gray-500">Anchor {i + 1}</span>
                  <input
                    type="date"
                    value={anchorDates[i]}
                    onChange={(e) => setAnchorDate(i, e.target.value)}
                    max="2099-12-31"
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-white focus:border-cyan-500/50 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Convergence tolerance — only for 2+ anchors */}
          {anchorCount >= 2 && (
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wider block mb-3">
                Convergence Tolerance
              </span>
              <div className="flex flex-wrap gap-2">
                {TOLERANCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setToleranceDays(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      toleranceDays === opt.value
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cycle selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                Cycle Lengths (calendar days)
              </span>
              <button
                type="button"
                onClick={() => setShowExtended((s) => !s)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                {showExtended ? 'Hide extended' : 'Show extended cycles'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allCycleOptions.map((c) => {
                const active = selectedCycles.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCycle(c)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {c}d
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                type="number"
                min={1}
                value={customCycle}
                onChange={(e) => setCustomCycle(e.target.value)}
                placeholder="Custom days"
                className="w-32 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={addCustomCycle}
                className="px-3 py-2 rounded-lg text-sm border border-white/10 text-gray-300 hover:bg-white/5"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setSelectedCycles([...CORE_CYCLES])}
                className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300"
              >
                Reset to core
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={futureOnly}
              onChange={(e) => setFutureOnly(e.target.checked)}
              className="rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span className="text-sm text-gray-300">
              Show only future dates (relative to today, {todayStr()})
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleProject}
            disabled={loading}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Projecting…
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Project Dates
              </>
            )}
          </button>
        </section>

        {result && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Summary */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: 'Anchors',
                  value: result.anchor_dates.join(', '),
                  icon: Calendar,
                },
                {
                  label: 'Market',
                  value: result.calendar_label,
                  icon: Layers,
                },
                {
                  label: 'Projections',
                  value: String(result.projection_count),
                  icon: Clock,
                },
                {
                  label: 'Convergence',
                  value:
                    result.anchor_count >= 2
                      ? String(result.convergence_count)
                      : 'N/A',
                  icon: Target,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-1">
                    <Icon className="w-3 h-3" />
                    {label}
                  </div>
                  <p className="text-white font-semibold truncate text-sm">{value}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500">
              Calendar source: {result.calendar_source}
              {result.anchor_count >= 2 &&
                ` · Tolerance: ${result.tolerance_days === 0 ? 'exact' : `±${result.tolerance_days} days`}`}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copied' : 'Copy dates'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5"
              >
                <Download className="w-4 h-4" />
                Export .txt
              </button>
            </div>

            {/* Convergence section */}
            {result.anchor_count >= 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  Convergence / Confluence
                </h3>
                {result.convergence.length === 0 ? (
                  <p className="text-sm text-gray-400 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center">
                    No converging dates found with the current tolerance. Try widening to ±1 or ±2 days.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {result.convergence.map((zone, i) => (
                      <ConvergenceCard key={`${zone.convergence_date_str}-${i}`} zone={zone} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Per-anchor projections */}
            {result.anchors.map((anchor) => (
              <div key={anchor.anchor_index} className="space-y-3">
                <h3 className="text-base font-semibold text-white">
                  Anchor {anchor.anchor_index}
                  <span className="text-gray-400 font-normal ml-2 font-mono text-sm">
                    {anchor.anchor_date}
                  </span>
                </h3>
                {anchor.projections.length === 0 ? (
                  <p className="text-sm text-gray-500">No projections match the future-only filter.</p>
                ) : (
                  <AnchorProjectionsTable anchor={anchor} />
                )}
              </div>
            ))}
          </motion.section>
        )}
      </main>
    </div>
  );
}
