"""
The Prediction Nexus: College Football Engine (EPA / Havoc)
===========================================================
Models Expected Points Added (EPA) per play, Havoc Rate differentials,
and collegiate home field advantage (2.4 points).
"""

from __future__ import annotations

from typing import Dict, Any


def evaluate_cfb_matchup(
    home_team: str,
    away_team: str,
    home_offense_epa: float,
    away_offense_epa: float,
    home_defense_epa: float,  # lower/negative is better
    away_defense_epa: float,
    home_havoc_rate: float = 0.18,  # % of defensive plays with TFL/PD/FF
    away_havoc_rate: float = 0.16,
    home_field_advantage: float = 2.40,
) -> Dict[str, Any]:
    """
    Decomposes College Football matchup into expected points and Havoc spread.
    """
    # Net EPA per team (Offensive output minus opponent defense quality)
    home_net_epa = home_offense_epa - away_defense_epa
    away_net_epa = away_offense_epa - home_defense_epa

    # Havoc differential (Havoc generated vs opponent disruption susceptibility)
    havoc_differential = home_havoc_rate - away_havoc_rate

    # CFB baseline score per team ~ 27.5 points
    home_projected_pts = 27.5 + (home_net_epa * 22.0) + (home_field_advantage / 2.0) + (havoc_differential * 15.0)
    away_projected_pts = 27.5 + (away_net_epa * 22.0) - (home_field_advantage / 2.0) - (havoc_differential * 15.0)

    home_projected_pts = max(3.0, home_projected_pts)
    away_projected_pts = max(3.0, away_projected_pts)

    spread = home_projected_pts - away_projected_pts
    total = home_projected_pts + away_projected_pts

    return {
        "home_team": home_team,
        "away_team": away_team,
        "home_projected_points": round(home_projected_pts, 1),
        "away_projected_points": round(away_projected_pts, 1),
        "predicted_spread": round(spread, 1),
        "predicted_total": round(total, 1),
        "factor_decomposition": {
            "home_offense_epa": home_offense_epa,
            "away_offense_epa": away_offense_epa,
            "home_defense_epa": home_defense_epa,
            "away_defense_epa": away_defense_epa,
            "home_havoc_rate": home_havoc_rate,
            "away_havoc_rate": away_havoc_rate,
            "havoc_differential": round(havoc_differential, 4),
            "home_field_advantage_points": home_field_advantage,
        },
    }
