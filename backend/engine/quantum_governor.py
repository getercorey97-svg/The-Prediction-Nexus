"""
The Prediction Nexus: Yukalov-Sornette (YS) Quantum Decision Theory Engine
===========================================================================
Governed by The Geter Principle (The Chaos or Peace Paradox).

Core Formulation:
    p(π) = f(π) + q(π)

Where:
    - f(π): Classical rational probability derived from verifiable statistical
            fundamentals (BaseRuns, EPA, Surface Elo).
    - q(π): Quantum interference term modeling cognitive momentum and emotional
            superposition under high-leverage game states:
            q(π) = 2 * sqrt(f(π) * (1 - f(π))) * cos(θ)

The Geter Principle Decoherence Governor:
    - PEACE STATE: When game leverage is low/nominal and momentum aligns with
      statistical expectations, quantum interference decoheres (q(π) -> 0).
      Classical probability dominates: p(π) = f(π).
    - CHAOS STATE: Triggered by high-leverage inflection events (sudden turnovers,
      late bullpen leverage, break-point pressure, 2-minute drills). The governor
      activates phase interference q(π), shifting outcome probabilities and expanding
      distributional variance.
"""

from __future__ import annotations

import math
import numpy as np
from typing import Dict, Any, Tuple
from dataclasses import dataclass


@dataclass
class QuantumState:
    state_mode: str          # "PEACE" or "CHAOS"
    leverage_index: float    # 0.0 to 1.0 (inflection intensity)
    phase_theta: float       # Phase angle in radians [0, 2*pi]
    classical_f: float       # Classical probability f(π)
    quantum_q: float         # Quantum interference term q(π)
    governed_p: float        # Final quantum-governed probability p(π)
    volatility_expansion: float  # Multiplier for Monte Carlo variance (1.0 to 1.5)
    inflection_trigger: str  # Description of event triggering the state


class QuantumGovernor:
    """
    Decoherence Governor implementing The Geter Principle.
    Controls the transition between classical statistical dominance (Peace)
    and quantum interference volatility (Chaos).
    """

    CHAOS_LEVERAGE_THRESHOLD: float = 0.50

    @classmethod
    def evaluate(
        cls,
        classical_prob: float,
        leverage_index: float = 0.20,
        phase_theta: float = 0.0,
        inflection_trigger: str | None = None,
    ) -> QuantumState:
        """
        Evaluates the quantum state for a decision alternative π.
        Applies sigmoidal log-odds projection to guarantee strict normalization in (0, 1).
        """
        # Clamp classical baseline to valid open probability bounds
        f = max(0.001, min(0.999, float(classical_prob)))
        leverage = max(0.0, min(1.0, float(leverage_index)))

        # The Geter Principle: Determine Peace or Chaos
        if leverage < cls.CHAOS_LEVERAGE_THRESHOLD:
            # PEACE STATE: Statistical alignment. Quantum interference attenuates to zero.
            state_mode = "PEACE"
            q = 0.0
            governed_p = f
            volatility_expansion = 1.0
            trigger = inflection_trigger or "Nominal game state: momentum aligns with classical expectation."
        else:
            # CHAOS STATE: High-leverage inflection triggers quantum interference.
            state_mode = "CHAOS"

            # Maximum quantum interference amplitude: 2 * sqrt(f * (1 - f))
            max_amplitude = 2.0 * math.sqrt(f * (1.0 - f))

            # Leverage damping modulates amplitude
            chaos_intensity = (leverage - cls.CHAOS_LEVERAGE_THRESHOLD) / (1.0 - cls.CHAOS_LEVERAGE_THRESHOLD)
            active_amplitude = max_amplitude * chaos_intensity

            # YS interference term: q(π) = active_amplitude * cos(θ)
            q = active_amplitude * math.cos(phase_theta)

            # Sigmoidal log-odds projection preserving unit interval [0.001, 0.999]
            # logit(p) = logit(f) + delta_q
            logit_f = math.log(f / (1.0 - f))
            delta_q = q / max(0.01, math.sqrt(f * (1.0 - f)))
            logit_p = logit_f + delta_q
            governed_p = 1.0 / (1.0 + math.exp(-logit_p))
            governed_p = max(0.001, min(0.999, governed_p))

            # Quantum volatility expansion expands Monte Carlo variance by up to 45%
            volatility_expansion = 1.0 + (abs(q) * 0.75)
            trigger = inflection_trigger or f"High-leverage inflection detected (Index: {leverage:.2f}). Phase theta: {math.degrees(phase_theta):.1f}°."

        return QuantumState(
            state_mode=state_mode,
            leverage_index=round(leverage, 4),
            phase_theta=round(phase_theta, 4),
            classical_f=round(f, 4),
            quantum_q=round(q, 4),
            governed_p=round(governed_p, 4),
            volatility_expansion=round(volatility_expansion, 4),
            inflection_trigger=trigger,
        )

    @classmethod
    def scan_inflection_triggers(cls, sport: str, game_state: Dict[str, Any]) -> Tuple[float, float, str]:
        """
        Scans sport-specific telemetry to derive leverage index and phase theta θ.
        Returns (leverage_index, phase_theta, trigger_description).
        """
        sport_norm = sport.lower().strip()

        if sport_norm == "mlb":
            # High leverage: 7th+ inning, close game (margin <= 2), runners in scoring position
            inning = game_state.get("inning", 1)
            margin = abs(game_state.get("margin", 0))
            risp = game_state.get("runners_in_scoring_position", False)
            if inning >= 7 and margin <= 2 and risp:
                return 0.85, 0.25 * math.pi, "Late bullpen leverage: bases loaded / runners in scoring position."
            elif inning >= 8 and margin <= 1:
                return 0.75, -0.20 * math.pi, "High-pressure 9th inning save situation."
            return 0.20, 0.0, "Standard early/mid game state."

        elif sport_norm == "cfb":
            # High leverage: 4th down attempt, turnover margin shock, havoc spike
            havoc_spike = game_state.get("havoc_spike", False)
            fourth_down = game_state.get("is_fourth_down", False)
            score_diff = abs(game_state.get("score_diff", 0))
            if havoc_spike or (fourth_down and score_diff <= 7):
                return 0.88, 0.35 * math.pi, "Collegiate Havoc spike: critical 4th down red-zone possession."
            return 0.25, 0.0, "Stable collegiate drive sequencing."

        elif sport_norm == "nfl":
            # High leverage: 2-minute drill, 4th down red-zone, overtime
            two_minute_drill = game_state.get("two_minute_warning", False)
            margin = abs(game_state.get("score_diff", 0))
            is_overtime = game_state.get("is_overtime", False)
            if is_overtime:
                return 0.95, 0.15 * math.pi, "Sudden-death overtime possession."
            elif two_minute_drill and margin <= 8:
                return 0.82, -0.30 * math.pi, "NFL 2-minute drill under one-possession deficit."
            return 0.20, 0.0, "Nominal game clock rhythm."

        elif sport_norm == "tennis":
            # High leverage: Break point, tiebreak decider, deuce count >= 3
            is_break_point = game_state.get("is_break_point", False)
            is_tiebreak = game_state.get("is_tiebreak", False)
            deuce_count = game_state.get("deuce_count", 0)
            if is_tiebreak:
                return 0.90, 0.40 * math.pi, "Deciding set tiebreak: maximum mental inflection."
            elif is_break_point or deuce_count >= 3:
                return 0.78, -0.25 * math.pi, "High-pressure break point conversion opportunity."
            return 0.15, 0.0, "Standard service game progression."

        return 0.20, 0.0, "Equilibrium state."
