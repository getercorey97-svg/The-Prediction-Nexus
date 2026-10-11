/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  VegasComparisonRecord,
  WindowHydrationProgress,
  SportType,
  FrameworkVersion,
} from '../types/database';
import {
  ShieldCheck,
  TrendingDown,
  Activity,
  Layers,
  Search,
  Download,
  RefreshCw,
  Award,
  CheckCircle2,
  Clock,
  ChevronDown,
  Info,
} from 'lucide-react';

interface AccuracyLedgerViewProps {
  ledger: VegasComparisonRecord[];
  frameworks: FrameworkVersion[];
  progress: WindowHydrationProgress;
  onSyncAll: () => Promise<void>;
  isLoading: boolean;
}

export const AccuracyLedgerView: React.FC<AccuracyLedgerViewProps> = ({
  ledger,
  frameworks,
  progress,
  onSyncAll,
  isLoading,
}) => {
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [benchmarkFilter, setBenchmarkFilter] = useState<'all' | 'vegas_only' | 'archived_only'>('all');

  const filteredRecords = useMemo(() => {
    return ledger.filter((rec) => {
      if (selectedSport !== 'all' && rec.sport !== selectedSport) return false;
      if (benchmarkFilter === 'vegas_only' && rec.benchmarkType !== 'vegas_closing') return false;
      if (benchmarkFilter === 'archived_only' && rec.benchmarkType !== 'prior_record_baseline') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const m = `${rec.homeParticipant} vs ${rec.awayParticipant}`.toLowerCase();
        if (!m.includes(q)) return false;
      }
      return true;
    });
  }, [ledger, selectedSport, benchmarkFilter, searchQuery]);

  // Summary statistics computed strictly from empirical records
  const stats = useMemo(() => {
    const total = ledger.length;
    if (total === 0) {
      return {
        total: 0,
        modelBrier: 0,
        benchmarkBrier: 0,
        brierAdvantage: 0,
        vegasCount: 0,
        archivedCount: 0,
        winRateAccuracy: 0,
      };
    }

    let sumModelBrier = 0;
    let sumBenchmarkBrier = 0;
    let vegasCount = 0;
    let correctPicks = 0;

    for (const r of ledger) {
      sumModelBrier += r.modelBrierScore;
      sumBenchmarkBrier += r.benchmarkBrierScore;
      if (r.benchmarkType === 'vegas_closing') vegasCount++;

      const predictedWinner = r.modelHomeProb >= 0.5 ? 1 : 0;
      if (predictedWinner === r.actualOutcome) correctPicks++;
    }

    const modelBrier = sumModelBrier / total;
    const benchmarkBrier = sumBenchmarkBrier / total;
    const brierAdvantage = benchmarkBrier - modelBrier;

    return {
      total,
      modelBrier: Number(modelBrier.toFixed(5)),
      benchmarkBrier: Number(benchmarkBrier.toFixed(5)),
      brierAdvantage: Number(brierAdvantage.toFixed(5)),
      vegasCount,
      archivedCount: total - vegasCount,
      winRateAccuracy: Number(((correctPicks / total) * 100).toFixed(1)),
    };
  }, [ledger]);

  // Export CSV
  const handleExportCsv = () => {
    if (ledger.length === 0) return;
    const headers = [
      'Event Date',
      'Sport',
      'Home Participant',
      'Away Participant',
      'Home Pre-Match Record',
      'Away Pre-Match Record',
      'Final Score',
      'Winner',
      'Model Home Prob',
      'Benchmark Type',
      'Benchmark Home Prob',
      'Actual Outcome',
      'Model Brier Score',
      'Benchmark Brier Score',
      'Brier Advantage',
      'Cumulative Model Brier',
    ];

    const rows = ledger.map((r) => [
      r.eventDate,
      r.sport.toUpperCase(),
      `"${r.homeParticipant}"`,
      `"${r.awayParticipant}"`,
      `"${r.preMatchHomeRecord.wins}-${r.preMatchHomeRecord.losses}"`,
      `"${r.preMatchAwayRecord.wins}-${r.preMatchAwayRecord.losses}"`,
      `"${r.homeScore ?? '-'}-${r.awayScore ?? '-'}"`,
      `"${r.actualWinner ?? '-'}"`,
      r.modelHomeProb.toFixed(4),
      `"${r.benchmarkLabel}"`,
      r.vegasImpliedHomeProb.toFixed(4),
      r.actualOutcome,
      r.modelBrierScore.toFixed(5),
      r.benchmarkBrierScore.toFixed(5),
      r.brierAdvantage.toFixed(5),
      r.cumulativeModelBrier.toFixed(5),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nexus_walkforward_calibration_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Empirical Out-Of-Sample Proof
              </span>
              <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded">
                Aug 11 – Oct 11, 2026 (60 Days)
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              2-Month Walk-Forward Calibration & Proof of Accuracy Ledger
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
              Every completed fixture is evaluated chronologically using strictly pre-match parameters with look-ahead bias eliminated.
              Pre-match forecasts (<span className="text-cyan-400 font-mono">f_t</span>) are benchmarked directly against
              Vegas closing lines and empirical baselines using Brier Scores.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              disabled={ledger.length === 0}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-2 transition shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-400" />
              Export Audit CSV
            </button>
            <button
              onClick={onSyncAll}
              disabled={isLoading}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition shadow-md shadow-cyan-900/30"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Re-Sync 60-Day Archive
            </button>
          </div>
        </div>

        {/* Progressive Hydration Status Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Progressive 7-Window Ingestion Pipeline:</span>
              <span className="text-slate-200 font-medium font-mono">
                {progress.currentWindowName}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-slate-400">
              <span>{progress.completedEvents} Completed</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium">{progress.activeEvents} Upcoming</span>
              <span>·</span>
              <span className="text-cyan-400 font-semibold">{progress.progressPercent}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress.status === 'completed'
                  ? 'bg-emerald-500'
                  : progress.status === 'error'
                  ? 'bg-rose-500'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Layers className="w-4 h-4 text-cyan-400" />
            Empirical Events Evaluated
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {stats.vegasCount} with Vegas Odds · {stats.archivedCount} Prior Baseline
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Activity className="w-4 h-4 text-cyan-400" />
            Model Cumulative Brier
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">
            {stats.total > 0 ? stats.modelBrier.toFixed(5) : '0.00000'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Lower is better (0.00 = perfect)</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Benchmark Cumulative Brier
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            {stats.total > 0 ? stats.benchmarkBrier.toFixed(5) : '0.00000'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Closing lines & pre-match prior</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Award className="w-4 h-4 text-emerald-400" />
            Brier Edge / Advantage
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              stats.brierAdvantage >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {stats.brierAdvantage >= 0 ? `+${stats.brierAdvantage.toFixed(5)}` : stats.brierAdvantage.toFixed(5)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Positive = Model outperforms market</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            Out-of-Sample Hit Rate
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">
            {stats.total > 0 ? `${stats.winRateAccuracy}%` : '0.0%'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Direct straight-up match picks</div>
        </div>
      </div>

      {/* Sport Framework Dynamic Parameters Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-cyan-400" />
          Walk-Forward Parameter Calibrations & Drift By Sport
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {frameworks.map((fw) => {
            const evaluatedCount = fw.evaluated_event_count || 0;
            const brierScore = fw.cumulative_brier_score;
            return (
              <div key={fw.id} className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 uppercase">{fw.sport}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded">
                    {fw.version_tag}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-slate-400">Cumulative Brier:</span>
                  <span className="text-sm font-bold font-mono text-cyan-300">
                    {brierScore !== null ? brierScore.toFixed(5) : 'Awaiting Calibration'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs text-slate-400 mb-2">
                  <span>Evaluated Events:</span>
                  <span className="font-mono text-slate-200">{evaluatedCount}</span>
                </div>
                <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono text-slate-400 space-y-0.5">
                  {Object.entries(fw.parameters)
                    .slice(0, 3)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="truncate max-w-[120px] text-slate-500">{k}:</span>
                        <span className="text-slate-300">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          {['all', 'mlb', 'cfb', 'nfl', 'tennis'].map((sp) => (
            <button
              key={sp}
              onClick={() => setSelectedSport(sp)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md uppercase transition ${
                selectedSport === sp
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {sp}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search team or player..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48 sm:w-60"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
            <button
              onClick={() => setBenchmarkFilter('all')}
              className={`px-2.5 py-1 rounded ${
                benchmarkFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              All Benchmarks
            </button>
            <button
              onClick={() => setBenchmarkFilter('vegas_only')}
              className={`px-2.5 py-1 rounded ${
                benchmarkFilter === 'vegas_only' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Vegas Lines
            </button>
            <button
              onClick={() => setBenchmarkFilter('archived_only')}
              className={`px-2.5 py-1 rounded ${
                benchmarkFilter === 'archived_only' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Prior Baseline
            </button>
          </div>
        </div>
      </div>

      {/* Main Side-by-Side Audit Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-200">Chronological Event-by-Event Audit Ledger</h3>
            <span className="text-xs font-mono text-slate-400">({filteredRecords.length} records)</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Pre-match records subtract current match to avoid look-ahead bias</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Sport</th>
                <th className="py-3 px-4">Matchup & Pre-Match Record</th>
                <th className="py-3 px-3 text-center">Score</th>
                <th className="py-3 px-3 text-right">Model (f_t)</th>
                <th className="py-3 px-4">Benchmark (v_t / b_t)</th>
                <th className="py-3 px-3 text-center">Winner</th>
                <th className="py-3 px-3 text-right">Model Brier</th>
                <th className="py-3 px-3 text-right">Bench Brier</th>
                <th className="py-3 px-3 text-right">Edge Δ</th>
                <th className="py-3 px-4 text-right">Cumul. Brier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 font-sans">
                    {isLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                        <span>Hydrating empirical fixtures from 60-day historical window...</span>
                      </div>
                    ) : (
                      'No completed records matching selected filter criteria.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, i) => {
                  const isModelBetter = r.brierAdvantage > 0;
                  const dateShort = r.eventDate.substring(0, 10);
                  const isVegas = r.benchmarkType === 'vegas_closing';

                  return (
                    <tr key={`${r.eventId}_${i}`} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{dateShort}</td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                          {r.sport}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-200">
                        <div className="font-medium text-slate-100 flex items-center gap-1.5">
                          <span>{r.homeParticipant}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            ({r.preMatchHomeRecord.wins}-{r.preMatchHomeRecord.losses})
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                          <span>vs {r.awayParticipant}</span>
                          <span className="font-mono text-slate-500">
                            ({r.preMatchAwayRecord.wins}-{r.preMatchAwayRecord.losses})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-slate-200">
                        {r.homeScore !== null && r.awayScore !== null ? (
                          <span className="font-bold text-slate-100">
                            {r.homeScore} - {r.awayScore}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-cyan-400 whitespace-nowrap">
                        {(r.modelHomeProb * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              isVegas
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}
                          >
                            {isVegas ? 'Vegas Line' : 'Prior Baseline'}
                          </span>
                          <span className="font-mono text-slate-300">
                            {(r.vegasImpliedHomeProb * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-sans text-xs">
                        <span
                          className={`font-semibold ${
                            r.actualOutcome === 1 ? 'text-emerald-400' : 'text-slate-300'
                          }`}
                        >
                          {r.actualWinner || (r.actualOutcome === 1 ? 'Home' : 'Away')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {r.modelBrierScore.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {r.benchmarkBrierScore.toFixed(4)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-semibold ${
                          isModelBetter ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.brierAdvantage >= 0 ? `+${r.brierAdvantage.toFixed(4)}` : r.brierAdvantage.toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-cyan-300 font-medium">
                        {r.cumulativeModelBrier.toFixed(4)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
