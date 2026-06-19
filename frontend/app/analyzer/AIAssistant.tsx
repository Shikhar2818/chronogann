'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  GraduationCap,
  FileText,
  Search,
  Filter,
  Brain,
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { AIContextPayload } from '../../lib/analysis';
import { exportElementAsPdf } from '../../lib/exportAnalysis';

type Tab = 'summary' | 'ask' | 'teacher' | 'report' | 'search' | 'strategy' | 'ml';

interface AIAssistantProps {
  researchSummary?: string;
  contextPayload?: AIContextPayload | null;
}

export default function AIAssistant({ researchSummary, contextPayload }: AIAssistantProps) {
  const [tab, setTab] = useState<Tab>('summary');
  const [question, setQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [teacherText, setTeacherText] = useState<string | null>(null);
  const [mlExplain, setMlExplain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('Find strong cycle dates in 2026');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [strategyQuery, setStrategyQuery] = useState('Show cycles that historically worked more than 70%');
  const [strategyResult, setStrategyResult] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasContext = Boolean(contextPayload?.symbol);
  const ctx = () => contextPayload as unknown as Record<string, unknown>;

  const run = async (fn: () => Promise<void>) => {
    if (!contextPayload) return;
    setLoading(true);
    try {
      await fn();
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'summary', label: 'Research', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'ask', label: 'Ask', icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: 'teacher', label: 'Teacher', icon: <GraduationCap className="w-3.5 h-3.5" /> },
    { id: 'report', label: 'Report', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'search', label: 'NL Search', icon: <Search className="w-3.5 h-3.5" /> },
    { id: 'strategy', label: 'Strategy', icon: <Filter className="w-3.5 h-3.5" /> },
    { id: 'ml', label: 'Explain ML', icon: <Brain className="w-3.5 h-3.5" /> },
  ];

  return (
    <section className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-purple-500/15">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI Market Research Analyst
        </h2>
        <p className="text-xs text-gray-500 mt-1">Cycle research narratives — not price predictions</p>
      </div>

      <div className="flex flex-wrap gap-1 p-3 border-b border-white/5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-purple-500/25 text-purple-200 border border-purple-500/40'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 min-h-[200px]">
        {!hasContext && tab !== 'summary' && (
          <p className="text-sm text-gray-500">Run an analysis first to use AI research tools.</p>
        )}

        {tab === 'summary' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-invert max-w-none">
            {researchSummary ? (
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{researchSummary}</div>
            ) : (
              <p className="text-gray-500 text-sm">Research summary appears after you project cycles.</p>
            )}
          </motion.div>
        )}

        {tab === 'ask' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Ask ChronoGann about your current analysis</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Why is this date important?"
                className="flex-1 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm"
              />
              <button
                type="button"
                disabled={loading || !question.trim()}
                onClick={() =>
                  run(async () => {
                    const res = await api.aiAsk(ctx(), question);
                    setAskAnswer(res.answer);
                  })
                }
                className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            {askAnswer && (
              <div className="rounded-lg bg-black/20 border border-purple-500/20 p-4 text-sm text-gray-300 leading-relaxed">
                {askAnswer}
              </div>
            )}
          </div>
        )}

        {tab === 'teacher' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Explain Like I&apos;m a Beginner</p>
            <div className="flex flex-wrap gap-2">
              {['cycles', 'confluence', 'ml confidence'].map((topic) => (
                <button
                  key={topic}
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    run(async () => {
                      const res = await api.aiBeginner(ctx(), topic);
                      setTeacherText(res.explanation);
                    })
                  }
                  className="px-3 py-1.5 rounded-lg text-xs border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                >
                  Explain {topic}
                </button>
              ))}
            </div>
            {teacherText && (
              <div className="rounded-lg bg-black/20 border border-cyan-500/20 p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {teacherText}
              </div>
            )}
          </div>
        )}

        {tab === 'report' && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={loading || !hasContext}
              onClick={() =>
                run(async () => {
                  const report = await api.aiReport(ctx());
                  const md = report.markdown as string;
                  setReportHtml(md);
                })
              }
              className="px-4 py-2 rounded-lg bg-cyan-600 text-black text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate Report'}
            </button>
            {reportHtml && (
              <>
                <div
                  id="chronogann-report-root"
                  className="rounded-lg bg-[#0a0a0f] border border-white/10 p-6 text-sm text-gray-300 whitespace-pre-line font-mono leading-relaxed"
                >
                  {reportHtml}
                </div>
                <button
                  type="button"
                  onClick={() => exportElementAsPdf('chronogann-report-root', 'ChronoGann-Report')}
                  className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-300"
                >
                  Export Report as PDF
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="space-y-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                run(async () => {
                  const res = await api.aiNLSearch(ctx(), searchQuery);
                  const lines = [res.summary as string];
                  const results = res.results as Array<Record<string, unknown>>;
                  results.forEach((r) => {
                    lines.push(`• ${r.type}: ${r.date || r.date_raw} — cycle ${r.cycle || ''} ${r.confluence_score ? `(score ${r.confluence_score})` : ''}`);
                  });
                  setSearchResult(lines.join('\n'));
                })
              }
              className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm"
            >
              Search
            </button>
            {searchResult && (
              <div className="text-sm text-gray-300 whitespace-pre-line">{searchResult}</div>
            )}
          </div>
        )}

        {tab === 'strategy' && (
          <div className="space-y-4">
            <input
              type="text"
              value={strategyQuery}
              onChange={(e) => setStrategyQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                run(async () => {
                  const res = await api.aiStrategy(ctx(), strategyQuery);
                  setStrategyResult((res.summary as string) || JSON.stringify(res.matching_cycles));
                })
              }
              className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm"
            >
              Build Strategy Filter
            </button>
            {strategyResult && <p className="text-sm text-gray-300">{strategyResult}</p>}
          </div>
        )}

        {tab === 'ml' && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={loading || !hasContext}
              onClick={() =>
                run(async () => {
                  const res = await api.aiExplainML(ctx());
                  setMlExplain(res.explanation);
                })
              }
              className="px-4 py-2 rounded-lg bg-emerald-600/80 text-black text-sm font-semibold"
            >
              Explain ML Confidence
            </button>
            {mlExplain && (
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{mlExplain}</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
