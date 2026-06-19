'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, CheckCircle, AlertCircle, Anchor, Sparkles, Brain } from 'lucide-react';
import type { MLConfidence } from '../../lib/api';

interface Projection {
  cycleLength: number;
  anchorDate?: string;
  sourceLabel?: string;
  projectedDate: string;
  adjustedDate: string;
  zoneStart?: string;
  zoneEnd?: string;
  adjustmentNote?: string;
  reactionType: string;
  confidence: number;
  indicatorConfirmation: string;
}

interface ConvergenceZone {
  startDate: string;
  endDate: string;
  score: number;
  anchorsInvolved: number;
  cycles: number[];
  explanation?: string;
  overlapDetails?: Array<{
    anchor_date: string;
    anchor_type: string;
    cycle_length: number;
    projected_date: string;
  }>;
}

interface Backtest {
  hitRate: number;
  assetHitRate?: number;
  bestCycle: number;
  worstCycle: number;
  reactionTypes: Record<string, number>;
  cycleStats?: Record<string, { hits: number; tests: number; hit_rate: number }>;
  anchorStats?: Record<string, { hits: number; tests: number; hit_rate: number }>;
  confluenceZoneStats?: Record<string, { hit_rate: number }>;
}

interface Indicators {
  rsi: string;
  macd: string;
  ma: string;
  atr: string;
  volume: string;
  overall: string;
  details?: string[];
  support?: number;
  resistance?: number;
}

interface AnchorPoint {
  date: string;
  price: number;
  anchorType: string;
}

export interface ResultsDisplayProps {
  symbol?: string;
  projections: Projection[];
  perAnchorProjections?: Record<string, Projection[]>;
  convergenceZones?: ConvergenceZone[];
  backtest?: Backtest;
  indicators?: Indicators;
  anchors?: AnchorPoint[];
  aiSummary?: string;
  selectedCycles?: number[];
  analysisMode?: 'single-anchor' | 'convergence';
  modeLabel?: string;
  toleranceDays?: number;
  analysisPeriod?: string;
  dataPoints?: number;
  lastUpdate?: string;
  backtestEnabled?: boolean;
  loading?: boolean;
  error?: string;
  onExportPng?: () => void;
  onExportPdf?: () => void;
  isExporting?: boolean;
  mlConfidence?: MLConfidence;
  researchSummary?: string;
}

export type { MLConfidence };

const skeletonVariants = {
  initial: { opacity: 0.4 },
  animate: { opacity: [0.4, 0.8, 0.4], transition: { repeat: Infinity, duration: 1.5 } },
};

const SkeletonCard = () => (
  <motion.div
    variants={skeletonVariants}
    initial="initial"
    animate="animate"
    className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20"
  >
    <div className="h-4 bg-white/20 rounded w-3/4 mb-4" />
    <div className="space-y-3">
      <div className="h-3 bg-white/20 rounded" />
      <div className="h-3 bg-white/20 rounded w-5/6" />
    </div>
  </motion.div>
);

const SkeletonTable = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        variants={skeletonVariants}
        initial="initial"
        animate="animate"
        transition={{ delay: i * 0.1 }}
        className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20"
      >
        <div className="flex gap-4">
          <div className="h-3 bg-white/20 rounded flex-1" />
          <div className="h-3 bg-white/20 rounded flex-1" />
          <div className="h-3 bg-white/20 rounded flex-1" />
        </div>
      </motion.div>
    ))}
  </div>
);

const getReactionColor = (reactionType: string): string => {
  if (reactionType.toLowerCase().includes('top')) return 'red';
  if (reactionType.toLowerCase().includes('bottom')) return 'green';
  if (reactionType.toLowerCase().includes('higher')) return 'green';
  if (reactionType.toLowerCase().includes('lower')) return 'red';
  if (reactionType.toLowerCase().includes('no reaction')) return 'gray';
  return 'cyan';
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 80) return 'from-green-500/20 to-green-600/10 border-green-500/50';
  if (confidence >= 60) return 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/50';
  if (confidence >= 40) return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/50';
  return 'from-red-500/20 to-red-600/10 border-red-500/50';
};

const getConfidenceTextColor = (confidence: number): string => {
  if (confidence >= 80) return 'text-green-400';
  if (confidence >= 60) return 'text-cyan-400';
  if (confidence >= 40) return 'text-yellow-400';
  return 'text-red-400';
};

const getConfirmationColor = (confirmation: string): string => {
  const lower = confirmation.toLowerCase();
  if (lower === 'strong') return 'bg-purple-500/20 border-purple-500/50 text-purple-300';
  if (lower === 'moderate') return 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300';
  if (lower === 'weak') return 'bg-gray-500/20 border-gray-500/50 text-gray-300';
  return 'bg-slate-500/20 border-slate-500/50 text-slate-300';
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  symbol,
  projections,
  perAnchorProjections,
  convergenceZones,
  backtest,
  indicators,
  anchors,
  aiSummary,
  selectedCycles = [],
  analysisMode = 'single-anchor',
  modeLabel,
  toleranceDays = 2,
  analysisPeriod = 'Not specified',
  dataPoints = 0,
  lastUpdate,
  backtestEnabled = false,
  loading = false,
  error,
  onExportPng,
  onExportPdf,
  isExporting = false,
  mlConfidence,
  researchSummary,
}) => {
  const sortedProjections = useMemo(() => {
    return [...projections].sort(
      (a, b) => new Date(a.projectedDate).getTime() - new Date(b.projectedDate).getTime()
    );
  }, [projections]);

  const sortedZones = useMemo(() => {
    if (!convergenceZones) return [];
    return [...convergenceZones].sort((a, b) => b.score - a.score);
  }, [convergenceZones]);

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-300 font-semibold mb-1">Analysis Error</h3>
            <p className="text-red-200/80 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <p className="text-cyan-400/70 text-sm animate-pulse">Running cycle analysis, backtest, and confluence scoring...</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonTable />
        <SkeletonTable />
      </div>
    );
  }

  if (projections.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white/5 border border-white/20 rounded-lg p-12 text-center">
          <Activity className="w-12 h-12 text-white/40 mx-auto mb-4" />
          <h3 className="text-white/80 font-semibold mb-2">No Results Yet</h3>
          <p className="text-white/60 text-sm">Enter an anchor date and click Project Cycles to see results</p>
        </div>
      </div>
    );
  }

  const topConfluence = sortedZones[0];

  return (
    <div className="w-full space-y-6">
      {/* Export branding header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div>
          <p className="text-xs text-cyan-500/80 uppercase tracking-widest">ChronoGann</p>
          {symbol && <p className="text-white font-semibold">{symbol}</p>}
        </div>
        <div className="flex gap-2">
          {onExportPng && (
            <button
              type="button"
              disabled={isExporting}
              onClick={onExportPng}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-50"
            >
              Export PNG
            </button>
          )}
          {onExportPdf && (
            <button
              type="button"
              disabled={isExporting}
              onClick={onExportPdf}
              className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
            >
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* Summary dashboard cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/70 mb-1">Anchor</p>
          <p className="text-sm font-medium text-white truncate">
            {anchors?.[0] ? formatDate(anchors[0].date) : analysisPeriod}
          </p>
          <p className="text-xs text-gray-500">{anchors?.[0]?.anchorType || '—'}</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-blue-400/70 mb-1">Cycles</p>
          <p className="text-sm font-medium text-white">{selectedCycles.length || projections.length}</p>
          <p className="text-xs text-gray-500 truncate">{selectedCycles.slice(0, 4).join(', ')}…</p>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-purple-400/70 mb-1">Mode</p>
          <p className="text-sm font-medium text-white">{modeLabel?.split('(')[0].trim() || 'Single'}</p>
          <p className="text-xs text-gray-500">±{toleranceDays}d tolerance</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-cyan-400/70 mb-1">Confluence</p>
          <p className="text-sm font-medium text-white">
            {analysisMode === 'convergence' ? sortedZones.length : '—'}
          </p>
          <p className="text-xs text-gray-500">
            {topConfluence ? `Score ${topConfluence.score.toFixed(0)}` : 'N/A'}
          </p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-green-400/70 mb-1">Backtest</p>
          <p className="text-sm font-medium text-white">
            {backtestEnabled && backtest ? `${backtest.hitRate.toFixed(0)}%` : 'Off'}
          </p>
          <p className="text-xs text-gray-500">Historical validation</p>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-[10px] uppercase tracking-wider text-violet-400/70 mb-1">Indicators</p>
          <p className="text-sm font-medium text-white">{indicators?.overall || '—'}</p>
          <p className="text-xs text-gray-500">Confirmation only</p>
        </div>
      </div>

      {/* ML Confidence Card */}
      {mlConfidence && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-emerald-400" />
            ML Reaction Confidence
          </h2>
          {!mlConfidence.available ? (
            <p className="text-sm text-gray-400">
              {mlConfidence.message || 'Train the ML model from the Research panel to enable confidence scoring.'}
            </p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-emerald-400/70 uppercase tracking-wider mb-1">Reaction Probability</p>
                <p className="text-4xl font-bold text-white">{mlConfidence.reaction_probability}%</p>
                <p className="text-sm text-emerald-300 mt-1">{mlConfidence.confidence_label}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-400/70 uppercase tracking-wider mb-1">Historical Reliability</p>
                <p className="text-3xl font-bold text-white">{mlConfidence.historical_reliability}%</p>
                <p className="text-xs text-gray-500 mt-1">Similar cycle setups</p>
              </div>
              <div>
                <p className="text-xs text-emerald-400/70 uppercase tracking-wider mb-1">Model</p>
                <p className="text-sm font-medium text-white capitalize">
                  {(mlConfidence.model_type || 'ensemble').replace('_', ' ')}
                </p>
                {mlConfidence.model_metrics && (
                  <p className="text-xs text-gray-500 mt-1">
                    F1: {((mlConfidence.model_metrics.f1 || 0) * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          )}
          {mlConfidence.available && (
            <div className="mt-5 grid sm:grid-cols-2 gap-4 pt-4 border-t border-emerald-500/20">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Strong Contributors</p>
                <ul className="space-y-1">
                  {(mlConfidence.strong_contributors || []).map((c) => (
                    <li key={c} className="text-sm text-emerald-300">+ {c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Weak Contributors</p>
                <ul className="space-y-1">
                  {(mlConfidence.weak_contributors || []).length > 0 ? (
                    mlConfidence.weak_contributors!.map((c) => (
                      <li key={c} className="text-sm text-amber-400/80">− {c}</li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-500">None significant</li>
                  )}
                </ul>
              </div>
            </div>
          )}
          {mlConfidence.disclaimer && (
            <p className="text-xs text-gray-500 mt-4 italic">{mlConfidence.disclaimer}</p>
          )}
        </motion.div>
      )}

      {/* Research Summary (primary narrative) */}
      {(researchSummary || aiSummary) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500/15 to-cyan-500/10 backdrop-blur-md rounded-lg p-5 border border-purple-500/30"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Research Summary
          </h2>
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">
            {researchSummary || aiSummary}
          </p>
        </motion.div>
      )}

      {/* Anchor Points */}
      {anchors && anchors.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
            <Anchor className="w-5 h-5 text-amber-400" />
            Anchor Points
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {anchors.map((anchor, idx) => (
              <div
                key={idx}
                className="bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white/60 text-xs uppercase">{anchor.anchorType}</p>
                    <p className="text-white font-semibold">{formatDate(anchor.date)}</p>
                  </div>
                  <p className="text-cyan-400 font-mono text-sm">${anchor.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode badge */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 border border-purple-500/40 text-purple-200">
          {modeLabel || (analysisMode === 'convergence' ? 'With Convergence' : 'Single (Without Convergence)')}
        </span>
        <span className="px-3 py-1 rounded-full text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
          Tolerance ±{toleranceDays} trading days
        </span>
      </div>

      {/* Key Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
          <p className="text-blue-300/70 text-xs uppercase tracking-wide mb-2">Selected Cycles</p>
          <p className="text-white text-2xl font-bold">{selectedCycles.length || projections.length}</p>
          <p className="text-blue-300/50 text-xs mt-1">{selectedCycles.join(', ') || 'Core set'}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-md rounded-lg p-4 border border-purple-500/30">
          <p className="text-purple-300/70 text-xs uppercase tracking-wide mb-2">Analysis Period</p>
          <p className="text-white text-2xl font-bold truncate">{analysisPeriod}</p>
          <p className="text-purple-300/50 text-xs mt-1">Time range</p>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 backdrop-blur-md rounded-lg p-4 border border-cyan-500/30">
          <p className="text-cyan-300/70 text-xs uppercase tracking-wide mb-2">Data Points</p>
          <p className="text-white text-2xl font-bold">{dataPoints.toLocaleString()}</p>
          <p className="text-cyan-300/50 text-xs mt-1">Analyzed</p>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
          <p className="text-green-300/70 text-xs uppercase tracking-wide mb-2">Last Update</p>
          <p className="text-white text-sm font-mono truncate">{lastUpdate ? formatDate(lastUpdate) : 'Now'}</p>
          <p className="text-green-300/50 text-xs mt-1">{lastUpdate ? 'Updated' : 'In progress'}</p>
        </div>
      </div>

      {/* Technical confirmation panel */}
      {indicators && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <h2 className="text-sm font-semibold text-violet-300 mb-3">Technical Confirmation (optional)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {[
              { label: 'RSI', value: indicators.rsi },
              { label: 'MACD', value: indicators.macd },
              { label: 'Moving Avg', value: indicators.ma },
              { label: 'ATR', value: indicators.atr },
              { label: 'Volume', value: indicators.volume },
              { label: 'Overall', value: indicators.overall },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-black/20 p-3 border border-white/5">
                <p className="text-gray-500 mb-1">{item.label}</p>
                <p className="text-white font-medium">{item.value}</p>
              </div>
            ))}
          </div>
          {indicators.details && indicators.details.length > 0 && (
            <ul className="mt-3 text-xs text-gray-400 space-y-1">
              {indicators.details.map((d, i) => (
                <li key={i}>• {d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Projection Cards Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Projected Cycle Dates
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white/70 font-medium">Source</th>
                <th className="text-left py-3 px-4 text-white/70 font-medium">Raw Calendar Date</th>
                <th className="text-left py-3 px-4 text-white/70 font-medium">Trading Window</th>
                <th className="text-left py-3 px-4 text-white/70 font-medium">Reaction</th>
                <th className="text-center py-3 px-4 text-white/70 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjections.map((projection, idx) => {
                const reactionColor = getReactionColor(projection.reactionType);
                const confidenceClass = getConfidenceColor(projection.confidence);
                const confidenceText = getConfidenceTextColor(projection.confidence);
                const isBullish = reactionColor === 'green';
                const isBearish = reactionColor === 'red';

                return (
                  <tr
                    key={idx}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      isBullish ? 'bg-green-500/5' : isBearish ? 'bg-red-500/5' : 'bg-gray-500/5'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className="text-white/90 text-xs block">{projection.sourceLabel || `${projection.cycleLength}d`}</span>
                    </td>
                    <td className="py-3 px-4 text-white/90 text-xs">{formatDate(projection.projectedDate)}</td>
                    <td className="py-3 px-4 text-white/70 text-xs">
                      <div>{formatDate(projection.zoneStart || projection.adjustedDate)} – {formatDate(projection.zoneEnd || projection.adjustedDate)}</div>
                      {projection.adjustmentNote && (
                        <div className="text-white/40 mt-1">{projection.adjustmentNote}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isBullish && <TrendingUp className="w-4 h-4 text-green-400" />}
                        {isBearish && <TrendingDown className="w-4 h-4 text-red-400" />}
                        <span className="text-white/90">{projection.reactionType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              projection.confidence >= 80
                                ? 'bg-green-500'
                                : projection.confidence >= 60
                                  ? 'bg-cyan-500'
                                  : projection.confidence >= 40
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                            }`}
                            style={{ width: `${projection.confidence}%` }}
                          ></div>
                        </div>
                        <span className={`font-semibold min-w-[3rem] text-right ${confidenceText}`}>
                          {projection.confidence}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Per-anchor projections (convergence mode) */}
      {analysisMode === 'convergence' && perAnchorProjections && Object.keys(perAnchorProjections).length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Projections per Anchor</h2>
          <div className="space-y-4">
            {Object.entries(perAnchorProjections).map(([anchorDate, projs]) => (
              <div key={anchorDate} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-amber-300 text-sm font-medium mb-2">Anchor: {formatDate(anchorDate)}</p>
                <div className="flex flex-wrap gap-2">
                  {projs.map((p, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-200">
                      {p.cycleLength}d raw {formatDate(p.projectedDate)} → trading {formatDate(p.zoneStart || p.adjustedDate)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convergence Zones Section */}
      {analysisMode === 'convergence' && sortedZones.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-cyan-400" />
            Confluence Zones
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedZones.map((zone, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 backdrop-blur-md rounded-lg p-5 border border-cyan-500/30 hover:border-cyan-500/50 transition-all"
              >
                <div className="space-y-3">
                  {zone.explanation && (
                    <p className="text-white/80 text-sm leading-relaxed">{zone.explanation}</p>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-cyan-300/70 text-xs uppercase tracking-wide mb-1">Zone Dates</p>
                      <p className="text-white/90 text-sm">
                        {formatDate(zone.startDate)} → {formatDate(zone.endDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-300/70 text-xs uppercase tracking-wide mb-1">Score</p>
                      <p className="text-cyan-300 text-lg font-bold">{zone.score.toFixed(1)}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-cyan-500/20 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Anchors Involved</span>
                      <span className="text-white/90 font-medium">{zone.anchorsInvolved}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Cycle Lengths</span>
                      <span className="text-white/90 font-medium">{zone.cycles.length}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-white/60 text-xs mb-2">Strength</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <div
                          key={bar}
                          className={`flex-1 h-2 rounded-full transition-all ${
                            bar <= Math.ceil((zone.score / 100) * 5) ? 'bg-cyan-400' : 'bg-white/10'
                          }`}
                        ></div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-1">
                    {zone.cycles.map((cycle) => (
                      <span
                        key={cycle}
                        className="inline-block bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 rounded px-2 py-0.5 text-xs"
                      >
                        {cycle}d
                      </span>
                    ))}
                  </div>
                  {zone.overlapDetails && zone.overlapDetails.length > 0 && (
                    <div className="pt-2 border-t border-cyan-500/20 space-y-1">
                      {zone.overlapDetails.map((o, oi) => (
                        <p key={oi} className="text-xs text-white/60">
                          {o.cycle_length}d from {o.anchor_date} ({o.anchor_type}) → {o.projected_date}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hit Rate Summary Section — only when backtest research mode enabled */}
      {backtestEnabled && backtest && (
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Historical Backtest Performance
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-md rounded-lg p-5 border border-green-500/30">
              <p className="text-green-300/70 text-xs uppercase tracking-wide mb-3">Overall Hit Rate</p>
              <p className="text-white text-4xl font-bold mb-1">{backtest.hitRate.toFixed(1)}%</p>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                  style={{ width: `${backtest.hitRate}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-md rounded-lg p-5 border border-blue-500/30">
              <p className="text-blue-300/70 text-xs uppercase tracking-wide mb-3">Best Performing Cycle</p>
              <p className="text-white text-4xl font-bold">{backtest.bestCycle}</p>
              <p className="text-blue-300/60 text-xs mt-2">days</p>
            </div>

            <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 backdrop-blur-md rounded-lg p-5 border border-red-500/30">
              <p className="text-red-300/70 text-xs uppercase tracking-wide mb-3">Worst Performing Cycle</p>
              <p className="text-white text-4xl font-bold">{backtest.worstCycle}</p>
              <p className="text-red-300/60 text-xs mt-2">days</p>
            </div>
          </div>

          {backtest.cycleStats && Object.keys(backtest.cycleStats).length > 0 && (
            <div className="bg-white/5 backdrop-blur-md rounded-lg p-5 border border-white/10 mb-4">
              <p className="text-white/70 text-xs uppercase tracking-wide mb-3">Hit Rate per Cycle</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(backtest.cycleStats).map(([cycle, stats]) => (
                  <div key={cycle} className="bg-white/5 rounded p-3 border border-white/10">
                    <p className="text-white/60 text-xs">{cycle}d</p>
                    <p className="text-white font-bold">{stats.hit_rate.toFixed(0)}%</p>
                    <p className="text-white/40 text-xs">{stats.hits}/{stats.tests}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {backtest.anchorStats && Object.keys(backtest.anchorStats).length > 0 && (
            <div className="bg-white/5 backdrop-blur-md rounded-lg p-5 border border-white/10 mb-4">
              <p className="text-white/70 text-xs uppercase tracking-wide mb-3">Hit Rate per Anchor</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(backtest.anchorStats).map(([date, stats]) => (
                  <div key={date} className="bg-white/5 rounded p-3 border border-white/10">
                    <p className="text-white/60 text-xs">{formatDate(date)}</p>
                    <p className="text-white font-bold">{stats.hit_rate.toFixed(0)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(backtest.reactionTypes).length > 0 && (
            <div className="bg-white/5 backdrop-blur-md rounded-lg p-5 border border-white/10">
              <p className="text-white/70 text-xs uppercase tracking-wide mb-4">Success by Reaction Type</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(backtest.reactionTypes).map(([type, rate]) => (
                  <div
                    key={type}
                    className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <p className="text-white/60 text-xs mb-2 truncate">{type}</p>
                    <p className="text-white font-bold text-lg">{(rate as number).toFixed(0)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Technical Confirmation Section */}
      {indicators && (
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            Indicator Confirmation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {[
              { label: 'RSI', value: indicators.rsi },
              { label: 'MACD', value: indicators.macd },
              { label: 'MA Alignment', value: indicators.ma },
              { label: 'ATR Volatility', value: indicators.atr },
              { label: 'Volume', value: indicators.volume },
            ].map((indicator) => (
              <div
                key={indicator.label}
                className="bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all"
              >
                <p className="text-white/60 text-xs uppercase tracking-wide mb-3">{indicator.label}</p>
                <div
                  className={`px-3 py-2 rounded-lg text-sm font-medium border inline-block w-full text-center ${getConfirmationColor(
                    indicator.value
                  )}`}
                >
                  {indicator.value}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-md rounded-lg p-6 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300/70 text-xs uppercase tracking-wide mb-2">Overall Confirmation Score</p>
                <p className="text-white text-3xl font-bold">{indicators.overall}</p>
              </div>
              <div
                className={`px-6 py-3 rounded-lg text-lg font-bold border ${getConfirmationColor(indicators.overall)}`}
              >
                {indicators.overall}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;
