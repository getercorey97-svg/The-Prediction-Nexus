/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SportingEvent, MonteCarloPrediction, FactualPostMortem, AutonomousUpgrade } from '../types/database';
import { X, Play, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface TriggerSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: SportingEvent[];
  predictions: MonteCarloPrediction[];
  selectedEventId: string | null;
  onExecuteTrigger: (eventId: string, homeScore: number, awayScore: number) => {
    postMortem: FactualPostMortem | null;
    upgrade: AutonomousUpgrade | null;
  };
}

export const TriggerSimulatorModal: React.FC<TriggerSimulatorModalProps> = ({
  isOpen,
  onClose,
  events,
  predictions,
  selectedEventId,
  onExecuteTrigger,
}) => {
  const pendingEvents = events.filter((e) => e.status !== 'completed');

  const [activeEventId, setActiveEventId] = useState<string>(
    selectedEventId || (pendingEvents.length > 0 ? pendingEvents[0].id : '')
  );
  const [homeScore, setHomeScore] = useState<number>(5);
  const [awayScore, setAwayScore] = useState<number>(3);
  const [executionResult, setExecutionResult] = useState<{
    postMortem: FactualPostMortem | null;
    upgrade: AutonomousUpgrade | null;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync active event if selectedEventId changes
  React.useEffect(() => {
    if (selectedEventId) {
      setActiveEventId(selectedEventId);
      setExecutionResult(null);
      setErrorMessage(null);
    }
  }, [selectedEventId]);

  if (!isOpen) return null;

  const currentEvent = events.find((e) => e.id === activeEventId);
  const currentPrediction = predictions.find((p) => p.event_id === activeEventId);

  const handleRunTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const res = onExecuteTrigger(activeEventId, homeScore, awayScore);
      setExecutionResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Trigger execution failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#0c101b] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#080c14]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">PostgreSQL Trigger Simulation Console</h2>
              <p className="text-[11px] text-slate-400">
                Execute official match finalization to test <span className="font-mono text-slate-300">trg_event_completed_post_mortem</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {pendingEvents.length === 0 ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300 text-xs">
              All sporting events have already been completed and post-mortems verified. Reset or refresh the database to run more trigger tests.
            </div>
          ) : (
            <form onSubmit={handleRunTrigger} className="space-y-4">
              {/* Event Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Active / Scheduled Event
                </label>
                <select
                  value={activeEventId}
                  onChange={(e) => {
                    setActiveEventId(e.target.value);
                    setExecutionResult(null);
                  }}
                  className="w-full bg-[#080c14] border border-white/[0.1] rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                >
                  {pendingEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      [{ev.sport.toUpperCase()}] {ev.home_participant} vs {ev.away_participant} ({ev.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pre-Match Prediction Summary */}
              {currentPrediction && currentEvent && (
                <div className="p-3 bg-[#080c14] border border-white/[0.06] rounded text-xs space-y-1">
                  <div className="text-slate-400 font-mono text-[11px]">PRE-MATCH 50,003 MONTE CARLO FORECAST:</div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-slate-200">
                    <div>
                      {currentEvent.home_participant}:{' '}
                      <span className="text-emerald-400 font-semibold">
                        {(currentPrediction.home_win_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      Spread: <span className="text-white font-semibold">{currentPrediction.predicted_home_spread} pts</span>
                    </div>
                    <div>
                      Total: <span className="text-white font-semibold">{currentPrediction.predicted_total_score} pts</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Score Input Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {currentEvent?.home_participant || 'Home'} Official Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={homeScore}
                    onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#080c14] border border-white/[0.1] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {currentEvent?.away_participant || 'Away'} Official Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={awayScore}
                    onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#080c14] border border-white/[0.1] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-500 text-slate-950 font-semibold text-xs rounded-md hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Trigger: Commit Official Score & Evaluate Brier</span>
              </button>
            </form>
          )}

          {/* Execution Result Display */}
          {executionResult && executionResult.postMortem && (
            <div className="mt-4 p-4 bg-[#080c14] border border-emerald-500/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>PostgreSQL Triggers Fired Atomically</span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-xs text-slate-300">
                <div className="p-2 bg-[#0c101b] rounded border border-white/[0.04]">
                  <div className="text-[10px] text-slate-400">BRIER SCORE</div>
                  <div className="text-emerald-400 font-bold text-sm">
                    {executionResult.postMortem.brier_score.toFixed(6)}
                  </div>
                </div>
                <div className="p-2 bg-[#0c101b] rounded border border-white/[0.04]">
                  <div className="text-[10px] text-slate-400">CALIBRATION DELTA</div>
                  <div className="text-white font-bold text-sm">
                    {executionResult.postMortem.calibration_delta > 0
                      ? `+${executionResult.postMortem.calibration_delta.toFixed(6)}`
                      : executionResult.postMortem.calibration_delta.toFixed(6)}
                  </div>
                </div>
                <div className="p-2 bg-[#0c101b] rounded border border-white/[0.04]">
                  <div className="text-[10px] text-slate-400">90% MC INTERVAL</div>
                  <div className="text-emerald-300 font-bold text-sm">
                    {executionResult.postMortem.within_p05_p95_interval ? 'CAPTURED' : 'OUTLIER'}
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 bg-[#0c101b] p-2.5 rounded border border-white/[0.04]">
                {executionResult.postMortem.empirical_notes}
              </div>

              {executionResult.upgrade && (
                <div className="text-[11px] font-mono text-emerald-400/90">
                  Autonomous Upgrade: {executionResult.upgrade.action_type} recorded (applied EWMA step: {executionResult.upgrade.applied_ewma_step.toFixed(4)}).
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
