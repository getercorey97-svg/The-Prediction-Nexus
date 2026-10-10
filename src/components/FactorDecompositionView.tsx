/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { evaluateQuantumGovernor } from '../services/simulationEngine';
import {
  Sliders,
  Activity,
  Info,
  RefreshCw,
  Atom,
  Flame,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface FactorModel {
  sport: 'mlb' | 'cfb' | 'nfl' | 'tennis';
  title: string;
  formula: string;
  classicalBaselineProb: number;
  factors: { name: string; key: string; weight: number; description: string; currentVal: number }[];
}

const DEFAULT_FACTOR_MODELS: Record<'mlb' | 'cfb' | 'nfl' | 'tennis', FactorModel> = {
  mlb: {
    sport: 'mlb',
    title: 'MLB BaseRuns & FIP Quantitative Engine',
    formula: 'Expected Margin = (BaseRuns_Home - BaseRuns_Away) * W_BR + (FIP_Away - FIP_Home) * W_FIP + Bullpen_Delta * W_BP',
    classicalBaselineProb: 0.554,
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
    classicalBaselineProb: 0.592,
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
    classicalBaselineProb: 0.562,
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
    classicalBaselineProb: 0.715,
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

  // Quantum Governor Controls (The Geter Principle)
  const [leverageIndex, setLeverageIndex] = useState<number>(0.25);
  const [phaseThetaDegrees, setPhaseThetaDegrees] = useState<number>(45);

  const currentModel = modelState[activeSport];
  const phaseThetaRadians = (phaseThetaDegrees * Math.PI) / 180;

  // Evaluate YS formula: p(π) = f(π) + q(π) via The Geter Principle
  const quantumState = evaluateQuantumGovernor(
    currentModel.classicalBaselineProb,
    leverageIndex,
    phaseThetaRadians
  );

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
    setLeverageIndex(0.25);
    setPhaseThetaDegrees(45);
  };

  const totalWeight = currentModel.factors.reduce((acc, f) => acc + f.weight, 0);

  // Dynamic trigonometric phase wave points for visualization
  const wavePoints = Array.from({ length: 36 }, (_, i) => {
    const deg = i * 10;
    const rad = (deg * Math.PI) / 180;
    const val = Math.cos(rad);
    return { deg, val, isCurrent: Math.abs(deg - phaseThetaDegrees) < 5 };
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Model Factor Decomposition & Quantum Governor</h2>
          <p className="text-xs text-slate-400">
            Yukalov-Sornette (YS) Quantum Decision Theory governed by <span className="text-emerald-400 font-mono font-medium">The Geter Principle (The Chaos or Peace Paradox)</span>
          </p>
        </div>

        <button
          onClick={handleResetWeights}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-[#0e1422] border border-white/[0.08] rounded-md hover:bg-white/[0.08] transition-colors font-mono"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Parameters</span>
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

      {/* ========================================================================= */}
      {/* QUANTUM STATE INSPECTOR (THE GETER PRINCIPLE: THE CHAOS OR PEACE PARADOX) */}
      {/* ========================================================================= */}
      <section className="p-6 bg-[#0e1422] rounded-lg border border-white/[0.08] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              quantumState.stateMode === 'PEACE'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                : 'bg-violet-500/15 border border-violet-500/30 text-violet-400'
            }`}>
              <Atom className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Quantum State Inspector</h3>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                  quantumState.stateMode === 'PEACE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-violet-500/10 text-violet-400 border-violet-500/30'
                }`}>
                  {quantumState.stateMode} STATE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Yukalov-Sornette YS Formula: <span className="text-white">p(π) = f(π) + q(π)</span>
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] font-mono text-slate-400">Decoherence Governor:</div>
            <div className={`text-xs font-mono font-bold ${
              quantumState.stateMode === 'PEACE' ? 'text-emerald-400' : 'text-violet-400'
            }`}>
              {quantumState.stateMode === 'PEACE' ? 'q(π) → 0 (Classical Dominance)' : 'q(π) Active (Quantum Phase Shift)'}
            </div>
          </div>
        </div>

        {/* Comparative Metrics Grid: f(π) vs q(π) vs p(π) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-[#080c14] rounded-lg border border-white/[0.06]">
            <div className="text-slate-400 text-[11px]">Classical Baseline f(π)</div>
            <div className="mt-1 text-lg font-bold text-white tabular-nums">
              {(quantumState.classicalF * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">BaseRuns / EPA / Surface Elo</div>
          </div>

          <div className="p-3.5 bg-[#080c14] rounded-lg border border-white/[0.06]">
            <div className="text-slate-400 text-[11px]">Quantum Interference q(π)</div>
            <div className={`mt-1 text-lg font-bold tabular-nums ${
              quantumState.quantumQ > 0
                ? 'text-emerald-400'
                : quantumState.quantumQ < 0
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}>
              {quantumState.quantumQ > 0 ? `+${(quantumState.quantumQ * 100).toFixed(2)}%` : `${(quantumState.quantumQ * 100).toFixed(2)}%`}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {quantumState.stateMode === 'PEACE' ? 'Decohered to 0.00%' : '2·√(f(1-f))·cos(θ)'}
            </div>
          </div>

          <div className="p-3.5 bg-[#080c14] rounded-lg border border-white/[0.06]">
            <div className="text-slate-400 text-[11px]">Governed Probability p(π)</div>
            <div className="mt-1 text-lg font-bold text-emerald-300 tabular-nums">
              {(quantumState.governedP * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">Sigmoidal Log-Odds Projection</div>
          </div>

          <div className="p-3.5 bg-[#080c14] rounded-lg border border-white/[0.06]">
            <div className="text-slate-400 text-[11px]">Volatility Expansion</div>
            <div className="mt-1 text-lg font-bold text-amber-300 tabular-nums">
              {quantumState.volatilityExpansion.toFixed(2)}×
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">50,003 Monte Carlo Variance</div>
          </div>
        </div>

        {/* Interactive Sliders: Game Leverage Index & Phase Theta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-[#080c14] rounded-lg border border-white/[0.06]">
          {/* Game Leverage Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Game Leverage Index</span>
              </span>
              <span className={`font-bold ${leverageIndex >= 0.5 ? 'text-violet-400' : 'text-emerald-400'}`}>
                {leverageIndex.toFixed(2)} ({leverageIndex >= 0.5 ? 'CHAOS TRIGGERED' : 'PEACE REGIME'})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={leverageIndex}
              onChange={(e) => setLeverageIndex(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.0 (Low Leverage)</span>
              <span>0.50 (Threshold)</span>
              <span>1.0 (Maximum Inflection)</span>
            </div>
          </div>

          {/* Phase Angle Theta Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Phase Angle θ</span>
              </span>
              <span className="font-bold text-amber-400 font-mono">
                {phaseThetaDegrees}° (cos θ = {Math.cos(phaseThetaRadians).toFixed(2)})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={phaseThetaDegrees}
              onChange={(e) => setPhaseThetaDegrees(parseInt(e.target.value))}
              disabled={leverageIndex < 0.5}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                leverageIndex < 0.5 ? 'bg-slate-800 opacity-40 cursor-not-allowed' : 'bg-slate-800 accent-amber-400'
              }`}
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0° (+Constructive)</span>
              <span>90° (Neutral)</span>
              <span>180° (-Destructive)</span>
              <span>360°</span>
            </div>
          </div>
        </div>

        {/* Quantum Interference Waveform Visualization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="text-[11px] font-semibold text-slate-300 uppercase">
              Phase Angle Interference Curve cos(θ)
            </span>
            <span className="text-[11px]">
              {Math.cos(phaseThetaRadians) >= 0 ? 'Constructive Surge (Positive Bias)' : 'Destructive Shock (Negative Bias)'}
            </span>
          </div>

          <div className="p-4 bg-[#080c14] rounded-lg border border-white/[0.04]">
            <div className="h-16 flex items-center justify-between gap-1">
              {wavePoints.map((pt, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-center h-full group relative">
                  <div
                    className={`w-full rounded-t transition-all ${
                      pt.isCurrent
                        ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                        : pt.val >= 0
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/40'
                        : 'bg-rose-500/20 hover:bg-rose-500/40'
                    }`}
                    style={{
                      height: `${Math.max(4, Math.abs(pt.val) * 100)}%`,
                      marginTop: pt.val < 0 ? 'auto' : '0',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-2">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
              <span>270°</span>
              <span>360°</span>
            </div>
          </div>
        </div>

        {/* Inflection Trigger Diagnostic Note */}
        <div className="p-3 bg-[#080c14] rounded border border-white/[0.04] text-xs font-mono text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="text-white font-semibold">Active State Rationale:</span> {quantumState.inflectionTrigger}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* STATISTICAL FACTOR DECOMPOSITION (BASERUNS, FIP, EPA, HAVOC, SURFACE ELO) */}
      {/* ========================================================================= */}
      <section className="p-6 bg-[#0e1422] rounded-lg border border-white/[0.08] space-y-6">
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
      </section>
    </div>
  );
};
