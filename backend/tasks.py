"""
The Prediction Nexus: Asynchronous Celery Tasks
===============================================
Offloads 50,003 Monte Carlo vectorized calculations and external API
ingestion to background workers, preventing ASGI/serverless timeout crashes.
"""

from __future__ import annotations

import logging
from typing import Dict, Any
from celery_app import celery_app
from engine.monte_carlo import run_monte_carlo_simulation
from ingestion.mlb import ingest_mlb_slate, get_mlb_team_baseruns
from ingestion.cfb import ingest_cfb_slate, get_cfb_team_epa
from ingestion.nfl import ingest_nfl_slate, get_nfl_team_epa
from ingestion.tennis import ingest_tennis_slate, get_player_surface_elo
from ingestion.odds import fetch_market_odds_for_event

logger = logging.getLogger("nexus.tasks")


@celery_app.task(bind=True, name="tasks.simulate_event_mc")
def simulate_event_mc(
    self,
    event_id: str,
    sport: str,
    home_participant: str,
    away_participant: str,
    surface: str | None = None,
    model_params: Dict[str, Any] | None = None,
    market_odds: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Executes exactly 50,003 vectorized iterations in the background.
    Returns strictly aggregated distribution statistics.
    """
    logger.info(f"[Task {self.request.id}] Starting 50,003 Monte Carlo run for event: {event_id} ({sport})")
    model_params = model_params or {}

    # Extract sport ratings
    sport_norm = sport.lower().strip()
    if sport_norm == "mlb":
        home_rating = get_mlb_team_baseruns(home_participant)
        away_rating = get_mlb_team_baseruns(away_participant)
    elif sport_norm == "cfb":
        home_rating = get_cfb_team_epa(home_participant)
        away_rating = get_cfb_team_epa(away_participant)
    elif sport_norm == "nfl":
        home_rating = get_nfl_team_epa(home_participant)
        away_rating = get_nfl_team_epa(away_participant)
    elif sport_norm == "tennis":
        surf = surface or "Clay"
        home_rating = get_player_surface_elo(home_participant, surf)
        away_rating = get_player_surface_elo(away_participant, surf)
    else:
        home_rating = 10.0
        away_rating = 10.0

    # Fallback to market odds fetch if not provided
    if not market_odds:
        market_odds = fetch_market_odds_for_event(event_id, sport)

    result = run_monte_carlo_simulation(
        event_id=event_id,
        sport=sport,
        home_rating=home_rating,
        away_rating=away_rating,
        model_params=model_params,
        market_odds=market_odds,
    )

    result["task_id"] = self.request.id
    result["home_participant"] = home_participant
    result["away_participant"] = away_participant
    logger.info(f"[Task {self.request.id}] Simulation finished. Home win prob: {result['home_win_probability']}")
    return result


@celery_app.task(bind=True, name="tasks.sync_sport_slate")
def sync_sport_slate(self, sport: str) -> Dict[str, Any]:
    """
    Syncs game schedule and current empirical scores for the specified sport.
    """
    sport_norm = sport.lower().strip()
    logger.info(f"[Task {self.request.id}] Synchronizing {sport_norm} slate...")

    if sport_norm == "mlb":
        data = ingest_mlb_slate()
    elif sport_norm == "cfb":
        data = ingest_cfb_slate()
    elif sport_norm == "nfl":
        data = ingest_nfl_slate()
    elif sport_norm == "tennis":
        data = ingest_tennis_slate()
    else:
        data = []

    return {
        "task_id": self.request.id,
        "sport": sport_norm,
        "events_count": len(data),
        "events": data,
    }
