const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }

  return res.json();
}

export interface DetectedAnchor {
  date: string;
  price: number;
  anchor_type: 'high' | 'low';
}

export interface AnalyzeRequest {
  symbol: string;
  anchor_mode: 'manual-date' | 'auto-anchor';
  anchor_date?: string;
  anchor_dates?: string[];
  auto_anchor_dates?: string[];
  cycle_preset: string;
  custom_cycles?: number[];
  analysis_mode: 'single-anchor' | 'convergence';
  tolerance_days: number;
  include_indicators: boolean;
  run_backtest: boolean;
  include_ml?: boolean;
  forward_days?: number;
}

export interface MLConfidence {
  available: boolean;
  reaction_probability?: number;
  confidence_label?: string;
  historical_reliability?: number;
  model_type?: string;
  strong_contributors?: string[];
  weak_contributors?: string[];
  disclaimer?: string;
  message?: string;
  model_metrics?: Record<string, number>;
}

export interface AssetCatalog {
  [category: string]: {
    market: string;
    symbols: Record<string, string>;
  };
}

export const api = {
  getAssets: () => request<AssetCatalog>('/api/assets'),

  getData: (symbol: string, period = '2y') =>
    request<{ symbol: string; data: Record<string, unknown>[]; rows: number }>(
      `/api/data/${encodeURIComponent(symbol)}?period=${period}`
    ),

  getAnchors: (symbol: string) =>
    request<{ symbol: string; anchors: DetectedAnchor[]; count: number }>(
      `/api/anchors/${encodeURIComponent(symbol)}`
    ),

  getCycles: () =>
    request<{
      presets: Record<string, { label: string; cycles: number[] }>;
      custom_supported: boolean;
    }>('/api/cycles'),

  analyze: (body: AnalyzeRequest) =>
    request<Record<string, unknown>>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  backtest: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/backtest', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  health: () => request<{ status: string }>('/api/health'),

  trainML: (cyclePreset = 'Core', toleranceDays = 2) =>
    request<{ status: string; samples: number; metrics: Record<string, unknown> }>(
      `/api/ml/train?cycle_preset=${cyclePreset}&tolerance_days=${toleranceDays}`,
      { method: 'POST' }
    ),

  getMLMetrics: () =>
    request<{
      model_available: boolean;
      model_type: string | null;
      metrics: Record<string, unknown> | null;
    }>('/api/ml/metrics'),

  aiAsk: (body: Record<string, unknown>, question: string) =>
    request<{ answer: string }>('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ ...body, question }),
    }),

  aiBeginner: (body: Record<string, unknown>, topic = 'cycles') =>
    request<{ explanation: string }>(`/api/ai/beginner?topic=${encodeURIComponent(topic)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  aiExplainML: (body: Record<string, unknown>) =>
    request<{ explanation: string }>('/api/ai/explain-ml', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  aiReport: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/ai/report', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  aiNLSearch: (body: Record<string, unknown>, query: string) =>
    request<Record<string, unknown>>('/api/ai/nl-search', {
      method: 'POST',
      body: JSON.stringify({ ...body, query }),
    }),

  aiStrategy: (body: Record<string, unknown>, query: string) =>
    request<Record<string, unknown>>('/api/ai/strategy', {
      method: 'POST',
      body: JSON.stringify({ ...body, query }),
    }),

  getProjectorCalendars: () =>
    request<{
      markets: Record<string, string>;
      core_cycles: number[];
      extended_cycles: number[];
    }>('/api/projector/calendars'),

  projectCycles: (body: {
    symbol: string;
    anchor_dates: string[];
    market_type: string;
    selected_cycles: number[];
    custom_cycles?: number[];
    tolerance_days?: number;
    future_only?: boolean;
  }) =>
    request<ProjectorResult>('/api/projector', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export interface ProjectorProjection {
  anchor_index?: number;
  cycle_length: number;
  projected_date: string;
  projected_date_str: string;
  adjusted_date: string;
  adjusted_date_str: string;
  zone_start_str: string;
  zone_end_str: string;
  adjustment_type: 'exact' | 'reaction_zone';
  adjustment_note: string;
  is_future: boolean;
  is_past: boolean;
  days_from_anchor: number;
  days_from_today: number;
}

export interface ProjectorAnchorResult {
  anchor_index: number;
  anchor_date: string;
  calendar_label: string;
  calendar_source: string;
  projections: ProjectorProjection[];
  projection_count: number;
}

export interface ProjectorConvergenceOverlap {
  anchor_index: number;
  anchor_date: string;
  cycle_length: number;
  projected_date_str: string;
  adjusted_date_str: string;
}

export interface ProjectorConvergence {
  convergence_date_str: string;
  adjusted_date_str: string;
  zone_start_str: string;
  zone_end_str: string;
  match_status: 'exact' | 'near_match';
  spread_days: number;
  strength: 'dual' | 'triple';
  strength_label: string;
  anchor_count: number;
  cycle_count: number;
  cycles_involved: number[];
  anchors_involved: string[];
  tolerance_days: number;
  overlaps: ProjectorConvergenceOverlap[];
  confluence_score: number;
}

export interface ProjectorResult {
  anchor_count: number;
  anchor_dates: string[];
  anchors: ProjectorAnchorResult[];
  symbol: string;
  market_type: string;
  calendar_label: string;
  calendar_source: string;
  cycles_used: number[];
  tolerance_days: number;
  future_only: boolean;
  convergence: ProjectorConvergence[];
  convergence_count: number;
  projection_count: number;
  /** Legacy single-anchor fields */
  anchor_date: string;
  projections: ProjectorProjection[];
}
