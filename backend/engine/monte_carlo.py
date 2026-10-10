"""
The Prediction Nexus: Vectorized Monte Carlo Simulation Engine
================================================================
Upgraded with the Yukalov-Sornette (YS) Quantum Decision Theory
governed by The Geter Principle (The Chaos or Peace Paradox).

Mandates:
1. Exactly 50,003 iterations executed via vectorized NumPy routines.
2. Intercepts classical probability f(π) with QuantumGovernor.
3. Evaluates Peace or Chaos states: applies interference term q(π) and
   expands distributional variance in Chaos mode.
4. Deterministic hash seeding derived from the unique event ID.
5. Store strictly aggregated statistics (mean, percentiles, edge, Kelly).
"""

from __future__ import annotations

import hashlib
import numpy as np
from typing import Dict, Any, Tuple
from engine.quantum_governor import QuantumGovernor, QuantumState

SIMULATION_ITERATIONS: int = 50003


def get_deterministic_seed(event_id: str) -> int:
    """
    Derives a deterministic 32-bit unsigned integer seed from the event_id hash.
    Ensures reproducibility across identical events without human variance.
    """
    digest = hashlib.sha256(event_id.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def run_monte_carlo_simulation(
    event_id: str,
    sport: str,
    home_rating: float,
    away_rating: float,
    model_params: Dict[str, Any],
    market_odds: Dict[str, Any] | None = None,
    game_state: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Executes exactly 50,003 vectorized Monte Carlo iterations with the
    Yukalov-Sornette Quantum Governor intercepting classical probabilities.
    """
    seed = get_deterministic_seed(event_id)
    rng = np.random.default_rng(seed)

    sport_normalized = sport.lower().strip()
    market_odds = market_odds or {}
    game_state = game_state or {}

    # Step 1: Classical Baseline Probability Estimation f(π)
    classical_f = _compute_classical_baseline_prob(sport_normalized, home_rating, away_rating, model_params)

    # Step 2: Quantum Decision Theory Interception via The Geter Principle
    leverage_index = float(game_state.get("leverage_index", 0.20))
    phase_theta = float(game_state.get("phase_theta", 0.0))

    # Auto-scan if leverage not explicitly provided
    if "leverage_index" not in game_state:
        leverage_index, phase_theta, trigger_desc = QuantumGovernor.scan_inflection_triggers(sport_normalized, game_state)
    else:
        trigger_desc = game_state.get("inflection_trigger", "Manual leverage parameter configuration.")

    q_state = QuantumGovernor.evaluate(
        classical_prob=classical_f,
        leverage_index=leverage_index,
        phase_theta=phase_theta,
        inflection_trigger=trigger_desc,
    )

    # Step 3: Run Vectorized 50,003 Simulations with Quantum Volatility & Mean Shift
    # In Chaos state, quantum interference shifts expected margins and dilates variance
    adjusted_params = dict(model_params)
    base_variance_dampener = float(model_params.get("variance_dampener", 1.0))
    adjusted_params["variance_dampener"] = base_variance_dampener * q_state.volatility_expansion
    adjusted_params["quantum_q"] = q_state.quantum_q

    if sport_normalized == "mlb":
        home_scores, away_scores = _simulate_mlb_vectorized(rng, home_rating, away_rating, adjusted_params, q_state)
    elif sport_normalized == "cfb":
        home_scores, away_scores = _simulate_cfb_vectorized(rng, home_rating, away_rating, adjusted_params, q_state)
    elif sport_normalized == "nfl":
        home_scores, away_scores = _simulate_nfl_vectorized(rng, home_rating, away_rating, adjusted_params, q_state)
    elif sport_normalized == "tennis":
        home_scores, away_scores = _simulate_tennis_vectorized(rng, home_rating, away_rating, adjusted_params, q_state)
    else:
        home_scores, away_scores = _simulate_generic_vectorized(rng, home_rating, away_rating, adjusted_params, q_state)

    # Calculate vectorized margins and totals
    margins = home_scores - away_scores
    totals = home_scores + away_scores

    home_wins = np.sum(margins > 0)
    ties = np.sum(margins == 0)
    home_win_prob = float((home_wins + 0.5 * ties) / SIMULATION_ITERATIONS)
    away_win_prob = float(1.0 - home_win_prob)

    # Distributional aggregates (Mean & 90% Confidence Bounds [p05, p95])
    predicted_home_spread = float(np.round(np.mean(margins), 2))
    predicted_total_score = float(np.round(np.mean(totals), 2))

    p05_score_diff = float(np.round(np.percentile(margins, 5), 2))
    p95_score_diff = float(np.round(np.percentile(margins, 95), 2))

    p05_total_score = float(np.round(np.percentile(totals, 5), 2))
    p95_total_score = float(np.round(np.percentile(totals, 95), 2))

    # Market odds & Edge derivation against market
    market_implied_home_prob = None
    market_implied_away_prob = None
    edge_detected = None
    kelly_criterion_fraction = None

    home_ml = market_odds.get("home_moneyline")
    away_ml = market_odds.get("away_moneyline")

    if home_ml is not None and away_ml is not None:
        market_implied_home_prob = float(np.round(_convert_moneyline_to_implied_prob(home_ml), 4))
        market_implied_away_prob = float(np.round(_convert_moneyline_to_implied_prob(away_ml), 4))
        edge_detected = float(np.round(home_win_prob - market_implied_home_prob, 4))

        decimal_odds = _convert_moneyline_to_decimal(home_ml)
        b = decimal_odds - 1.0
        if b > 0 and edge_detected > 0:
            p = home_win_prob
            q = 1.0 - p
            kelly_fraction = max(0.0, (b * p - q) / b)
            kelly_criterion_fraction = float(np.round(kelly_fraction * 0.25, 4))

    return {
        "event_id": event_id,
        "sport": sport_normalized,
        "simulation_iterations": SIMULATION_ITERATIONS,
        "home_win_probability": round(home_win_prob, 4),
        "away_win_probability": round(away_win_prob, 4),
        "predicted_home_spread": predicted_home_spread,
        "predicted_total_score": predicted_total_score,
        "p05_score_diff": p05_score_diff,
        "p95_score_diff": p95_score_diff,
        "p05_total_score": p05_total_score,
        "p95_total_score": p95_total_score,
        "market_implied_home_prob": market_implied_home_prob,
        "market_implied_away_prob": market_implied_away_prob,
        "edge_detected": edge_detected,
        "kelly_criterion_fraction": kelly_criterion_fraction,
        "market_odds": market_odds,
        # Quantum Decision Theory Metadata
        "quantum_state": {
            "state_mode": q_state.state_mode,
            "leverage_index": q_state.leverage_index,
            "phase_theta": q_state.phase_theta,
            "classical_f": q_state.classical_f,
            "quantum_q": q_state.quantum_q,
            "governed_p": q_state.governed_p,
            "volatility_expansion": q_state.volatility_expansion,
            "inflection_trigger": q_state.inflection_trigger,
        },
    }


def _compute_classical_baseline_prob(
    sport: str, home_rating: float, away_rating: float, params: Dict[str, Any]
) -> float:
    """Computes rational classical frequentist win probability f(π)."""
    if sport == "tennis":
        elo_diff = home_rating - away_rating
        return 1.0 / (1.0 + 10.0 ** (-elo_diff / 400.0))
    elif sport == "mlb":
        # Pythagenpat exponent on BaseRuns
        gamma = 1.83
        r_home = max(1.0, home_rating) ** gamma
        r_away = max(1.0, away_rating) ** gamma
        return r_home / (r_home + r_away)
    elif sport in ["cfb", "nfl"]:
        diff = home_rating - away_rating
        # Standard normal CDF approximation on rating differential
        z = diff * 2.5
        return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
    return 0.50


def _simulate_mlb_vectorized(
    rng: np.random.Generator,
    home_baseruns: float,
    away_baseruns: float,
    params: Dict[str, Any],
    q_state: QuantumState,
) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorized MLB generator with quantum interference shift."""
    # Mean shift proportional to quantum interference q(π)
    shift = q_state.quantum_q * 1.5
    lambda_home = max(1.5, (home_baseruns + shift) * 1.02)
    lambda_away = max(1.5, (away_baseruns - shift) * 0.98)

    home_runs = rng.poisson(lam=lambda_home, size=SIMULATION_ITERATIONS).astype(float)
    away_runs = rng.poisson(lam=lambda_away, size=SIMULATION_ITERATIONS).astype(float)

    # Extra-innings resolution
    ties = home_runs == away_runs
    tie_count = int(np.sum(ties))
    if tie_count > 0:
        p_home_extra = 0.525 + (q_state.quantum_q * 0.20)
        home_extra_win = rng.uniform(0, 1, size=tie_count) < p_home_extra
        home_runs[ties] += np.where(home_extra_win, 1.0, 0.0)
        away_runs[ties] += np.where(home_extra_win, 0.0, 1.0)

    return home_runs, away_runs


def _simulate_cfb_vectorized(
    rng: np.random.Generator,
    home_epa: float,
    away_epa: float,
    params: Dict[str, Any],
    q_state: QuantumState,
) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorized CFB generator with quantum volatility expansion and spread shift."""
    hfa = float(params.get("home_field_advantage_pts", 2.4))
    std_dev = 15.2 * float(params.get("variance_dampener", 0.95))

    # Quantum mean point shift
    point_shift = q_state.quantum_q * 6.5
    mean_home = 28.5 + (home_epa * 18.0) + (hfa / 2.0) + point_shift
    mean_away = 26.0 + (away_epa * 18.0) - (hfa / 2.0) - point_shift

    corr = 0.12
    cov = [[std_dev**2, corr * std_dev**2], [corr * std_dev**2, std_dev**2]]
    scores = rng.multivariate_normal([mean_home, mean_away], cov, size=SIMULATION_ITERATIONS)

    home_scores = np.clip(np.round(scores[:, 0]), 0, 90)
    away_scores = np.clip(np.round(scores[:, 1]), 0, 90)

    ties = home_scores == away_scores
    tie_count = int(np.sum(ties))
    if tie_count > 0:
        p_ot = 0.51 + (q_state.quantum_q * 0.15)
        home_ot_win = rng.uniform(0, 1, size=tie_count) < p_ot
        home_scores[ties] += np.where(home_ot_win, 3.0, 0.0)
        away_scores[ties] += np.where(home_ot_win, 0.0, 3.0)

    return home_scores, away_scores


def _simulate_nfl_vectorized(
    rng: np.random.Generator,
    home_epa: float,
    away_epa: float,
    params: Dict[str, Any],
    q_state: QuantumState,
) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorized NFL generator with quantum momentum shift."""
    std_dev = 12.8 * float(params.get("variance_dampener", 1.0))
    point_shift = q_state.quantum_q * 5.0
    mean_home = 23.5 + (home_epa * 15.0) + 1.5 + point_shift
    mean_away = 21.0 + (away_epa * 15.0) - 1.5 - point_shift

    corr = 0.15
    cov = [[std_dev**2, corr * std_dev**2], [corr * std_dev**2, std_dev**2]]
    scores = rng.multivariate_normal([mean_home, mean_away], cov, size=SIMULATION_ITERATIONS)

    home_scores = np.clip(np.round(scores[:, 0]), 0, 70)
    away_scores = np.clip(np.round(scores[:, 1]), 0, 70)

    ties = home_scores == away_scores
    tie_count = int(np.sum(ties))
    if tie_count > 0:
        p_ot = 0.52 + (q_state.quantum_q * 0.15)
        home_ot_win = rng.uniform(0, 1, size=tie_count) < p_ot
        home_scores[ties] += np.where(home_ot_win, 3.0, 0.0)
        away_scores[ties] += np.where(home_ot_win, 0.0, 3.0)

    return home_scores, away_scores


def _simulate_tennis_vectorized(
    rng: np.random.Generator,
    home_surface_elo: float,
    away_surface_elo: float,
    params: Dict[str, Any],
    q_state: QuantumState,
) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorized Tennis generator applying governed p(π) across sets."""
    # Quantum-governed probability directly guides set transitions
    logistic_p = q_state.governed_p
    best_of = int(params.get("best_of_sets", 3))

    if best_of == 3:
        s1 = rng.uniform(0, 1, size=SIMULATION_ITERATIONS) < logistic_p
        s2 = rng.uniform(0, 1, size=SIMULATION_ITERATIONS) < logistic_p
        s3 = rng.uniform(0, 1, size=SIMULATION_ITERATIONS) < logistic_p

        home_sets = np.zeros(SIMULATION_ITERATIONS)
        away_sets = np.zeros(SIMULATION_ITERATIONS)

        home_sets += np.where(s1, 1, 0)
        away_sets += np.where(~s1, 1, 0)

        home_sets += np.where(s2, 1, 0)
        away_sets += np.where(~s2, 1, 0)

        decider = (home_sets == 1) & (away_sets == 1)
        home_sets[decider] += np.where(s3[decider], 1, 0)
        away_sets[decider] += np.where(~s3[decider], 1, 0)
    else:
        probs = rng.uniform(0, 1, size=(SIMULATION_ITERATIONS, 5)) < logistic_p
        home_sets = np.sum(probs[:, :3], axis=1).astype(float)
        away_sets = (3.0 - home_sets).astype(float)

    return home_sets, away_sets


def _simulate_generic_vectorized(
    rng: np.random.Generator,
    home_rating: float,
    away_rating: float,
    params: Dict[str, Any],
    q_state: QuantumState,
) -> Tuple[np.ndarray, np.ndarray]:
    std = 10.0 * q_state.volatility_expansion
    shift = q_state.quantum_q * 3.0
    home = rng.normal(home_rating + shift, std, size=SIMULATION_ITERATIONS)
    away = rng.normal(away_rating - shift, std, size=SIMULATION_ITERATIONS)
    return np.round(home), np.round(away)


def _convert_moneyline_to_implied_prob(moneyline: float | int) -> float:
    ml = float(moneyline)
    if ml < 0:
        return abs(ml) / (abs(ml) + 100.0)
    else:
        return 100.0 / (ml + 100.0)


def _convert_moneyline_to_decimal(moneyline: float | int) -> float:
    ml = float(moneyline)
    if ml < 0:
        return 1.0 + (100.0 / abs(ml))
    else:
        return 1.0 + (ml / 100.0)
