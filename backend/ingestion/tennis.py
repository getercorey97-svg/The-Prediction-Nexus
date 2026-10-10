"""
The Prediction Nexus: Tennis Data Ingestion Module
===================================================
Tracks live ATP/WTA match cards, surface-specific Elo ratings,
and scans critical break point / tiebreak inflection moments for The Geter Principle.
Integrates with the 3-Tier Multi-Scraper pipeline (Tier 1 ESPN hidden API + Tier 2 Surface Elo).
"""

from __future__ import annotations

import math
import logging
from typing import List, Dict, Any, Tuple

from .tier2_metrics import TENNIS_SURFACE_ELO_REGISTRY

logger = logging.getLogger("nexus.ingestion.tennis")


def ingest_tennis_slate() -> List[Dict[str, Any]]:
    """
    Ingests live ATP/WTA match cards, surface metadata, and enriched Elo ratings
    via the 3-Tier Multi-Scraper pipeline. Zero static mock fallback.
    """
    from .tier_orchestrator import get_live_events
    return get_live_events("tennis")


def get_player_surface_elo(player_name: str, surface: str = "Hard") -> float:
    """Returns player surface-specific Elo rating."""
    surface_norm = surface.capitalize() if surface else "Hard"
    player_data = TENNIS_SURFACE_ELO_REGISTRY.get(player_name)
    if player_data:
        return float(player_data.get(surface_norm, 1800.0))
    return 1500.0


def scan_tennis_inflection_state(
    is_break_point: bool,
    is_tiebreak: bool,
    set_score_diff: int,
    deuce_count: int,
) -> Tuple[float, float, str]:
    """
    Scans break point pressure, deciding set tiebreaks, and deuce marathons.
    Returns (leverage_index, phase_theta, trigger_description).
    """
    if is_tiebreak and set_score_diff == 0:
        return 0.95, 0.45 * math.pi, "Deciding set tiebreak: maximum emotional superposition."
    elif is_break_point or deuce_count >= 3:
        leverage = 0.80
        theta = -0.25 * math.pi if is_break_point else 0.15 * math.pi
        return leverage, theta, f"Break point pressure state (Deuces: {deuce_count})."
    return 0.15, 0.0, "Peace State: baseline service hold rhythm."
