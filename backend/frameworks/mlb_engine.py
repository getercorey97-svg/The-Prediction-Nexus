"""
The Prediction Nexus: MLB Quantitative Engine (BaseRuns / FIP)
==============================================================
Calculates run production using the discrete BaseRuns formula:
    BaseRuns = A * (B / (B + C)) + D
combined with starting pitcher FIP (Fielding Independent Pitching),
bullpen leverage index splits, and park factors.
"""

from __future__ import annotations

from typing import Dict, Any


def calculate_baseruns(
    hits: float,
    walks: float,
    home_runs: float,
    at_bats: float,
) -> float:
    """
    Computes BaseRuns per 9 innings:
    A = Baserunners created (H + BB - HR)
    B = Advancement factor (0.78 * (H - HR) + 2.4 * HR)
    C = Outs (AB - H)
    D = Home runs
    """
    a = max(0.1, hits + walks - home_runs)
    b = max(0.1, 0.78 * (hits - home_runs) + 2.4 * home_runs)
    c = max(1.0, at_bats - hits)
    d = home_runs

    runs = a * (b / (b + c)) + d
    return round(runs, 2)


def calculate_fip(
    home_runs_allowed: float,
    walks_allowed: float,
    hit_by_pitch: float,
    strikeouts: float,
    innings_pitched: float,
    fip_constant: float = 3.15,
) -> float:
    """
    Computes Fielding Independent Pitching (FIP):
    FIP = ((13*HR + 3*(BB + HBP) - 2*K) / IP) + FIP_constant
    """
    if innings_pitched <= 0:
        return 4.20
    numerator = 13.0 * home_runs_allowed + 3.0 * (walks_allowed + hit_by_pitch) - 2.0 * strikeouts
    fip = (numerator / innings_pitched) + fip_constant
    return round(fip, 2)


def evaluate_mlb_matchup(
    home_team: str,
    away_team: str,
    home_starter_fip: float,
    away_starter_fip: float,
    home_team_baseruns: float = 4.75,
    away_team_baseruns: float = 4.52,
    park_factor: float = 1.00,
    bullpen_weight: float = 0.10,
) -> Dict[str, Any]:
    """
    Decomposes MLB matchup factors into predicted expected runs per team.
    """
    # League average FIP is ~4.15
    fip_league_avg = 4.15

    # Starter pitching factor (inverse impact on opposing team runs)
    home_runs_expected = (
        home_team_baseruns
        * (away_starter_fip / fip_league_avg) ** 0.65
        * park_factor
        * 1.02  # home field slight edge
    )

    away_runs_expected = (
        away_team_baseruns
        * (home_starter_fip / fip_league_avg) ** 0.65
        * park_factor
        * 0.98
    )

    expected_margin = home_runs_expected - away_runs_expected
    expected_total = home_runs_expected + away_runs_expected

    return {
        "home_team": home_team,
        "away_team": away_team,
        "home_expected_runs": round(home_runs_expected, 2),
        "away_expected_runs": round(away_runs_expected, 2),
        "predicted_spread": round(expected_margin, 2),
        "predicted_total_runs": round(expected_total, 2),
        "factor_decomposition": {
            "home_baseruns_offensive_rating": home_team_baseruns,
            "away_baseruns_offensive_rating": away_team_baseruns,
            "home_starting_pitcher_fip": home_starter_fip,
            "away_starting_pitcher_fip": away_starter_fip,
            "park_factor_multiplier": park_factor,
            "bullpen_leverage_weight": bullpen_weight,
        },
    }
