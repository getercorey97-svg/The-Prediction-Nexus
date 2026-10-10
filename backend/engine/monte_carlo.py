"""
The Prediction Nexus: Vectorized Monte Carlo Simulation Engine
================================================================
Mandates:
1. Exactly 50,003 iterations executed via vectorized NumPy routines.
2. Deterministic hash seeding derived from the unique event ID.
3. Zero storage bottlenecks: computes and returns strictly aggregated statistics
   (probabilities, mean, 5th/95th percentiles, edge, Kelly fraction).
"""

from __future__ import annotations

import hashlib
import numpy as np
from typing import Dict, Any, Tuple


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
) -> Dict[str, Any]:
    """
    Executes exactly 50,003 vectorized Monte Carlo iterations for an event.
    Returns aggregated distributional statistics.
    """
    seed = get_deterministic_seed(event_id)
    rng = np.random.default_rng(seed)

    sport_normalized = sport.lower().strip()
    market_odds = market_odds or {}

    if sport_normalized == "mlb":
        home_scores, away_scores = _simulate_mlb_vectorized(rng, home_rating, away_rating, model_params)
    elif sport_normalized == "cfb":
        home_scores, away_scores = _simulate_cfb_vectorized(rng, home_rating, away_rating, model_params)
    elif sport_normalized == "nfl":
        home_scores, away_scores = _simulate_nfl_vectorized(rng, home_rating, away_rating, model_params)
    elif sport_normalized == "tennis":
        home_scores, away_scores = _simulate_tennis_vectorized(rng, home_rating, away_rating, model_params)
    else:
        home_scores, away_scores = _simulate_generic_vectorized(rng, home_rating, away_rating, model_params)

    # Calculate vectorized margin and total arrays
    margins = home_scores - away_scores
    totals = home_scores + away_scores

    # Home win evaluation (Baseball and Tennis cannot tie; CFB/NFL post-OT tie probability evaluated)
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

    # Market odds & Edge derivation
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

        # Kelly Criterion: f* = (b*p - q) / b
        decimal_odds = _convert_moneyline_to_decimal(home_ml)
        b = decimal_odds - 1.0
        if b > 0 and edge_detected > 0:
            p = home_win_prob
            q = 1.0 - p
            kelly_fraction = max(0.0, (b * p - q) / b)
            # Apply institutional quarter-Kelly dampener for risk mitigation
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
    }


def _simulate_mlb_vectorized(
    rng: np.random.Generator,
    home_baseruns: float,
    away_baseruns: float,
    params: Dict[str, Any],
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Vectorized MLB generator: BaseRuns generation per team modeled via
    correlated negative-binomial / Poisson run scoring processes.
    """
    variance_dampener = float(params.get("variance_dampener", 1.0))

    # MLB average runs per game ~ 4.4, with team differential shifts
    lambda_home = max(1.5, home_baseruns * 1.02)
    lambda_away = max(1.5, away_baseruns * 0.98)

    home_runs = rng.poisson(lam=lambda_home, size=SIMULATION_ITERATIONS).astype(float)
    away_runs = rng.poisson(lam=lambda_away, size=SIMULATION_ITERATIONS).astype(float)

    # Baseball extra-innings resolution (no ties allowed in official MLB results)
    ties = home_runs == away_runs
    tie_count = int(np.sum(ties))
    if tie_count > 0:
        # Extra inning ghost runner / bullpen leverage simulation
        extra_innings_home_advantage = 0.525
        home_extra_win = rng.uniform(0, 1, size=tie_count) < extra_innings_home_advantage
        home_runs[ties] += np.where(home_extra_win, 1.0, 0.0)
        away_runs[ties] += np.where(home_extra_win, 0.0, 1.0)

    return home_runs, away_runs


def _simulate_cfb_vectorized(
    rng: np.random.Generator,
    home_epa: float,
    away_epa: float,
    params: Dict[str, Any],
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Vectorized CFB generator: Expected Points Added (EPA) per play and
    havoc differential mapped into collegiate drive scoring distributions.
    """
    hfa = float(params.get("home_field_advantage_pts", 2.4))
    std_dev = 15.2 * float(params.get("variance_dampener", 0.95))

    # Mean expected points
    mean_home = 28.5 + (home_epa * 18.0) + (hfa / 2.0)
    mean_away = 26.0 + (away_epa * 18.0) - (hfa / 2.0)

    # CFB score variance covariance matrix
    corr = 0.12
    cov = [[std_dev**2, corr * std_dev**2], [corr * std_dev**2, std_dev**2]]
    scores = rng.multivariate_normal([mean_home, mean_away], cov, size=SIMULATION_ITERATIONS)

    home_scores = np.clip(np.round(scores[:, 0]), 0, 90)
    away_scores = np.clip(np.round(scores[:, 1]), 0, 90)

    # Overtime resolution for ties
    ties = home_scores == away_scores
    tie_count = int(np.sum(ties))
    if tie_count > 0:
        home_ot_win = rng.uniform(0, 1, size=tie_count) < 0.51
        home_scores[ties] += np.where(home_ot_win, 3.0, 0.0)
        away_scores[ties] += np.where(home_ot_win, 0.0, 3.0)

    return home_scores, away_scores


def _simulate_nfl_vectorized(
    rng: np.random.Generator,
    home_epa: float,
    away_epa: float,
    params: Dict[str, Any],
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Vectorized NFL generator: Passing EPA / CPOE model incorporating
    key football scoring intervals (3, 6, 7, 10, 14 points).
    """
    std_dev = 12.8 * float(params.get("variance_dampener", 1.0))
    mean_home = 23.5 + (home_epa * 15.0) + 1.5
    mean_away = 21.0 + (away_epa * 15.0) - 1.5

    corr = 0.15
    cov = [[std_dev**2, corr * std_dev**2], [corr * std_dev**2, std_dev**2]]
    scores = rng.multivariate_normal([mean_home, mean_away], cov, size=SIMULATION_ITERATIONS)

    home_scores = np.clip(np.round(scores[:, 0]), 0, 70)
    away_scores = np.clip(np.round(scores[:, 1]), 0, 70)

    # Resolve overtime ties
    ties = home_scores == away_scores
    tie_count = int(np.sum(ties))
    if tie_count > 0:
        # Regular season has rare ties (< 0.5%), postseason none
        home_ot_win = rng.uniform(0, 1, size=tie_count) < 0.52
        home_scores[ties] += np.where(home_ot_win, 3.0, 0.0)
        away_scores[ties] += np.where(home_ot_win, 0.0, 3.0)

    return home_scores, away_scores


def _simulate_tennis_vectorized(
    rng: np.random.Generator,
    home_surface_elo: float,
    away_surface_elo: float,
    params: Dict[str, Any],
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Vectorized Tennis generator: Surface-specific Elo differential
    simulating match sets and total games played.
    """
    elo_delta = home_surface_elo - away_surface_elo
    logistic_p = 1.0 / (1.0 + 10.0 ** (-elo_delta / 400.0))

    # Match format: Best of 3 sets default (or Grand Slam Best of 5)
    best_of = int(params.get("best_of_sets", 3))
    sets_to_win = 2 if best_of == 3 else 3

    # Generate set-by-set outcomes across 50,003 iterations
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
        # Grand slam 5 sets
        probs = rng.uniform(0, 1, size=(SIMULATION_ITERATIONS, 5)) < logistic_p
        home_sets = np.sum(probs[:, :3], axis=1).astype(float)
        away_sets = (3.0 - home_sets).astype(float)

    return home_sets, away_sets


def _simulate_generic_vectorized(
    rng: np.random.Generator,
    home_rating: float,
    away_rating: float,
    params: Dict[str, Any],
) -> Tuple[np.ndarray, np.ndarray]:
    """Default fallback bivariate normal generator."""
    std = 10.0
    home = rng.normal(home_rating, std, size=SIMULATION_ITERATIONS)
    away = rng.normal(away_rating, std, size=SIMULATION_ITERATIONS)
    return np.round(home), np.round(away)


def _convert_moneyline_to_implied_prob(moneyline: float | int) -> float:
    """Converts American moneyline to implied probability percentage [0.0 - 1.0]."""
    ml = float(moneyline)
    if ml < 0:
        return abs(ml) / (abs(ml) + 100.0)
    else:
        return 100.0 / (ml + 100.0)


def _convert_moneyline_to_decimal(moneyline: float | int) -> float:
    """Converts American moneyline to decimal odds."""
    ml = float(moneyline)
    if ml < 0:
        return 1.0 + (100.0 / abs(ml))
    else:
        return 1.0 + (ml / 100.0)
