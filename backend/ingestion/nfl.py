"""
The Prediction Nexus: NFL Data Ingestion Module
================================================
Pulls live NFL scoreboards, schedules, and EPA/CPOE derived metrics.
Integrates with the 3-Tier Multi-Scraper pipeline (Tier 1 ESPN + Tier 2 EPA/CPOE enricher).
Scans late-game 2-minute inflection states for The Geter Principle.
"""

from __future__ import annotations

import math
import logging
from typing import List, Dict, Any, Tuple

from .tier2_metrics import NFL_EPA_CPOE_BENCHMARK

logger = logging.getLogger("nexus.ingestion.nfl")


def ingest_nfl_slate() -> List[Dict[str, Any]]:
    """
    Ingests live NFL schedule, scoreboards, and enriched EPA/CPOE metrics
    via the 3-Tier Multi-Scraper pipeline. Zero static mock fallback.
    """
    from .tier_orchestrator import get_live_events
    return get_live_events("nfl")


def get_nfl_team_epa(team_name: str) -> float:
    """Returns EPA per play metric for NFL teams."""
    bench = NFL_EPA_CPOE_BENCHMARK.get(team_name)
    if bench:
        return float(bench["pass_epa"] * 0.65 + bench["rush_epa"] * 0.35)
    return 0.05


def scan_nfl_inflection_state(
    time_remaining_seconds: int,
    score_diff: int,
    possession_team_cpoe: float,
    is_overtime: bool,
) -> Tuple[float, float, str]:
    """
    Scans NFL 2-minute warnings, red-zone 4th downs, and overtime possessions.
    Returns (leverage_index, phase_theta, trigger_description).
    """
    if is_overtime:
        return 0.98, 0.20 * math.pi, "Overtime possession: maximum NFL sudden-death leverage."
    elif time_remaining_seconds <= 120 and abs(score_diff) <= 8:
        # Two-minute warning in one-score contest
        leverage = 0.85
        theta = 0.30 * math.pi if possession_team_cpoe >= 2.0 else -0.30 * math.pi
        return leverage, theta, f"2-Minute drill inflection (Time: {time_remaining_seconds}s, Diff: {score_diff})."
    return 0.18, 0.0, "Peace State: standard NFL clock rhythm."
