'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Loader2, Search, Calendar, List } from 'lucide-react';
import { api, type DetectedAnchor } from '../../lib/api';

export interface AnalyzerFormData {
  symbol: string;
  anchorMode: 'manual-date' | 'auto-anchor';
  anchorDate: string;
  convergenceDates: string[];
  selectedAutoAnchors: string[];
  cyclePreset: 'core' | 'extended' | 'advanced' | 'custom';
  customCycles?: number[];
  analysisMode: 'single-anchor' | 'convergence';
  indicators: {
    rsi: boolean;
    macd: boolean;
    ma: boolean;
    atr: boolean;
    volume: boolean;
  };
  toleranceWindow: number;
  runBacktest: boolean;
}

interface Asset {
  symbol: string;
  name: string;
  type: 'stock' | 'index' | 'forex' | 'commodity' | 'crypto';
}

const CATEGORY_LABELS: Record<string, string> = {
  stocks: 'Stocks',
  indices: 'Indices',
  forex: 'Forex',
  commodities: 'Commodities',
  crypto: 'Crypto',
};

const CATEGORY_TYPE: Record<string, Asset['type']> = {
  stocks: 'stock',
  indices: 'index',
  forex: 'forex',
  commodities: 'commodity',
  crypto: 'crypto',
};

const CYCLE_PRESETS = {
  core: { label: 'Core', description: '30–360 calendar days from anchor', cycles: [30, 60, 90, 120, 180, 240, 270, 360] },
  extended: { label: 'Extended', description: '45, 135, 225, 315 days', cycles: [45, 135, 225, 315] },
  advanced: { label: 'Advanced', description: '72, 144, 365, 720 days', cycles: [72, 144, 365, 720] },
};

const PRESET_KEYS = ['core', 'extended', 'advanced', 'custom'] as const;
const TOLERANCE_OPTIONS = [1, 2, 3] as const;

const DEFAULT_FORM: AnalyzerFormData = {
  symbol: '',
  anchorMode: 'manual-date',
  anchorDate: '',
  convergenceDates: [],
  selectedAutoAnchors: [],
  cyclePreset: 'core',
  analysisMode: 'single-anchor',
  indicators: { rsi: false, macd: false, ma: false, atr: false, volume: false },
  toleranceWindow: 2,
  runBacktest: false,
};

export default function AnalyzerForm({
  onSubmit,
  isSubmitting = false,
  onSymbolChange,
  initialForm,
}: {
  onSubmit?: (data: AnalyzerFormData) => Promise<void>;
  isSubmitting?: boolean;
  onSymbolChange?: (symbol: string) => void;
  initialForm?: Partial<AnalyzerFormData>;
}) {
  const [formData, setFormData] = useState<AnalyzerFormData>({
    ...DEFAULT_FORM,
    ...initialForm,
  });

  const [assets, setAssets] = useState<Asset[]>([]);
  const [detectedAnchors, setDetectedAnchors] = useState<DetectedAnchor[]>([]);
  const [anchorsLoading, setAnchorsLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('stocks');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customCyclesInput, setCustomCyclesInput] = useState('');
  const [convergenceInput, setConvergenceInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAssets().then((catalog) => {
      const list: Asset[] = [];
      for (const [category, data] of Object.entries(catalog)) {
        const type = CATEGORY_TYPE[category] || 'stock';
        for (const [symbol, name] of Object.entries(data.symbols)) {
          list.push({ symbol, name, type });
        }
      }
      setAssets(list);
    }).catch(() => setAssets([])).finally(() => setAssetsLoading(false));
  }, []);

  const loadDetectedAnchors = async (symbol: string) => {
    setAnchorsLoading(true);
    try {
      const res = await api.getAnchors(symbol);
      setDetectedAnchors(res.anchors);
    } catch {
      setDetectedAnchors([]);
    } finally {
      setAnchorsLoading(false);
    }
  };

  const handleSymbolSelect = (asset: Asset) => {
    setFormData((prev) => ({
      ...prev,
      symbol: asset.symbol,
      selectedAutoAnchors: [],
      anchorDate: '',
      convergenceDates: [],
    }));
    onSymbolChange?.(asset.symbol);
    loadDetectedAnchors(asset.symbol);
  };

  const selectedAsset = assets.find((a) => a.symbol === formData.symbol);

  const filteredAssets = useMemo(() => {
    let list = assets.filter((a) => {
      const cat = Object.entries(CATEGORY_TYPE).find(([, t]) => t === a.type)?.[0];
      return cat === activeCategory;
    });
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter((a) => a.symbol.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower));
    }
    return list;
  }, [assets, activeCategory, searchTerm]);

  const toggleAutoAnchor = (date: string) => {
    setFormData((prev) => {
      const selected = prev.selectedAutoAnchors.includes(date)
        ? prev.selectedAutoAnchors.filter((d) => d !== date)
        : [...prev.selectedAutoAnchors, date];
      return { ...prev, selectedAutoAnchors: selected };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.symbol) {
      setError('Please select an asset');
      return;
    }
    if (formData.anchorMode === 'manual-date') {
      if (formData.analysisMode === 'convergence') {
        if (formData.convergenceDates.length < 2) {
          setError('Convergence mode requires at least 2 anchor dates');
          return;
        }
      } else if (!formData.anchorDate) {
        setError('Please enter an anchor date');
        return;
      }
    } else if (formData.selectedAutoAnchors.length === 0) {
      setError('Please select at least one detected anchor');
      return;
    }
    if (formData.cyclePreset === 'custom' && (!formData.customCycles || formData.customCycles.length === 0)) {
      setError('Please enter custom cycles');
      return;
    }

    try {
      if (onSubmit) await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
  };

  const selectedCyclePreset =
    CYCLE_PRESETS[formData.cyclePreset as 'core' | 'extended' | 'advanced'] || {
      label: 'Custom',
      description: 'User-defined cycles',
    };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg lg:col-span-2">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-5 lg:col-span-2">

        {/* Asset */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-cyan-300">Asset Class</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  activeCategory === key
                    ? 'bg-cyan-500/30 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-cyan-300">Symbol *</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full px-4 py-3 bg-slate-800/60 border border-cyan-500/30 rounded-lg text-left text-white"
            >
              {selectedAsset ? (
                <span className="font-semibold">{selectedAsset.symbol}</span>
              ) : (
                <span className="text-slate-400">Select asset...</span>
              )}
              <ChevronDown className="w-5 h-5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </button>
            {isDropdownOpen && (
              <div className="absolute z-30 mt-2 w-full bg-slate-900/95 border border-cyan-500/30 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
                <div className="p-2 border-b border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                </div>
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    type="button"
                    onClick={() => { handleSymbolSelect(asset); setIsDropdownOpen(false); setSearchTerm(''); }}
                    className="w-full px-4 py-2 text-left hover:bg-cyan-500/20 border-b border-slate-800/50"
                  >
                    <div className="text-white text-sm font-medium">{asset.symbol}</div>
                    <div className="text-xs text-slate-400">{asset.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Anchor mode */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-cyan-300">Anchor Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { mode: 'manual-date' as const, label: 'Manual Date', icon: Calendar },
              { mode: 'auto-anchor' as const, label: 'Auto Detect', icon: List },
            ].map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFormData((p) => ({ ...p, anchorMode: mode }))}
                className={`p-3 rounded-lg border text-left flex items-center gap-2 ${
                  formData.anchorMode === mode
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Anchor date input */}
        {formData.anchorMode === 'manual-date' && formData.analysisMode === 'single-anchor' && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-cyan-300">Anchor Date *</label>
            <input
              type="date"
              value={formData.anchorDate}
              onChange={(e) => setFormData((p) => ({ ...p, anchorDate: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-800/60 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <p className="text-xs text-slate-500">Cycles add calendar days from this anchor (day 0), then adjust for trading days.</p>
          </div>
        )}

        {formData.anchorMode === 'manual-date' && formData.analysisMode === 'convergence' && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-cyan-300">Anchor Dates * (comma-separated)</label>
            <input
              type="text"
              placeholder="2024-01-15, 2024-06-20, 2025-03-12"
              value={convergenceInput}
              onChange={(e) => {
                setConvergenceInput(e.target.value);
                const dates = e.target.value.split(',').map((d) => d.trim()).filter(Boolean);
                setFormData((p) => ({ ...p, convergenceDates: dates }));
              }}
              className="w-full px-4 py-3 bg-slate-800/60 border border-cyan-500/30 rounded-lg text-white text-sm"
            />
          </div>
        )}

        {formData.anchorMode === 'auto-anchor' && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-cyan-300">Detected Anchors</label>
            {anchorsLoading ? (
              <p className="text-slate-400 text-sm">Detecting swing points...</p>
            ) : detectedAnchors.length === 0 ? (
              <p className="text-slate-500 text-sm">Select a symbol to detect anchors.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-700/60 rounded-lg p-2">
                {detectedAnchors.map((a) => {
                  const dateStr = a.date.split('T')[0];
                  const selected = formData.selectedAutoAnchors.includes(dateStr);
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => toggleAutoAnchor(dateStr)}
                      className={`w-full flex justify-between items-center px-3 py-2 rounded text-sm border ${
                        selected
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                          : 'bg-slate-800/40 border-slate-700/40 text-slate-300 hover:border-cyan-500/40'
                      }`}
                    >
                      <span>{dateStr}</span>
                      <span className="text-xs">
                        {a.anchor_type.toUpperCase()} ${a.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Cycle preset */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-cyan-300">Cycle Preset</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_KEYS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setFormData((p) => ({ ...p, cyclePreset: preset }))}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  formData.cyclePreset === preset
                    ? 'bg-cyan-500/30 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                }`}
              >
                {preset === 'custom' ? 'Custom' : CYCLE_PRESETS[preset].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{selectedCyclePreset.description}</p>
          {formData.cyclePreset === 'custom' && (
            <input
              type="text"
              placeholder="30, 60, 90, 120"
              value={customCyclesInput}
              onChange={(e) => {
                setCustomCyclesInput(e.target.value);
                const cycles = e.target.value.split(',').map((c) => parseInt(c.trim())).filter((c) => c > 0);
                setFormData((p) => ({ ...p, customCycles: cycles }));
              }}
              className="w-full px-4 py-2 bg-slate-800/60 border border-slate-600 rounded-lg text-white text-sm"
            />
          )}
        </div>

        {/* Analysis mode */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-cyan-300">Analysis Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { mode: 'single-anchor' as const, label: 'Single (Without Convergence)', desc: 'One anchor date → cycle dates' },
              { mode: 'convergence' as const, label: 'With Convergence', desc: 'Multiple anchors → find overlaps' },
            ].map(({ mode, label, desc }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFormData((p) => ({ ...p, analysisMode: mode }))}
                className={`p-3 rounded-lg border text-left ${
                  formData.analysisMode === mode
                    ? 'bg-purple-500/30 border-purple-500/60 text-purple-200'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                }`}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs opacity-70 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Tolerance */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-cyan-300">Tolerance Window</label>
          <div className="flex gap-2">
            {TOLERANCE_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setFormData((p) => ({ ...p, toleranceWindow: days }))}
                className={`flex-1 py-2 rounded-lg text-sm border ${
                  formData.toleranceWindow === days
                    ? 'bg-cyan-500/30 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                }`}
              >
                ±{days}d
              </button>
            ))}
          </div>
        </div>

        {/* Optional: indicators (confirmation only) */}
        <div className="space-y-2 bg-slate-800/20 rounded-lg p-3 border border-slate-700/40">
          <label className="text-sm font-semibold text-slate-300">
            Optional Technical Confirmation
          </label>
          <p className="text-xs text-slate-500 mb-2">Applied after cycle dates are calculated. Never overrides cycles.</p>
          <div className="grid grid-cols-2 gap-2">
            {(['rsi', 'macd', 'ma', 'atr', 'volume'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.indicators[key]}
                  onChange={() =>
                    setFormData((p) => ({
                      ...p,
                      indicators: { ...p.indicators, [key]: !p.indicators[key] },
                    }))
                  }
                  className="accent-cyan-500"
                />
                {key === 'ma' ? 'Moving Averages' : key.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        {/* Optional: backtest research mode */}
        <label className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/40 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.runBacktest}
            onChange={(e) => setFormData((p) => ({ ...p, runBacktest: e.target.checked }))}
            className="mt-1 accent-purple-500"
          />
          <div>
            <span className="text-sm font-medium text-purple-300">Run Historical Backtest</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Optional research mode. Validates cycle reliability against past reactions.
            </p>
          </div>
        </label>

        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-500/20 lg:col-span-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Projecting Cycles...
            </>
          ) : (
            'Project Cycles'
          )}
        </button>
      </form>
    </div>
  );
}
