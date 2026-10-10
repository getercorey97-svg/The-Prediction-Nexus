/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FactualPostMortem, SportingEvent, MonteCarloPrediction } from '../types/database';
import { ShieldCheck, AlertCircle, Award } from 'lucide-react';

interface PostMortemViewProps {
  postMortems: FactualPostMortem[];
  events: SportingEvent[];
  predictions: MonteCarloPrediction[];
}

export const PostMortemView: React.FC<PostMortemViewProps> = ({
  postMortems,
  events,
  predictions,
}) => {
  const averageBrier =
    postMortems.length > 0
      ? (postMortems.reduce((acc, p) => acc + p.brier_score, 0) / postMortems.length).toFixed(6)
      : '0.000000';

  const capturedCount = postMortems.filter((p) => p.within_p05_p95_interval).length;
  const captureRate =
    postMortems.length > 0 ? ((capturedCount / postMortems.length) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-6">
      {/* Header and mandate definition */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Factual Post-Mortem Verifications</h2>
          <p className="text-xs text-slate-400">
            Mandate: Pre-match forecasts evaluated strictly against official final scores. Zero post-game simulations permitted.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="px-3 py-1.5 bg-[#0e1422] border border-white/[0.08] rounded-md text-slate-300">
            Average Brier: <span className="text-emerald-400 font-bold">{averageBrier}</span>
          </div>
          <div className="px-3 py-1.5 bg-[#0e1422] border border-white/[0.08] rounded-md text-slate-300">
            90% MC Interval Capture: <span className="text-emerald-400 font-bold">{captureRate}%</span>
          </div>
        </div>
      </div>

      {/* Post-Mortem Records Table */}
      <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-[#0c101b]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080c14] border-b border-white/[0.08] text-slate-400 font-mono uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Event & Result</th>
                <th className="py-2.5 px-4 text-right">Predicted Prob</th>
                <th className="py-2.5 px-4 text-right">Actual Outcome</th>
                <th className="py-2.5 px-4 text-right">Brier Score</th>
                <th className="py-2.5 px-4 text-right">Spread Error</th>
                <th className="py-2.5 px-4 text-right">Total Error</th>
                <th className="py-2.5 px-4 text-center">90% MC Interval</th>
                <th className="py-2.5 px-4">Evaluated At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-slate-300">
              {postMortems.map((pm) => {
                const event = events.find((e) => e.id === pm.event_id);
                const prediction = predictions.find((p) => p.id === pm.prediction_id);

                return (
                  <tr key={pm.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {event?.home_participant} ({event?.home_score}) vs {event?.away_participant} ({event?.away_score})
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 uppercase">
                        Winner: <span className="text-emerald-400">{event?.actual_winner}</span> · {event?.sport}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums text-right">
                      {(pm.predicted_home_win_prob * 100).toFixed(1)}%
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums text-right font-medium">
                      {pm.actual_home_outcome === 1.0 ? (
                        <span className="text-emerald-400">1.0 (Win)</span>
                      ) : pm.actual_home_outcome === 0.0 ? (
                        <span className="text-rose-400">0.0 (Loss)</span>
                      ) : (
                        <span className="text-amber-400">0.5 (Tie)</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums text-right">
                      <span className="font-bold text-emerald-300">{pm.brier_score.toFixed(6)}</span>
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-300">
                      {pm.spread_absolute_error.toFixed(2)} pts
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-300">
                      {pm.total_absolute_error.toFixed(2)} pts
                    </td>

                    <td className="py-3 px-4 text-center">
                      {pm.within_p05_p95_interval ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Captured</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <AlertCircle className="w-3 h-3" />
                          <span>Outlier</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(pm.evaluated_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empirical Notes Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase font-mono tracking-wider">
          Trigger-Generated Empirical Audit Trail
        </h3>
        <div className="space-y-2">
          {postMortems.map((pm) => (
            <div key={`notes-${pm.id}`} className="p-3 bg-[#080c14] border border-white/[0.06] rounded text-xs">
              <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] mb-1">
                <span>POST-MORTEM ID: {pm.id.substring(0, 16)}...</span>
                <span className="text-emerald-400">BRIER: {pm.brier_score.toFixed(6)}</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px] leading-relaxed">{pm.empirical_notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
