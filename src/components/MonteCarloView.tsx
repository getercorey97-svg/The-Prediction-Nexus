/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SportingEvent, MonteCarloPrediction, FrameworkVersion } from '../types/database';
import { Cpu, TrendingUp } from 'lucide-react';

interface MonteCarloViewProps {
  events: SportingEvent[];
  predictions: MonteCarloPrediction[];
  frameworks: FrameworkVersion[];
}

export const MonteCarloView: React.FC<MonteCarloViewProps> = ({
  events,
  predictions,
  frameworks,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Monte Carlo Simulation Distributions</h2>
          <p className="text-xs text-slate-400">
            Mandate: Exactly <span className="text-emerald-400 font-mono font-medium">50,003 vectorized iterations</span> stored as aggregated statistics (mean, win prob, 5th/95th percentiles)
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0e1422] border border-white/[0.08] rounded-md text-xs font-mono text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span>Vectorized NumPy Routine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {predictions.map((pred) => {
          const event = events.find((e) => e.id === pred.event_id);
          const framework = frameworks.find((f) => f.id === pred.framework_id);
          if (!event) return null;

          const edge =
            pred.market_implied_home_prob !== null
              ? ((pred.home_win_probability - pred.market_implied_home_prob) * 100).toFixed(2)
              : null;

          const edgeNumber = edge ? parseFloat(edge) : 0;

          return (
            <div
              key={pred.id}
              className="p-5 bg-[#0e1422] rounded-lg border border-white/[0.08] hover:border-white/[0.15] transition-all space-y-4"
            >
              {/* Event Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs uppercase font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {event.sport}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {event.home_participant} <span className="text-slate-500 font-normal">vs</span> {event.away_participant}
                    </h3>
                    <div className="text-xs text-slate-400">
                      {event.venue || 'Venue TBD'} · {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-400">Iterations:</span>
                  <span className="text-emerald-300 font-semibold">{pred.simulation_iterations.toLocaleString()}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Model:</span>
                  <span className="text-slate-300">{framework?.version_tag || 'Standard'}</span>
                </div>
              </div>

              {/* Distribution Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {/* Win Probabilities */}
                <div className="p-3 bg-[#080c14] rounded border border-white/[0.06]">
                  <div className="text-slate-400">Win Probability</div>
                  <div className="mt-1 flex items-baseline justify-between font-mono">
                    <span className="text-sm font-bold text-emerald-400">
                      {(pred.home_win_probability * 100).toFixed(1)}%
                    </span>
                    <span className="text-slate-400 text-xs">
                      {(pred.away_win_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${pred.home_win_probability * 100}%` }}
                    />
                    <div
                      className="bg-slate-600 h-full"
                      style={{ width: `${pred.away_win_probability * 100}%` }}
                    />
                  </div>
                </div>

                {/* Predicted Spread with 90% Interval */}
                <div className="p-3 bg-[#080c14] rounded border border-white/[0.06]">
                  <div className="text-slate-400">Home Spread (Margin)</div>
                  <div className="mt-1 font-mono text-sm font-bold text-white tabular-nums">
                    {pred.predicted_home_spread > 0 ? `+${pred.predicted_home_spread}` : pred.predicted_home_spread} pts
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    90% MC: [{pred.p05_score_diff > 0 ? `+${pred.p05_score_diff}` : pred.p05_score_diff}, {pred.p95_score_diff > 0 ? `+${pred.p95_score_diff}` : pred.p95_score_diff}]
                  </div>
                </div>

                {/* Predicted Total Score */}
                <div className="p-3 bg-[#080c14] rounded border border-white/[0.06]">
                  <div className="text-slate-400">Predicted Total</div>
                  <div className="mt-1 font-mono text-sm font-bold text-white tabular-nums">
                    {pred.predicted_total_score} pts
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    90% MC: [{pred.p05_total_score}, {pred.p95_total_score}]
                  </div>
                </div>

                {/* Market Odds & Detected Edge */}
                <div className="p-3 bg-[#080c14] rounded border border-white/[0.06]">
                  <div className="text-slate-400">The Odds API Edge</div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums">
                    {edge !== null ? (
                      <span className={edgeNumber > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {edgeNumber > 0 ? `+${edge}%` : `${edge}%`}
                      </span>
                    ) : (
                      <span className="text-slate-500">Unlisted</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400 truncate">
                    Market: {pred.market_odds.bookmaker || 'Consensus'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
