/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { runClientMonteCarloSimulation, SimulationResult } from '../services/simulationEngine';
import { SportingEvent } from '../types/database';
import { Cpu, Play, BarChart3, Server, CheckCircle2, Clock, Zap, Activity, Atom } from 'lucide-react';

interface SimulationLabViewProps {
  events: SportingEvent[];
}

export const SimulationLabView: React.FC<SimulationLabViewProps> = ({ events }) => {
  const [selectedSport, setSelectedSport] = useState<'mlb' | 'cfb' | 'nfl' | 'tennis'>('mlb');
  const [homeParticipant, setHomeParticipant] = useState('Atlanta Braves');
  const [awayParticipant, setAwayParticipant] = useState('Philadelphia Phillies');
  const [homeRating, setHomeRating] = useState<number>(4.75); // BaseRuns for MLB
  const [awayRating, setAwayRating] = useState<number>(4.52);
  const [marketMoneyline, setMarketMoneyline] = useState<number>(-120);

  // Quantum Governor Controls
  const [leverageIndex, setLeverageIndex] = useState<number>(0.25);
  const [phaseThetaDegrees, setPhaseThetaDegrees] = useState<number>(30);

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(() => {
    return runClientMonteCarloSimulation(
      'sim_init_braves_phillies',
      'mlb',
      'Atlanta Braves',
      'Philadelphia Phillies',
      4.75,
      4.52,
      -120,
      'Clay',
      0.25,
      (30 * Math.PI) / 180
    );
  });

  const handleSportChange = (sport: 'mlb' | 'cfb' | 'nfl' | 'tennis') => {
    setSelectedSport(sport);
    if (sport === 'mlb') {
      setHomeParticipant('Atlanta Braves');
      setAwayParticipant('Philadelphia Phillies');
      setHomeRating(4.75);
      setAwayRating(4.52);
      setMarketMoneyline(-120);
    } else if (sport === 'cfb') {
      setHomeParticipant('Georgia Bulldogs');
      setAwayParticipant('Alabama Crimson Tide');
      setHomeRating(0.24); // EPA/play
      setAwayRating(0.19);
      setMarketMoneyline(-135);
    } else if (sport === 'nfl') {
      setHomeParticipant('Kansas City Chiefs');
      setAwayParticipant('Baltimore Ravens');
      setHomeRating(0.19);
      setAwayRating(0.16);
      setMarketMoneyline(-120);
    } else if (sport === 'tennis') {
      setHomeParticipant('Carlos Alcaraz');
      setAwayParticipant('Alexander Zverev');
      setHomeRating(2240); // Surface Elo
      setAwayRating(2085);
      setMarketMoneyline(-260);
    }
  };

  const handleRunSimulation = () => {
    const eventId = `manual_sim_${selectedSport}_${Date.now()}`;
    const phaseThetaRadians = (phaseThetaDegrees * Math.PI) / 180;
    const res = runClientMonteCarloSimulation(
      eventId,
      selectedSport,
      homeParticipant,
      awayParticipant,
      homeRating,
      awayRating,
      marketMoneyline,
      'Clay',
      leverageIndex,
      phaseThetaRadians
    );
    setSimulationResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Header and Worker Architecture Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Quantum 50,003 Monte Carlo & Worker Lab</h2>
          <p className="text-xs text-slate-400">
            Yukalov-Sornette Quantum Governor intercepting <span className="font-mono text-emerald-400 font-medium">50,003 vectorized iterations</span> across Peace & Chaos states
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 bg-[#0e1422] border border-white/[0.08] rounded-md text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>FastAPI ASGI Gateway</span>
          </div>
          <div className="px-3 py-1.5 bg-[#0e1422] border border-white/[0.08] rounded-md text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Celery + Redis Queue</span>
          </div>
        </div>
      </div>

      {/* Main Simulation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Simulation Parameters & Controls */}
        <div className="p-5 bg-[#0e1422] rounded-lg border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-2 font-semibold text-white text-xs uppercase tracking-wider font-mono">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Configure 50,003 Monte Carlo Run</span>
          </div>

          {/* Sport Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Sport Framework</label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#080c14] rounded border border-white/[0.08]">
              {(['mlb', 'cfb', 'nfl', 'tennis'] as const).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => handleSportChange(sp)}
                  className={`py-1 text-xs font-mono uppercase rounded transition-colors ${
                    selectedSport === sp
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Matchup Participants */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Home / Favored Participant</label>
              <input
                type="text"
                value={homeParticipant}
                onChange={(e) => setHomeParticipant(e.target.value)}
                className="w-full bg-[#080c14] border border-white/[0.1] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Away / Underdog Participant</label>
              <input
                type="text"
                value={awayParticipant}
                onChange={(e) => setAwayParticipant(e.target.value)}
                className="w-full bg-[#080c14] border border-white/[0.1] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* Advanced Sport Metric Ratings */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                {selectedSport === 'mlb'
                  ? 'Home BaseRuns'
                  : selectedSport === 'tennis'
                  ? 'Home Surface Elo'
                  : 'Home EPA/play'}
              </label>
              <input
                type="number"
                step={selectedSport === 'tennis' ? '5' : '0.01'}
                value={homeRating}
                onChange={(e) => setHomeRating(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#080c14] border border-white/[0.1] rounded px-2.5 py-1.5 font-mono text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                {selectedSport === 'mlb'
                  ? 'Away BaseRuns'
                  : selectedSport === 'tennis'
                  ? 'Away Surface Elo'
                  : 'Away EPA/play'}
              </label>
              <input
                type="number"
                step={selectedSport === 'tennis' ? '5' : '0.01'}
                value={awayRating}
                onChange={(e) => setAwayRating(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#080c14] border border-white/[0.1] rounded px-2.5 py-1.5 font-mono text-white text-xs"
              />
            </div>
          </div>

          {/* The Geter Principle: Quantum Leverage Slider */}
          <div className="p-3 bg-[#080c14] rounded border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-1">
                <Atom className="w-3.5 h-3.5 text-emerald-400" />
                <span>Quantum Leverage</span>
              </span>
              <span className={`font-bold ${leverageIndex >= 0.5 ? 'text-violet-400' : 'text-emerald-400'}`}>
                {leverageIndex >= 0.5 ? 'CHAOS' : 'PEACE'} ({leverageIndex.toFixed(2)})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={leverageIndex}
              onChange={(e) => setLeverageIndex(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Market Moneyline */}
          <div>
            <label className="block text-slate-400 text-xs mb-1 font-mono">Market Moneyline (for Kelly Alpha)</label>
            <input
              type="number"
              step="5"
              value={marketMoneyline}
              onChange={(e) => setMarketMoneyline(parseInt(e.target.value) || -110)}
              className="w-full bg-[#080c14] border border-white/[0.1] rounded px-2.5 py-1.5 font-mono text-white text-xs"
            />
          </div>

          <button
            onClick={handleRunSimulation}
            className="w-full py-2.5 px-4 bg-emerald-500 text-slate-950 font-semibold text-xs rounded-md hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run 50,003 Iterations</span>
          </button>
        </div>

        {/* Right 2 Columns: Vectorized Simulation Results & Distribution */}
        <div className="lg:col-span-2 space-y-4">
          {simulationResult && (
            <div className="p-5 bg-[#0e1422] rounded-lg border border-white/[0.08] space-y-5">
              {/* Benchmark Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {homeParticipant} vs {awayParticipant}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    Deterministic seed hash applied · 50,003 iterations
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                    simulationResult.quantumState.stateMode === 'PEACE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-violet-500/10 text-violet-400 border-violet-500/30'
                  }`}>
                    {simulationResult.quantumState.stateMode} STATE
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{simulationResult.executionDurationMs} ms</span>
                  </div>
                </div>
              </div>

              {/* Core Distribution Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#080c14] rounded border border-white/[0.04]">
                  <div className="text-slate-400">Governed Win Prob</div>
                  <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                    {(simulationResult.homeWinProbability * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Classical: {(simulationResult.quantumState.classicalF * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-3 bg-[#080c14] rounded border border-white/[0.04]">
                  <div className="text-slate-400">Quantum Interference q(π)</div>
                  <div className={`mt-1 font-mono text-base font-bold ${
                    simulationResult.quantumState.quantumQ > 0 ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    {simulationResult.quantumState.quantumQ > 0
                      ? `+${(simulationResult.quantumState.quantumQ * 100).toFixed(2)}%`
                      : `${(simulationResult.quantumState.quantumQ * 100).toFixed(2)}%`}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Volatility: {simulationResult.quantumState.volatilityExpansion.toFixed(2)}×
                  </div>
                </div>

                <div className="p-3 bg-[#080c14] rounded border border-white/[0.04]">
                  <div className="text-slate-400">Predicted Spread</div>
                  <div className="mt-1 font-mono text-base font-bold text-white">
                    {simulationResult.predictedHomeSpread > 0
                      ? `+${simulationResult.predictedHomeSpread}`
                      : simulationResult.predictedHomeSpread}{' '}
                    pts
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    90% MC: [{simulationResult.p05ScoreDiff}, {simulationResult.p95ScoreDiff}]
                  </div>
                </div>

                <div className="p-3 bg-[#080c14] rounded border border-white/[0.04]">
                  <div className="text-slate-400">Detected Edge</div>
                  <div className="mt-1 font-mono text-base font-bold text-emerald-300">
                    {simulationResult.edgeDetected !== null ? (
                      `${(simulationResult.edgeDetected * 100).toFixed(2)}%`
                    ) : (
                      'N/A'
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Quarter-Kelly: {simulationResult.kellyCriterionFraction !== null ? `${(simulationResult.kellyCriterionFraction * 100).toFixed(2)}%` : '0%'}
                  </div>
                </div>
              </div>

              {/* 50,003 Monte Carlo Distribution Histogram */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="uppercase text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>50,003 Iterations Simulated Score Margin Density</span>
                  </span>
                  <span>90% CI: [{simulationResult.p05ScoreDiff}, {simulationResult.p95ScoreDiff}]</span>
                </div>

                <div className="p-4 bg-[#080c14] rounded border border-white/[0.06] space-y-2">
                  <div className="grid grid-cols-7 gap-1.5 h-28 items-end">
                    {simulationResult.histogram.map((h, i) => (
                      <div key={i} className="flex flex-col items-center h-full justify-end group">
                        <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                          {h.percentage}%
                        </div>
                        <div
                          className={`w-full rounded-t transition-all ${
                            simulationResult.quantumState.stateMode === 'PEACE'
                              ? 'bg-emerald-500/30 hover:bg-emerald-500/60 border border-emerald-500/40'
                              : 'bg-violet-500/30 hover:bg-violet-500/60 border border-violet-500/40'
                          }`}
                          style={{ height: `${Math.max(8, h.percentage * 2.8)}%` }}
                        />
                        <div className="mt-1.5 text-[9px] font-mono text-slate-500 truncate w-full text-center">
                          {h.bucket}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Celery Asynchronous Architecture & Free Ingestor Status */}
          <div className="p-4 bg-[#080c14] border border-white/[0.08] rounded-lg text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white font-mono flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span>Free Sports Data Ingestors & Render Architecture</span>
              </span>
              <span className="font-mono text-emerald-400 text-[11px]">Render Free-Tier Ready</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2.5 bg-[#0e1422] rounded border border-white/[0.04]">
                <div className="text-emerald-400 font-semibold">pybaseball (MLB)</div>
                <div className="text-slate-400 mt-0.5">Statcast BaseRuns + FIP</div>
                <div className="text-slate-500 text-[10px] mt-1">Status: Active / Cached</div>
              </div>

              <div className="p-2.5 bg-[#0e1422] rounded border border-white/[0.04]">
                <div className="text-emerald-400 font-semibold">CFBD API (CFB)</div>
                <div className="text-slate-400 mt-0.5">EPA/play & Havoc Rate</div>
                <div className="text-slate-500 text-[10px] mt-1">Status: Active / Cached</div>
              </div>

              <div className="p-2.5 bg-[#0e1422] rounded border border-white/[0.04]">
                <div className="text-emerald-400 font-semibold">nfl_data_py (NFL)</div>
                <div className="text-slate-400 mt-0.5">Pass/Rush EPA & CPOE</div>
                <div className="text-slate-500 text-[10px] mt-1">Status: Active / Cached</div>
              </div>

              <div className="p-2.5 bg-[#0e1422] rounded border border-white/[0.04]">
                <div className="text-emerald-400 font-semibold">Live Tennis API</div>
                <div className="text-slate-400 mt-0.5">Surface-Specific Elo</div>
                <div className="text-slate-500 text-[10px] mt-1">Status: Active / Cached</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
