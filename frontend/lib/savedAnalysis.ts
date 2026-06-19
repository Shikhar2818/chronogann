import type { ResultsDisplayProps } from '../app/analyzer/ResultsDisplay';
import type { AnalyzerFormData } from '../app/analyzer/AnalyzerForm';

export interface SavedAnalysisRecord {
  id: string;
  savedAt: string;
  label: string;
  symbol: string;
  form: AnalyzerFormData;
  results: ResultsDisplayProps;
}

const STORAGE_KEY = 'chronogann-saved-analyses';
const MAX_SAVED = 20;

export function listSavedAnalyses(): SavedAnalysisRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedAnalysisRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveAnalysis(
  symbol: string,
  form: AnalyzerFormData,
  results: ResultsDisplayProps
): SavedAnalysisRecord {
  const record: SavedAnalysisRecord = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    label: `${symbol} — ${form.analysisMode === 'convergence' ? 'Convergence' : 'Single'} — ${new Date().toLocaleDateString()}`,
    symbol,
    form,
    results,
  };

  const existing = listSavedAnalyses();
  const next = [record, ...existing].slice(0, MAX_SAVED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return record;
}

export function deleteSavedAnalysis(id: string): void {
  const next = listSavedAnalyses().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getSavedAnalysis(id: string): SavedAnalysisRecord | undefined {
  return listSavedAnalyses().find((r) => r.id === id);
}
