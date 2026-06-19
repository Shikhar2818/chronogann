'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Save,
  Download,
  FolderOpen,
  Trash2,
  Loader2,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AnalyzerForm, { type AnalyzerFormData } from './AnalyzerForm';
import ResultsDisplay, { type ResultsDisplayProps } from './ResultsDisplay';
import AIAssistant from './AIAssistant';
import ChartComponent from './ChartComponent';
import type { AIContextPayload } from '../../lib/analysis';
import { api, ApiError } from '../../lib/api';
import { formDataToAnalyzeRequest, transformAnalysisResponse, normalizeChartData } from '../../lib/analysis';
import { exportElementAsPng, exportElementAsPdf } from '../../lib/exportAnalysis';
import {
  listSavedAnalyses,
  saveAnalysis,
  deleteSavedAnalysis,
  type SavedAnalysisRecord,
} from '../../lib/savedAnalysis';

type ChartRow = { date: string; open: number; high: number; low: number; close: number; volume: number };

export default function AnalyzerPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const [lastForm, setLastForm] = useState<AnalyzerFormData | null>(null);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [results, setResults] = useState<ResultsDisplayProps | null>(null);
  const [chartProjections, setChartProjections] = useState<
    Array<{ date: string; type: 'top' | 'bottom'; confidence: number }>
  >([]);
  const [chartZones, setChartZones] = useState<
    Array<{ startDate: string; endDate: string; score: number }>
  >([]);
  const [savedList, setSavedList] = useState<SavedAnalysisRecord[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [initialForm, setInitialForm] = useState<Partial<AnalyzerFormData> | undefined>();
  const [showMLPanel, setShowMLPanel] = useState(false);
  const [mlMetrics, setMlMetrics] = useState<{
    model_available?: boolean;
    model_type?: string | null;
    metrics?: { metrics?: Record<string, number> } | null;
  } | null>(null);
  const [mlTraining, setMlTraining] = useState(false);
  const [mlTrainMsg, setMlTrainMsg] = useState<string | null>(null);
  const [researchSummary, setResearchSummary] = useState<string | undefined>();
  const [aiContext, setAiContext] = useState<AIContextPayload | null>(null);

  const refreshSaved = useCallback(() => setSavedList(listSavedAnalyses()), []);

  const loadChartData = useCallback(async (sym: string) => {
    if (!sym) return;
    setIsChartLoading(true);
    setSymbol(sym);
    try {
      const response = await api.getData(sym, '2y');
      setChartData(normalizeChartData(response.data));
    } catch {
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  }, []);

  const handleAnalyze = async (form: AnalyzerFormData) => {
    setIsAnalyzing(true);
    setError(null);
    setLastForm(form);

    try {
      const request = formDataToAnalyzeRequest(form);
      const response = await api.analyze(request);
      const transformed = transformAnalysisResponse(response, form);

      setResults({
        symbol: form.symbol,
        projections: transformed.projections,
        perAnchorProjections: transformed.perAnchorProjections,
        convergenceZones: transformed.convergenceZones,
        backtest: transformed.backtest,
        indicators: transformed.indicators,
        anchors: transformed.anchors,
        aiSummary: transformed.aiSummary,
        selectedCycles: transformed.selectedCycles,
        analysisMode: transformed.analysisMode,
        modeLabel: transformed.modeLabel,
        toleranceDays: transformed.toleranceDays,
        analysisPeriod: transformed.analysisPeriod,
        dataPoints: transformed.dataPoints,
        lastUpdate: transformed.lastUpdate,
        backtestEnabled: transformed.backtestEnabled,
        mlConfidence: transformed.mlConfidence,
        researchSummary: transformed.researchSummary,
      });
      setResearchSummary(transformed.researchSummary);
      setAiContext(transformed.aiContextPayload || null);
      setChartProjections(transformed.chartProjections);
      setChartZones(transformed.chartZones);

      if (symbol !== form.symbol) {
        await loadChartData(form.symbol);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Analysis failed. Ensure the backend is running.';
      setError(message);
      setResults({ projections: [], error: message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (!lastForm || !results || results.projections.length === 0) return;
    saveAnalysis(lastForm.symbol, lastForm, results);
    refreshSaved();
  };

  const handleLoadSaved = (record: SavedAnalysisRecord) => {
    setInitialForm(record.form);
    setFormKey((k) => k + 1);
    setResults(record.results);
    setLastForm(record.form);
    setSymbol(record.symbol);
    setShowSaved(false);
    loadChartData(record.symbol);
  };

  const loadMLMetrics = useCallback(async () => {
    try {
      const m = await api.getMLMetrics();
      setMlMetrics(m);
    } catch {
      setMlMetrics(null);
    }
  }, []);

  const handleTrainML = async () => {
    setMlTraining(true);
    setMlTrainMsg(null);
    try {
      const res = await api.trainML('Core', 2);
      setMlTrainMsg(`Trained on ${res.samples} cycle events. Model: ${(res.metrics as { selected_model?: string }).selected_model}`);
      await loadMLMetrics();
    } catch (err) {
      setMlTrainMsg(err instanceof ApiError ? err.message : 'Training failed');
    } finally {
      setMlTraining(false);
    }
  };

  const handleExport = async (format: 'png' | 'pdf') => {
    setIsExporting(true);
    try {
      const name = `ChronoGann-${symbol || 'analysis'}-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'png') await exportElementAsPng('chronogann-export-root', name);
      else await exportElementAsPdf('chronogann-export-root', name);
    } catch {
      setError('Export failed. Run an analysis first.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508]">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050508]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <h1 className="text-sm sm:text-base font-semibold text-white truncate">ChronoGann Research</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { refreshSaved(); setShowSaved((s) => !s); }}
              className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              title="Saved analyses"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            {results && results.projections.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  title="Save analysis"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExport('png')}
                  className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
                  title="Export PNG"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Saved analyses drawer */}
      {showSaved && (
        <div className="border-b border-white/5 bg-[#0a0a12] px-4 py-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Saved Analyses (browser)</p>
            {savedList.length === 0 ? (
              <p className="text-sm text-gray-500">No saved analyses yet. Run an analysis and click Save.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {savedList.map((r) => (
                  <div key={r.id} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5">
                    <button
                      type="button"
                      onClick={() => handleLoadSaved(r)}
                      className="px-3 py-2 text-sm text-gray-200 hover:text-cyan-300"
                    >
                      {r.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => { deleteSavedAnalysis(r.id); refreshSaved(); }}
                      className="p-2 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-cyan-400/70 text-xs uppercase tracking-[0.2em] mb-2">Gann Time-Cycle Research</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Cycle Analyzer</h2>
          <p className="text-gray-400 max-w-2xl text-sm sm:text-base leading-relaxed">
            Enter an anchor date, project calendar-day Gann cycles, and review trading windows,
            confluence zones, and optional historical validation. Cycles come first — indicators confirm only.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {['1. Choose asset & anchor', '2. Select cycles & mode', '3. Review projected dates'].map((step) => (
              <span key={step} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                {step}
              </span>
            ))}
            <Link
              href="/cycle-projector"
              className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
            >
              Need dates only? → Cycle Projector
            </Link>
          </div>
        </motion.section>

        {/* ML Research Panel */}
        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
          <button
            type="button"
            onClick={() => { setShowMLPanel((s) => !s); if (!showMLPanel) loadMLMetrics(); }}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Brain className="w-4 h-4" />
              ML Research Panel
            </span>
            {showMLPanel ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showMLPanel && (
            <div className="px-5 pb-5 border-t border-emerald-500/10 pt-4 space-y-4">
              <p className="text-xs text-gray-400">
                Trains on historical cycle backtests — scores reaction probability, not price direction.
              </p>
              <button
                type="button"
                onClick={handleTrainML}
                disabled={mlTraining}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-black text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2"
              >
                {mlTraining && <Loader2 className="w-4 h-4 animate-spin" />}
                {mlTraining ? 'Training…' : 'Train / Retrain Model'}
              </button>
              {mlTrainMsg && <p className="text-xs text-emerald-300">{mlTrainMsg}</p>}
              {mlMetrics && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-black/20 p-3 border border-white/5">
                    <p className="text-gray-500">Model</p>
                    <p className="text-white font-medium">
                      {mlMetrics.model_available ? String(mlMetrics.model_type || 'loaded') : 'Not trained'}
                    </p>
                  </div>
                  {mlMetrics.metrics?.metrics &&
                    ['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].map((k) => {
                      const val = mlMetrics.metrics?.metrics?.[k];
                      if (val == null) return null;
                      return (
                        <div key={k} className="rounded-lg bg-black/20 p-3 border border-white/5">
                          <p className="text-gray-500 uppercase">{k}</p>
                          <p className="text-white font-medium">{(val * 100).toFixed(1)}%</p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Setup */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-5 sm:p-6 shadow-[0_0_60px_rgba(0,212,255,0.04)]">
          <AnalyzerForm
            key={formKey}
            initialForm={initialForm}
            onSubmit={handleAnalyze}
            isSubmitting={isAnalyzing}
            onSymbolChange={loadChartData}
          />
        </section>

        {/* AI Research Analyst */}
        {(researchSummary || aiContext) && (
          <AIAssistant researchSummary={researchSummary} contextPayload={aiContext} />
        )}

        {/* Results */}
        <section id="results-section">
          <div id="chronogann-export-root">
            <ResultsDisplay
              symbol={symbol}
              projections={results?.projections || []}
              perAnchorProjections={results?.perAnchorProjections}
              convergenceZones={results?.convergenceZones}
              backtest={results?.backtest}
              indicators={results?.indicators}
              anchors={results?.anchors}
              aiSummary={results?.aiSummary}
              selectedCycles={results?.selectedCycles}
              analysisMode={results?.analysisMode}
              modeLabel={results?.modeLabel}
              toleranceDays={results?.toleranceDays}
              analysisPeriod={results?.analysisPeriod}
              dataPoints={results?.dataPoints}
              lastUpdate={results?.lastUpdate}
              backtestEnabled={results?.backtestEnabled}
              loading={isAnalyzing}
              error={error || results?.error}
              onExportPng={() => handleExport('png')}
              onExportPdf={() => handleExport('pdf')}
              isExporting={isExporting}
              mlConfidence={results?.mlConfidence}
              researchSummary={results?.researchSummary}
            />
          </div>
        </section>

        {/* Chart */}
        {symbol && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/10 bg-[#08080f] p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-cyan-500/70" />
              <h3 className="text-lg font-semibold text-white">Price Context</h3>
              <span className="text-xs text-gray-500">— optional visualization for {symbol}</span>
            </div>
            <ChartComponent
              symbol={symbol}
              data={chartData}
              projections={chartProjections}
              convergenceZones={chartZones}
              loading={isChartLoading}
            />
          </motion.section>
        )}
      </main>
    </div>
  );
}
