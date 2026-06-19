import type { AnalyzerFormData } from '../app/analyzer/AnalyzerForm';
import type { ResultsDisplayProps } from '../app/analyzer/ResultsDisplay';
import type { AnalyzeRequest, MLConfidence } from './api';

export interface AIContextPayload {
  symbol: string;
  projections: Record<string, unknown>[];
  anchors?: Record<string, unknown>[];
  confluence_zones?: Record<string, unknown>[];
  backtest_results?: Record<string, unknown> | null;
  indicator_confirmation?: Record<string, unknown> | null;
  ml_confidence?: Record<string, unknown> | null;
  analysis_mode: string;
  per_anchor_projections?: Record<string, Record<string, unknown>[]>;
  tolerance_days: number;
  cycles_used?: number[];
}

export function buildAIContextPayload(
  response: Record<string, unknown>,
  form: AnalyzerFormData
): AIContextPayload {
  return {
    symbol: (response.symbol as string) || form.symbol,
    projections: (response.projections as Record<string, unknown>[]) || [],
    anchors: (response.anchors as Record<string, unknown>[]) || [],
    confluence_zones: (response.confluence_zones as Record<string, unknown>[]) || [],
    backtest_results: (response.backtest_results as Record<string, unknown>) || null,
    indicator_confirmation: (response.indicator_confirmation as Record<string, unknown>) || null,
    ml_confidence: (response.ml_confidence as Record<string, unknown>) || null,
    analysis_mode: form.analysisMode,
    per_anchor_projections: (response.per_anchor_projections as Record<string, Record<string, unknown>[]>) || {},
    tolerance_days: (response.tolerance_days as number) || form.toleranceWindow,
    cycles_used: (response.cycles_used as number[]) || [],
  };
}

const PRESET_MAP: Record<string, string> = {
  core: 'Core',
  extended: 'Extended',
  advanced: 'Advanced',
  custom: 'Custom',
};

export function formDataToAnalyzeRequest(form: AnalyzerFormData): AnalyzeRequest {
  const includeIndicators = Object.values(form.indicators).some(Boolean);

  const request: AnalyzeRequest = {
    symbol: form.symbol,
    anchor_mode: form.anchorMode,
    cycle_preset: PRESET_MAP[form.cyclePreset] || 'Core',
    custom_cycles: form.cyclePreset === 'custom' ? form.customCycles : undefined,
    analysis_mode: form.analysisMode,
    tolerance_days: form.toleranceWindow,
    include_indicators: includeIndicators,
    run_backtest: form.runBacktest,
    include_ml: true,
    forward_days: 730,
  };

  if (form.anchorMode === 'manual-date') {
    if (form.analysisMode === 'convergence' && form.convergenceDates.length > 0) {
      request.anchor_dates = form.convergenceDates;
    } else if (form.anchorDate) {
      request.anchor_date = form.anchorDate;
    }
  } else if (form.selectedAutoAnchors.length > 0) {
    request.auto_anchor_dates = form.selectedAutoAnchors;
  }

  return request;
}

function mapIndicatorConfirmation(conf: string | undefined): string {
  if (!conf) return 'Neutral';
  return conf.charAt(0).toUpperCase() + conf.slice(1).toLowerCase();
}

export function transformAnalysisResponse(
  response: Record<string, unknown>,
  form: AnalyzerFormData
): ResultsDisplayProps & {
  chartProjections: Array<{ date: string; type: 'top' | 'bottom'; confidence: number }>;
  chartZones: Array<{ startDate: string; endDate: string; score: number }>;
  aiContextPayload: AIContextPayload;
} {
  const projections = (response.projections as Record<string, unknown>[]) || [];
  const backtestRaw = response.backtest_results as Record<string, unknown> | null | undefined;
  const indicatorRaw = response.indicator_confirmation as Record<string, unknown> | undefined;
  const zonesRaw = (response.confluence_zones as Record<string, unknown>[]) || [];
  const anchors = (response.anchors as Record<string, unknown>[]) || [];
  const cyclesUsed = (response.cycles_used as number[]) || [];

  const mapProjection = (p: Record<string, unknown>) => {
    const reaction = p.reaction as Record<string, unknown> | undefined;
    const reactionType = (reaction?.reaction_type as string) || 'Pending';
    const confidence = (reaction?.confidence as number) || 0;
    const adjusted = (p.adjusted_date as string) || (p.projected_date as string) || '';
    const zone = p.reaction_zone as Record<string, string> | undefined;

    return {
      cycleLength: p.cycle_length as number,
      anchorDate: (p.anchor_date as string) || '',
      sourceLabel: (p.source_label as string) || `${p.cycle_length}-day cycle`,
      projectedDate: (p.projected_date as string) || adjusted,
      adjustedDate: adjusted,
      zoneStart: zone?.zone_start?.split('T')[0] || adjusted.split('T')[0],
      zoneEnd: zone?.zone_end?.split('T')[0] || adjusted.split('T')[0],
      adjustmentNote: (p.adjustment_note as string) || '',
      reactionType: typeof reactionType === 'string' ? reactionType : String(reactionType),
      confidence,
      indicatorConfirmation: indicatorRaw
        ? mapIndicatorConfirmation(indicatorRaw.confirmation as string)
        : '—',
    };
  };

  const mappedProjections = projections.map(mapProjection);

  const perAnchorProjections: Record<string, ReturnType<typeof mapProjection>[]> = {};
  const rawPerAnchor = (response.per_anchor_projections || response.all_anchor_projections) as Record<string, Record<string, unknown>[]> | undefined;
  if (rawPerAnchor) {
    for (const [date, projs] of Object.entries(rawPerAnchor)) {
      perAnchorProjections[date] = projs.map(mapProjection);
    }
  }

  const reactionTypes: Record<string, number> = {};
  if (backtestRaw?.detailed_results) {
    const results = backtestRaw.detailed_results as Record<string, unknown>[];
    const typeCounts: Record<string, { hits: number; total: number }> = {};
    for (const r of results) {
      const rt = String(r.reaction_type || 'Unknown');
      if (!typeCounts[rt]) typeCounts[rt] = { hits: 0, total: 0 };
      typeCounts[rt].total += 1;
      if (r.hit) typeCounts[rt].hits += 1;
    }
    for (const [type, counts] of Object.entries(typeCounts)) {
      reactionTypes[type] = counts.total > 0 ? (counts.hits / counts.total) * 100 : 0;
    }
  }

  const backtest = backtestRaw
    ? {
        hitRate: (backtestRaw.hit_rate as number) || 0,
        assetHitRate: (backtestRaw.asset_hit_rate as number) || (backtestRaw.hit_rate as number) || 0,
        bestCycle: (backtestRaw.best_cycle as number) || 0,
        worstCycle: (backtestRaw.worst_cycle as number) || 0,
        reactionTypes,
        cycleStats: backtestRaw.cycle_stats as Record<string, { hits: number; tests: number; hit_rate: number }>,
        anchorStats: backtestRaw.anchor_stats as Record<string, { hits: number; tests: number; hit_rate: number }>,
        confluenceZoneStats: backtestRaw.confluence_zone_stats as Record<string, { hit_rate: number }>,
      }
    : undefined;

  const rsiVal = indicatorRaw?.rsi as number | undefined;
  const macdHist = indicatorRaw?.macd_histogram as number | undefined;
  const sma20 = indicatorRaw?.sma_20 as number | undefined;
  const sma50 = indicatorRaw?.sma_50 as number | undefined;
  const close = indicatorRaw?.close as number | undefined;
  const atrVal = indicatorRaw?.atr as number | undefined;
  const vol = indicatorRaw?.volume as number | undefined;
  const volSma = indicatorRaw?.volume_sma as number | undefined;

  const formatRsi = (v?: number) =>
    v == null ? '—' : v < 30 ? `Oversold (${v.toFixed(1)})` : v > 70 ? `Overbought (${v.toFixed(1)})` : `Neutral (${v.toFixed(1)})`;
  const formatMacd = (h?: number) =>
    h == null ? '—' : h > 0 ? 'Bullish' : h < 0 ? 'Bearish' : 'Neutral';
  const formatMa = () => {
    if (close == null || sma20 == null || sma50 == null) return '—';
    if (close > sma20 && sma20 > sma50) return 'Uptrend';
    if (close < sma20 && sma20 < sma50) return 'Downtrend';
    return 'Mixed';
  };
  const formatVol = () => {
    if (vol == null || volSma == null) return '—';
    return vol > volSma * 1.2 ? 'Above average' : 'Below average';
  };

  const indicators = indicatorRaw
    ? {
        rsi: formatRsi(rsiVal),
        macd: formatMacd(macdHist),
        ma: formatMa(),
        atr: atrVal != null ? `${atrVal.toFixed(2)}` : '—',
        volume: formatVol(),
        overall: mapIndicatorConfirmation(indicatorRaw.confirmation as string),
        details: (indicatorRaw.details as string[]) || [],
        support: indicatorRaw.support as number | undefined,
        resistance: indicatorRaw.resistance as number | undefined,
      }
    : undefined;

  const convergenceZones = zonesRaw.map((z) => ({
    startDate: (z.zone_start as string) || (z.zone_date as string) || '',
    endDate: (z.zone_end as string) || (z.zone_date as string) || '',
    score: (z.confluence_score as number) || 0,
    anchorsInvolved: (z.anchor_count as number) || 0,
    cycles: (z.cycles_involved as number[]) || [],
    explanation: (z.explanation as string) || '',
    overlapDetails: (z.overlap_details as Array<{
      anchor_date: string;
      anchor_type: string;
      cycle_length: number;
      projected_date: string;
    }>) || [],
  }));

  const mappedAnchors = anchors.map((a) => ({
    date: (a.date as string) || '',
    price: (a.price as number) || 0,
    anchorType: (a.anchor_type as string) || 'low',
  }));

  const chartProjections = mappedProjections.map((p) => ({
    date: p.adjustedDate.split('T')[0],
    type: (p.reactionType.toLowerCase().includes('top') ? 'top' : 'bottom') as 'top' | 'bottom',
    confidence: p.confidence / 100,
  }));

  const chartZones = convergenceZones.map((z) => ({
    startDate: z.startDate.split('T')[0],
    endDate: z.endDate.split('T')[0],
    score: z.score,
  }));

  const mlRaw = response.ml_confidence as Record<string, unknown> | null | undefined;
  const mlConfidence: MLConfidence | undefined = mlRaw
    ? {
        available: Boolean(mlRaw.available),
        reaction_probability: mlRaw.reaction_probability as number | undefined,
        confidence_label: mlRaw.confidence_label as string | undefined,
        historical_reliability: mlRaw.historical_reliability as number | undefined,
        model_type: mlRaw.model_type as string | undefined,
        strong_contributors: (mlRaw.strong_contributors as string[]) || [],
        weak_contributors: (mlRaw.weak_contributors as string[]) || [],
        disclaimer: mlRaw.disclaimer as string | undefined,
        message: mlRaw.message as string | undefined,
        model_metrics: mlRaw.model_metrics as Record<string, number> | undefined,
      }
    : undefined;

  return {
    projections: mappedProjections,
    perAnchorProjections,
    convergenceZones,
    backtest,
    indicators,
    anchors: mappedAnchors,
    aiSummary: (response.ai_summary as string) || undefined,
    selectedCycles: cyclesUsed,
    analysisMode: form.analysisMode,
    modeLabel: (response.mode_label as string) || (form.analysisMode === 'convergence' ? 'With Convergence' : 'Single (Without Convergence)'),
    toleranceDays: (response.tolerance_days as number) || form.toleranceWindow,
    analysisPeriod: form.anchorDate || 'Forward projection',
    dataPoints: (response.data_points as number) || 0,
    lastUpdate: new Date().toISOString(),
    chartProjections,
    chartZones,
    backtestEnabled: form.runBacktest,
    mlConfidence,
    researchSummary: (response.research_summary as string) || undefined,
    aiContextPayload: buildAIContextPayload(response, form),
  };
}

export function normalizeChartData(
  rows: Record<string, unknown>[]
): Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> {
  return rows
    .map((row) => {
      const dateVal = row.Date || row.date || row.index;
      let dateStr = '';
      if (typeof dateVal === 'string') dateStr = dateVal.split('T')[0];
      else if (dateVal) dateStr = new Date(dateVal as string).toISOString().split('T')[0];

      return {
        date: dateStr,
        open: Number(row.Open ?? row.open ?? 0),
        high: Number(row.High ?? row.high ?? 0),
        low: Number(row.Low ?? row.low ?? 0),
        close: Number(row.Close ?? row.close ?? 0),
        volume: Number(row.Volume ?? row.volume ?? 0),
      };
    })
    .filter((d) => d.date && d.close > 0);
}
