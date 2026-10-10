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
} from '../types/database';
import { PlayCircle, CheckCircle2, Radio, Calendar, ArrowRight, RefreshCw, CloudSun, Shield, Wind, Droplets } from 'lucide-react';
import { nexusStore } from '../services/nexusStore';

interface OverviewViewProps {
  frameworks: FrameworkVersion[];
  events: SportingEvent[];
  predictions: MonteCarloPrediction[];
  postMortems: FactualPostMortem[];
  realtimeLogs: RealtimeMessage[];
  onOpenTriggerModalForEvent: (event: SportingEvent) => void;
  onNavigateToTab: (tab: 'predictions' | 'post-mortem' | 'upgrades' | 'sql-ddl') => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  frameworks,
  events,
  predictions,
  postMortems,
  realtimeLogs,
  onOpenTriggerModalForEvent,
  onNavigateToTab,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const completedCount = events.filter((e) => e.status === 'completed').length;
  const scheduledCount = events.filter((e) => e.status === 'scheduled').length;
  const inProgressCount = events.filter((e) => e.status === 'in_progress').length;

  const avgBrier =
    postMortems.length > 0
      ? (postMortems.reduce((acc, pm) => acc + pm.brier_score, 0) / postMortems.length).toFixed(6)
      : '0.000000';

  const handleRefreshSlate = async () => {
    setIsRefreshing(true);
    try {
      await nexusStore.refreshLiveIngestion('all');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 3-Tier Live Multi-Scraper Banner */}
      <div className="p-4 bg-gradient-to-r from-[#0c1220] via-[#0e1628] to-[#0a101d] rounded-lg border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              3-Tier Live Multi-Scraper & Cross-Enrichment Pipeline Active
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
              Zero Static Mocks
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Live ingestion via <strong className="text-slate-200">Tier 1 ESPN Hidden API</strong> with automatic failover to <strong className="text-slate-200">Tier 2 Advanced Metrics</strong> (FIP, BaseRuns, EPA, Havoc, Surface Elo) and <strong className="text-slate-200">Tier 3 Open-Meteo Weather</strong>.
          </p>
        </div>

        <button
          onClick={handleRefreshSlate}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded shadow-md transition-all whitespace-nowrap cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Syncing Live Pipeline...' : 'Refresh Live 3-Tier Slate'}</span>
        </button>
      </div>

      {/* KPI Quantitative Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0e1422] rounded-lg border border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400">Monte Carlo Rigor</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">50,003</div>
          <div className="mt-1 text-xs text-slate-500">Vectorized NumPy iterations / event</div>
        </div>

        <div className="p-4 bg-[#0e1422] rounded-lg border border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400">Average Brier Score</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-400">{avgBrier}</div>
          <div className="mt-1 text-xs text-slate-500">Benchmark vs 0.250 uncalibrated coin</div>
        </div>

        <div className="p-4 bg-[#0e1422] rounded-lg border border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400">Live Sporting Fixtures</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
            {events.length} Active
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {scheduledCount} scheduled · {inProgressCount} in progress · {completedCount} final
          </div>
        </div>

        <div className="p-4 bg-[#0e1422] rounded-lg border border-white/[0.08]">
          <div className="text-xs font-medium text-slate-400">Autonomous Calibration</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-400">Instant Triggers</div>
          <div className="mt-1 text-xs text-slate-500">Supabase triggers + EWMA updates</div>
        </div>
      </div>

      {/* Active Sports Predictive Frameworks */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Sport-Specific Predictive Frameworks</h2>
            <p className="text-xs text-slate-400">
              Active mathematical models and hyperparameter weights configured in <span className="font-mono text-slate-300">framework_versions</span>
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('upgrades')}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>View EWMA logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-[#0c101b]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080c14] border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Sport</th>
                  <th className="py-2.5 px-4">Version Tag</th>
                  <th className="py-2.5 px-4">Mathematical Approach</th>
                  <th className="py-2.5 px-4 text-right">EWMA Alpha</th>
                  <th className="py-2.5 px-4 text-right">Learning Rate</th>
                  <th className="py-2.5 px-4 text-right">Running Brier</th>
                  <th className="py-2.5 px-4 text-right">Evaluations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-slate-300">
                {frameworks.map((fw) => (
                  <tr key={fw.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-emerald-400 uppercase">{fw.sport}</td>
                    <td className="py-3 px-4 font-mono text-white font-medium">{fw.version_tag}</td>
                    <td className="py-3 px-4 max-w-xs text-slate-400 truncate">{fw.description}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right">{fw.ewma_alpha.toFixed(4)}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right">{fw.learning_rate.toFixed(4)}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right font-medium text-emerald-300">
                      {fw.cumulative_brier_score !== null ? fw.cumulative_brier_score.toFixed(6) : 'Unset'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right">{fw.evaluated_event_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sporting Events Slate */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Live Sporting Fixtures & Empirical Slates</h2>
            <p className="text-xs text-slate-400">
              Live scoreboards cross-enriched with Tier 2 metrics and Tier 3 Open-Meteo weather
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('predictions')}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>Inspect Monte Carlo distributions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-[#0c101b]">
          {events.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <h4 className="text-sm font-semibold text-white">Hydrating Live Sporting Fixtures...</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                The 3-Tier Multi-Scraper pipeline is querying live daily scoreboards across MLB, CFB, NFL, and Tennis. Zero static dummy arrays.
              </p>
              <button
                onClick={handleRefreshSlate}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded hover:bg-emerald-500/25 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Fetch Live Slate Now</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080c14] border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Sport</th>
                    <th className="py-2.5 px-4">Event Date</th>
                    <th className="py-2.5 px-4">Matchup (Home vs Away)</th>
                    <th className="py-2.5 px-4">Environment & Stadium</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Score</th>
                    <th className="py-2.5 px-4 text-right">Action / Post-Mortem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-300">
                  {events.map((ev) => {
                    const postMortem = postMortems.find((pm) => pm.event_id === ev.id);
                    const envData = (ev.official_metadata as any)?.environmental;

                    return (
                      <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-emerald-400 uppercase font-medium">{ev.sport}</td>
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {new Date(ev.event_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{ev.home_participant}</div>
                          <div className="text-slate-400 text-[11px]">vs {ev.away_participant}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          <div className="truncate max-w-[200px]" title={ev.venue || ''}>
                            {ev.venue || 'Stadium'} {ev.surface ? `(${ev.surface})` : ''}
                          </div>
                          {envData && (
                            <div className="mt-0.5 text-[10px] font-mono flex items-center gap-1.5 text-slate-500">
                              {envData.is_indoor ? (
                                <span className="inline-flex items-center gap-1 text-cyan-400/90">
                                  <Shield className="w-3 h-3" />
                                  <span>Dome (72°F)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-300/90">
                                  <CloudSun className="w-3 h-3" />
                                  <span>{envData.temperature_f}°F · {envData.wind_speed_mph} mph {envData.wind_direction_compass || ''}</span>
                                </span>
                              )}
                            </div>
                          )}
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
                            <span className="text-white">
                              {ev.home_score} - {ev.away_score}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {ev.status === 'completed' && postMortem ? (
                            <span className="font-mono tabular-nums text-emerald-300">
                              BS: {postMortem.brier_score.toFixed(6)}
                            </span>
                          ) : (
                            <button
                              onClick={() => onOpenTriggerModalForEvent(ev)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded hover:bg-emerald-500/25 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <PlayCircle className="w-3 h-3" />
                              <span>Simulate Final Score</span>
                            </button>
                          )}
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

      {/* Supabase Realtime WebSocket Event Stream */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Supabase Realtime Event Stream</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">CHANNEL: supabase_realtime (postgres_changes)</span>
        </div>

        <div className="border border-white/[0.08] rounded-lg bg-[#080c14] p-3 max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
          {realtimeLogs.length === 0 ? (
            <div className="text-slate-500 py-3 text-center">No realtime events recorded yet.</div>
          ) : (
            realtimeLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-1 border-b border-white/[0.04] last:border-0">
                <span className="text-slate-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
