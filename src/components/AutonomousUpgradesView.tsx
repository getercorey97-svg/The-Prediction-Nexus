/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AutonomousUpgrade, FrameworkVersion } from '../types/database';
import { RefreshCw, Sliders, ShieldAlert, Zap } from 'lucide-react';

interface AutonomousUpgradesViewProps {
  upgrades: AutonomousUpgrade[];
  frameworks: FrameworkVersion[];
}

export const AutonomousUpgradesView: React.FC<AutonomousUpgradesViewProps> = ({
  upgrades,
  frameworks,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Autonomous EWMA Upgrades & Audit Log</h2>
          <p className="text-xs text-slate-400">
            Automated adjustments executed by PostgreSQL trigger <span className="font-mono text-slate-300">fn_trigger_autonomous_model_upgrade()</span> upon post-mortem insertion
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0e1422] border border-white/[0.08] rounded-md text-xs font-mono text-emerald-400">
          <Zap className="w-3.5 h-3.5" />
          <span>Trigger Active (Zero Human Intervention)</span>
        </div>
      </div>

      <div className="space-y-4">
        {upgrades.map((upg) => {
          const framework = frameworks.find((f) => f.id === upg.framework_id);

          return (
            <div
              key={upg.id}
              className="p-5 bg-[#0e1422] rounded-lg border border-white/[0.08] space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {upg.action_type.replace('_', ' ')}
                  </span>
                  <span className="font-semibold text-white">{framework?.version_tag || 'Framework'}</span>
                  <span className="text-slate-500 font-mono">({framework?.sport?.toUpperCase()})</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                  <span>EWMA Step: {upg.applied_ewma_step.toFixed(4)}</span>
                  <span className="text-slate-600">|</span>
                  <span>
                    Brier Delta:{' '}
                    <span className={upg.brier_delta < 0 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {upg.brier_delta > 0 ? `+${upg.brier_delta.toFixed(6)}` : upg.brier_delta.toFixed(6)}
                    </span>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span>{new Date(upg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Calibration Notes */}
              <p className="text-xs text-slate-300 font-mono bg-[#080c14] p-3 rounded border border-white/[0.04]">
                {upg.calibration_notes}
              </p>

              {/* Weight Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-3 bg-[#080c14] rounded border border-white/[0.04]">
                  <div className="text-slate-500 uppercase font-semibold text-[10px] mb-1.5 flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-slate-400" />
                    <span>Previous Model Parameters</span>
                  </div>
                  <pre className="text-slate-400 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(upg.previous_weights, null, 2)}
                  </pre>
                </div>

                <div className="p-3 bg-[#080c14] rounded border border-white/[0.04]">
                  <div className="text-emerald-400 uppercase font-semibold text-[10px] mb-1.5 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-emerald-400" />
                    <span>Calibrated Parameters (Post-Trigger)</span>
                  </div>
                  <pre className="text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(upg.adjusted_weights, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
