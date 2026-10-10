/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, Activity, Info, RefreshCw, CheckCircle2 } from 'lucide-react';

interface FactorModel {
  sport: 'mlb' | 'cfb' | 'nfl' | 'tennis';
  title: string;
  formula: string;
  factors: { name: string; key: string; weight: number; description: string; currentVal: number }[];
}

const DEFAULT_FACTOR_MODELS: Record<'mlb' | 'cfb' | 'nfl' | 'tennis', FactorModel> = {
  mlb: {
    sport: 'mlb',
    title: 'MLB BaseRuns & FIP Quantitative Engine',
    formula: 'Expected Margin = (BaseRuns_Home - BaseRuns_Away) * W_BR + (FIP_Away - FIP_Home) * W_FIP + Bullpen_Delta * W_BP',
    factors: [
      { name: 'BaseRuns Offensive Generation', key: 'baseruns_weight', weight: 0.58, currentVal: 4.85, description: 'Statcast linear weights modeling discrete baserunner advance and score events.' },
      { name: 'Pitcher FIP Differential', key: 'fip_pitcher_weight', weight: 0.32, currentVal: 3.42, description: 'Fielding Independent Pitching isolating strikeouts, walks, and home runs allowed.' },
      { name: 'Bullpen High-Leverage Split', key: 'bullpen_leverage_weight', weight: 0.10, currentVal: 0.45, description: 'Relief corps win-probability-added leverage index for 7th-9th innings.' },
    ],
  },
  cfb: {
    sport: 'cfb',
    title: 'College Football EPA & Havoc Differential',
    formula: 'Expected Margin = (EPA_Offense - EPA_Defense) * 18.0 + Havoc_Diff * W_Havoc + HFA (2.4 pts)',
    factors: [
      { name: 'Offensive EPA per Play', key: 'offense_epa_weight', weight: 0.45, currentVal: 0.28, description: 'Expected Points Added on scrimmage plays adjusting for down, distance, and field position.' },
      { name: 'Defensive EPA Resistance', key: 'defense_epa_weight', weight: 0.35, currentVal: 0.15, description: 'Points suppressed per opponent drive vs. national collegiate baseline.' },
      { name: 'Havoc Rate Differential', key: 'havoc_differential_weight', weight: 0.15, currentVal: 0.08, description: 'Percentage of plays resulting in TFL, pass defended, or forced fumble.' },
      { name: 'Home Field Advantage', key: 'home_field_advantage_pts', weight: 0.05, currentVal: 2.4, description: 'Fixed collegiate home venue advantage in points.' },
    ],
  },
  nfl: {
    sport: 'nfl',
    title: 'NFL EPA, Success Rate & QB CPOE',
    formula: 'Expected Margin = Pass_EPA * W_Pass + Rush_EPA * W_Rush + QB_CPOE * W_CPOE + RedZone_Delta * W_RZ',
    factors: [
      { name: 'Passing EPA Differential', key: 'pass_epa_weight', weight: 0.40, currentVal: 0.22, description: 'Passing expected points added per dropback incorporating sacks and scrambles.' },
      { name: 'Quarterback CPOE', key: 'qb_cpoe_weight', weight: 0.25, currentVal: 4.8, description: 'Completion Percentage Over Expected modeling throw difficulty and separation.' },
      { name: 'Rushing EPA per Carry', key: 'rush_epa_weight', weight: 0.20, currentVal: 0.04, description: 'Ground efficiency and early-down rush success rate.' },
      { name: 'Red Zone Conversion Delta', key: 'red_zone_success_weight', weight: 0.15, currentVal: 0.62, description: 'Touchdown conversion efficiency within the opponent 20-yard line.' },
    ],
  },
  tennis: {
    sport: 'tennis',
    title: 'Tennis Surface-Specific Elo & Service Hold Dynamics',
    formula: 'Logistic Win Prob = 1 / (1 + 10^(-(Elo_Surface_Delta * W_Elo + Hold_Delta * W_Hold) / 400))',
    factors: [
      { name: 'Surface-Specific Elo', key: 'surface_elo_weight', weight: 0.65, currentVal: 2240, description: 'Dynamic Elo rating partitioned specifically for Hard, Clay, or Grass court history.' },
      { name: 'Serve Dominance Index', key: 'serve_dominance_weight', weight: 0.20, currentVal: 0.72, description: 'First-serve win percentage combined with ace-to-double-fault ratio.' },
      { name: 'Fatigue & Decay Rate', key: 'fatigue_decay_rate', weight: 0.15, currentVal: 0.05, description: 'Cumulative court hours over previous 7 days impacting physical endurance.' },
    ],
  },
};

export const FactorDecompositionView: React.FC = () => {
  const [activeSport, setActiveSport] = useState<'mlb' | 'cfb' | 'nfl' | 'tennis'>('mlb');
  const [modelState, setModelState] = useState(DEFAULT_FACTOR_MODELS);

  const currentModel = modelState[activeSport];

  const handleWeightChange = (key: string, newWeight: number) => {
    setModelState((prev) => {
      const updated = { ...prev };
      const current = { ...updated[activeSport] };
      current.factors = current.factors.map((f) =>
        f.key === key ? { ...f, weight: Number(newWeight.toFixed(2)) } : f
      );
      updated[activeSport] = current;
      return updated;
    });
  };

  const handleResetWeights = () => {
    setModelState(DEFAULT_FACTOR_MODELS);
  };

  const totalWeight = currentModel.factors.reduce((acc, f) => acc + f.weight, 0);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Model Factor Decomposition Inspector</h2>
          <p className="text-xs text-slate-400">
            Deconstructs active predictive algorithms into constituent mathematical metrics and empirical weight balances
          </p>
        </div>

        <button
          onClick={handleResetWeights}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-[#0e1422] border border-white/[0.08] rounded-md hover:bg-white/[0.08] transition-colors font-mono"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Factor Weights</span>
        </button>
      </div>

      {/* Sport Selector Tabs */}
      <div className="grid grid-cols-4 gap-2 p-1 bg-[#0c101b] rounded-lg border border-white/[0.08]">
        {(['mlb', 'cfb', 'nfl', 'tennis'] as const).map((sport) => (
          <button
            key={sport}
            onClick={() => setActiveSport(sport)}
            className={`py-2 text-xs font-mono uppercase font-bold rounded-md transition-all ${
              activeSport === sport
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {sport} Engine
          </button>
        ))}
      </div>

      {/* Active Model Engine Details */}
      <div className="p-6 bg-[#0e1422] rounded-lg border border-white/[0.08] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <h3 className="text-sm font-bold text-white">{currentModel.title}</h3>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Active Parameters Normalized to 1.0 · Autonomous EWMA Calibrated
            </div>
          </div>

          <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
            Total Factor Weight Sum: {totalWeight.toFixed(2)}
          </div>
        </div>

        {/* Mathematical Formula Banner */}
        <div className="p-4 bg-[#080c14] rounded border border-white/[0.06] text-xs font-mono space-y-1">
          <div className="text-slate-500 uppercase text-[10px] font-semibold flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mathematical Representation</span>
          </div>
          <div className="text-emerald-300 font-medium overflow-x-auto whitespace-pre-wrap">
            {currentModel.formula}
          </div>
        </div>

        {/* Factor Weight Sliders & Breakdown */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
            Active Factor Weights & Decomposition
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentModel.factors.map((factor) => (
              <div
                key={factor.key}
                className="p-4 bg-[#080c14] rounded-lg border border-white/[0.06] space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{factor.name}</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    {(factor.weight * 100).toFixed(0)}%
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {factor.description}
                </p>

                {/* Interactive Slider */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Weight: {(factor.weight * 100).toFixed(0)}%</span>
                    <span>Sample Value: {factor.currentVal}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={factor.weight}
                    onChange={(e) => handleWeightChange(factor.key, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
