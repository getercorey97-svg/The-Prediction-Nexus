"""
The Prediction Nexus: College Football Ingestion Module
========================================================
Pulls live CFB scoreboards, schedules, and EPA/Havoc differentials.
Integrates with the 3-Tier Multi-Scraper pipeline (Tier 1 ESPN hidden API + Tier 2 EPA enricher).
Scans collegiate turnover / Havoc spikes for The Geter Principle.
"""

from __future__ import annotations

import os
import math
import logging
from typing import List, Dict, Any, Tuple

from .tier2_metrics import CFB_EPA_HAVOC_BENCHMARK

logger = logging.getLogger("nexus.ingestion.cfb")


def ingest_cfb_slate() -> List[Dict[str, Any]]:
    """
    Ingests live CFB schedule, scoreboards, and enriched EPA metrics
    via the 3-Tier Multi-Scraper pipeline. Zero static mock fallback.
    """
    from .tier_orchestrator import get_live_events
    return get_live_events("cfb")


def get_cfb_team_epa(team_name: str) -> float:
    """Returns Expected Points Added per play differential for CFB programs."""
    bench = CFB_EPA_HAVOC_BENCHMARK.get(team_name)
    if bench:
        return float(bench["offense_epa"] - abs(bench["defense_epa"]))
    return 0.10


def scan_cfb_inflection_state(
    havoc_rate: float,
    turnover_differential: int,
    fourth_down_attempt: bool,
    score_diff: int,
) -> Tuple[float, float, str]:
    """
    Scans collegiate Havoc spikes and 4th down go-for-it leverage.
    Returns (leverage_index, phase_theta, trigger_description).
    """
    if fourth_down_attempt and abs(score_diff) <= 8:
        return 0.86, 0.35 * math.pi, f"High-leverage 4th down attempt in 1-possession game (Diff: {score_diff})."
    elif havoc_rate >= 0.22 or abs(turnover_differential) >= 2:
        leverage = min(1.0, 0.65 + abs(turnover_differential) * 0.10)
        theta = -0.30 * math.pi if turnover_differential < 0 else 0.30 * math.pi
        return leverage, theta, f"Collegiate Havoc spike (Rate: {havoc_rate:.2f}, Turnovers: {turnover_differential})."
    return 0.22, 0.0, "Peace State: standard collegiate drive pacing."
