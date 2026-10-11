/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FrameworkVersion,
  SportingEvent,
  MonteCarloPrediction,
  FactualPostMortem,
  RealtimeMessage,
  WindowHydrationProgress,
} from '../types/database';
import { nexusStore } from '../services/nexusStore';
import {
  TrendingUp,
  Activity,
  Award,
  Zap,
  ArrowRight,
  Radio,
  CheckCircle2,
  Calendar,
  CloudSun,
  Shield,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';

interface OverviewViewProps {
  frameworks: FrameworkVersion[];
  events: SportingEvent[];
  predictions: MonteCarloPrediction[];
  postMortems: FactualPostMortem[];
  realtimeLogs: RealtimeMessage[];
  progress: WindowHydrationProgress;
  onNavigateToTab: (
    tab: 'accuracy-ledger' | 'predictions' | 'post-mortem' | 'upgrades' | 'sql-ddl' | 'tennis'
  ) => void;
  onSyncAll: () => Promise<void>;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  frameworks,
  events,
  predictions,
  postMortems,
  realtimeLogs,
  progress,
  onNavigateToTab,
  onSyncAll,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSport, setSelectedSport] = useState<'ALL' | 'TENNIS' | 'MLB' | 'CFB' | 'NFL'>('ALL');
  const [statusBanner, setStatusBanner] = useState<{
    message: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  const isLiveLoading = isRefreshing || nexusStore.isLiveLoading();

  // Compute live operational KPIs dynamically
  const completedCount = events.filter((e) => e.status === 'completed').length;
  const inProgressCount = events.filter((e) => e.status === 'in_progress').length;
  const scheduledCount = events.filter((e) => e.status === 'scheduled').length;

  const evaluatedWithScores = postMortems.length;
  const avgBrier =
    evaluatedWithScores > 0
      ? (postMortems.reduce((acc, pm) => acc + pm.brier_score, 0) / evaluatedWithScores).toFixed(5)
      : 'Awaiting Calibration';

  const handleRefreshSlate = async () => {
    setIsRefreshing(true);
    try {
      await nexusStore.refreshLiveIngestion('all');
      setStatusBanner({
        message: 'Live sporting slate refreshed directly from public scoreboards.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusBanner({
        message: err?.message || 'Ingestion encountered an issue. Preserving existing stored fixtures.',
        type: 'warning',
      });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => {
        setStatusBanner(null);
      }, 6000);
    }
  };

  // Filtered events
  const filteredEvents = React.useMemo(() => {
    let list = events;
    if (selectedSport !== 'ALL') {
      list = events.filter((e) => e.sport.toUpperCase() === selectedSport);
    }
    // Sort scheduled and in_progress first, then recent completed
    return [...list].sort((a, b) => {
      const orderA = a.status === 'in_progress' ? 0 : a.status === 'scheduled' ? 1 : 2;
      const orderB = b.status === 'in_progress' ? 0 : b.status === 'scheduled' ? 1 : 2;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
    });
  }, [events, selectedSport]);

  const sportCounts = React.useMemo(() => {
    const counts: Record<'ALL' | 'TENNIS' | 'MLB' | 'CFB' | 'NFL', number> = {
      ALL: events.length,
      TENNIS: 0,
      MLB: 0,
      CFB: 0,
      NFL: 0,
    };
    for (const ev of events) {
      const sp = ev.sport.toUpperCase() as 'TENNIS' | 'MLB' | 'CFB' | 'NFL';
      if (counts[sp] !== undefined) {
        counts[sp]++;
      }
    }
    return counts;
  }, [events]);

  return (
    <div className="space-y-6">
      {/* Status Notification Banner */}
      {statusBanner && (
        <div
          className={`p-3 rounded-lg text-xs font-medium border flex items-center justify-between ${
            statusBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          <span>{statusBanner.message}</span>
          <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Progressive 7-Window Hydration & Calibration Banner */}
      <div className="bg-[#0c101b] border border-white/[0.08] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Progressive Ingestion (Aug 11 – Oct 18, 2026)
              </span>
              <span className="text-xs text-slate-400">
                Window {progress.currentWindowIndex} of {progress.totalWindows}
              </span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{progress.currentWindowName}</span>
              {progress.status === 'hydrating' && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigateToTab('accuracy-ledger')}
              className="px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/25 transition shadow-sm flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Open Accuracy Ledger</span>
            </button>
            <button
              onClick={handleRefreshSlate}
              disabled={isLiveLoading}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLiveLoading ? 'animate-spin' : ''}`} />
              <span>Fetch Live Slate</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>
              {progress.completedEvents} Completed Matches Backtested · {progress.activeEvents} Upcoming Games
            </span>
            <span className="text-cyan-400 font-bold">{progress.progressPercent}% Calibrated</span>
          </div>
          <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* High-Level Operational Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0c101b] border border-white/[0.08] p-4 rounded-xl">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Active & Upcoming Slate</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {scheduledCount + inProgressCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {inProgressCount} Live · {scheduledCount} Scheduled (Oct 11-18)
          </div>
        </div>

        <div className="bg-[#0c101b] border border-white/[0.08] p-4 rounded-xl">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>Completed 60-Day Archive</span>
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">{completedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Empirical games graded out-of-sample</div>
        </div>

        <div className="bg-[#0c101b] border border-white/[0.08] p-4 rounded-xl">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Activity className="w-4 h-4 text-amber-400" />
            <span>Cumulative Brier Score</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">{avgBrier}</div>
          <div className="text-[11px] text-slate-500 mt-1">Calculated dynamically across real outcomes</div>
        </div>

        <div className="bg-[#0c101b] border border-white/[0.08] p-4 rounded-xl">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>Monte Carlo Predictions</span>
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">{predictions.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Strictly 50,003 iterations per fixture</div>
        </div>
      </div>

      {/* Active Frameworks Dynamic Status */}
      <div className="bg-[#0c101b] border border-white/[0.08] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Active Quantitative Frameworks & Dynamic Calibration</span>
          </h3>
          <button
            onClick={() => onNavigateToTab('upgrades')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
          >
            <span>View EWMA Upgrades</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {frameworks.map((fw) => {
            const brier = fw.cumulative_brier_score;
            return (
              <div key={fw.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold font-mono uppercase text-emerald-400">{fw.sport}</span>
                  <span className="text-[10px] font-mono text-slate-400">{fw.version_tag}</span>
                </div>
                <div className="text-xs text-slate-300 line-clamp-1 mb-2">{fw.description}</div>
                <div className="flex items-baseline justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">Brier Score:</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {brier !== null ? brier.toFixed(5) : '0.00000'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[11px] text-slate-500 font-mono mt-0.5">
                  <span>Graded Events:</span>
                  <span>{fw.evaluated_event_count || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sporting Events Table & Filter Badges */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Active & Historical Sporting Fixtures</h3>
            <p className="text-xs text-slate-400">
              Filtered sporting events across MLB, CFB, NFL, and Tennis with real scoreboards and Monte Carlo projections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {(['ALL', 'TENNIS', 'MLB', 'CFB', 'NFL'] as const).map((sp) => {
              const count = sportCounts[sp];
              const isActive = selectedSport === sp;
              return (
                <button
                  key={sp}
                  onClick={() => setSelectedSport(sp)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold font-mono tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{sp}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      isActive ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixtures Table */}
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0c101b]">
          {filteredEvents.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-cyan-500/10 text-cyan-400">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <h4 className="text-sm font-semibold text-white">Hydrating Sporting Fixtures...</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Executing progressive 7-window ingestion across MLB, CFB, NFL, and Tennis scoreboards.
              </p>
              <button
                onClick={handleRefreshSlate}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Fetch Live Slate Now</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080c14] border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Sport</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Matchup (Home vs Away)</th>
                    <th className="py-3 px-4">Venue & Surface</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right">Action / Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-300">
                  {filteredEvents.slice(0, 100).map((ev) => {
                    const postMortem = postMortems.find((pm) => pm.event_id === ev.id);
                    const prediction = predictions.find((p) => p.event_id === ev.id);
                    const isTennis = ev.sport.toLowerCase() === 'tennis';

                    return (
                      <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono">
                          <span className="text-emerald-400 uppercase font-semibold">{ev.sport}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {ev.event_date.substring(0, 10)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{ev.home_participant}</div>
                          <div className="text-slate-400 text-[11px]">vs {ev.away_participant}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          <div className="truncate max-w-[180px]">{ev.venue || 'Stadium'}</div>
                          <div className="text-[10px] text-slate-500">{ev.surface || 'Standard'}</div>
                        </td>
                        <td className="py-3 px-4">
                          {ev.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Completed</span>
                            </span>
                          ) : ev.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1.5 text-cyan-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                              <span>Live</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Scheduled</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right font-medium">
                          {ev.home_score !== null && ev.away_score !== null ? (
                            <span className="text-white font-bold">
                              {ev.home_score} - {ev.away_score}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {ev.status === 'completed' ? (
                              <button
                                onClick={() => onNavigateToTab('accuracy-ledger')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 rounded hover:bg-cyan-500/20 transition cursor-pointer"
                                title="View in Walk-Forward Accuracy Ledger"
                              >
                                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                                <span>
                                  BS: {postMortem ? postMortem.brier_score.toFixed(4) : 'Graded'}
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onNavigateToTab('predictions')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded hover:bg-emerald-500/25 transition cursor-pointer"
                              >
                                <Zap className="w-3 h-3" />
                                <span>
                                  {prediction
                                    ? `${(prediction.home_win_probability * 100).toFixed(0)}% MC`
                                    : '50k MC Line'}
                                </span>
                              </button>
                            )}

                            {isTennis && (
                              <button
                                onClick={() => onNavigateToTab('tennis')}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition cursor-pointer"
                                title="Analyze Head-to-Head in Tennis Predictor"
                              >
                                <span>H2H</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Supabase Realtime Event Stream */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Supabase Realtime Event Stream</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">CHANNEL: supabase_realtime</span>
        </div>

        <div className="border border-white/[0.08] rounded-xl bg-[#080c14] p-3 max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs">
          {realtimeLogs.length === 0 ? (
            <div className="text-slate-500 py-3 text-center">No realtime events recorded yet.</div>
          ) : (
            realtimeLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-0.5 border-b border-white/[0.04] last:border-0">
                <span className="text-slate-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="text-emerald-400 shrink-0 font-semibold">[{log.eventType}]</span>
                <span className="text-slate-400 shrink-0">{log.table}:</span>
                <span className="text-slate-300 break-all">{log.summary}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
