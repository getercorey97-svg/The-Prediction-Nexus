"""
The Prediction Nexus: NFL Quantitative Engine (EPA / CPOE)
===========================================================
Models dropback Passing EPA, Rushing EPA, and quarterback
Completion Percentage Over Expected (CPOE).
"""

from __future__ import annotations

from typing import Dict, Any


def evaluate_nfl_matchup(
    home_team: str,
    away_team: str,
    home_pass_epa: float,
    away_pass_epa: float,
    home_rush_epa: float,
    away_rush_epa: float,
    home_qb_cpoe: float,  # e.g., +4.2% or -1.5%
    away_qb_cpoe: float,
    home_field_advantage: float = 1.50,
) -> Dict[str, Any]:
    """
    Decomposes NFL matchup into expected team points and factor shares.
    """
    # NFL efficiency weighting: Pass EPA ~ 70%, Rush EPA ~ 30%
    home_composite_epa = (home_pass_epa * 0.70) + (home_rush_epa * 0.30) + (home_qb_cpoe * 0.05)
    away_composite_epa = (away_pass_epa * 0.70) + (away_rush_epa * 0.30) + (away_qb_cpoe * 0.05)

    # NFL baseline score per team ~ 22.0 points
    home_points = 22.0 + (home_composite_epa * 18.0) + (home_field_advantage / 2.0)
    away_points = 22.0 + (away_composite_epa * 18.0) - (home_field_advantage / 2.0)

    home_points = max(3.0, home_points)
    away_points = max(3.0, away_points)

    spread = home_points - away_points
    total = home_points + away_points

    return {
        "home_team": home_team,
        "away_team": away_team,
        "home_projected_points": round(home_points, 1),
        "away_projected_points": round(away_points, 1),
        "predicted_spread": round(spread, 1),
        "predicted_total": round(total, 1),
        "factor_decomposition": {
            "home_pass_epa": home_pass_epa,
            "away_pass_epa": away_pass_epa,
            "home_rush_epa": home_rush_epa,
            "away_rush_epa": away_rush_epa,
            "home_qb_cpoe_percent": home_qb_cpoe,
            "away_qb_cpoe_percent": away_qb_cpoe,
            "home_field_advantage_points": home_field_advantage,
        },
    }
