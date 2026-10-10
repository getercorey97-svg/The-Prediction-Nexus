"""
The Prediction Nexus: MLB Data Ingestion Module
================================================
Pulls live MLB scoreboards, schedules, and Statcast BaseRuns metrics.
Integrates with the 3-Tier Multi-Scraper pipeline (Tier 1 ESPN + Tier 2 MLB StatsAPI).
Scans high-leverage inflection events for The Geter Principle.
"""

from __future__ import annotations

import math
import logging
from typing import List, Dict, Any, Tuple

from .tier2_metrics import MLB_TEAM_BASERUNS_BENCHMARK

logger = logging.getLogger("nexus.ingestion.mlb")


def ingest_mlb_slate() -> List[Dict[str, Any]]:
    """
    Ingests live MLB schedule, scoreboards, and enriched metrics
    via the 3-Tier Multi-Scraper pipeline. Zero static mock fallback.
    """
    from .tier_orchestrator import get_live_events
    return get_live_events("mlb")


def get_mlb_team_baseruns(team_name: str) -> float:
    """Retrieves the BaseRuns offensive generation metric for a team."""
    return MLB_TEAM_BASERUNS_BENCHMARK.get(team_name, 4.40)


def scan_mlb_inflection_state(inning: int, margin: int, runners_on: int, outs: int) -> Tuple[float, float, str]:
    """
    Scans in-game MLB state to detect high-leverage inflection events.
    Returns (leverage_index, phase_theta, trigger_description).
    """
    if inning >= 7 and abs(margin) <= 2 and runners_on >= 2:
        # Chaos State: Late-inning bases loaded or runners in scoring position
        leverage = min(1.0, 0.70 + (runners_on * 0.10))
        theta = 0.25 * math.pi if margin <= 0 else -0.20 * math.pi
        return leverage, theta, f"Late inning leverage (Inning {inning}, Margin {margin}, {runners_on} on base)."
    elif inning >= 8 and abs(margin) <= 1:
        return 0.75, -0.15 * math.pi, "High-leverage 9th inning save situation."
    return 0.20, 0.0, "Peace State: standard game flow."
