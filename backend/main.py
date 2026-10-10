"""
The Prediction Nexus: FastAPI Gateway & REST Controller
=========================================================
Production-grade ASGI service configured for Render Web Service.
Provides lightweight keep-alive endpoints, Celery task dispatchers,
and simulation routes.
"""

from __future__ import annotations

import os
import logging
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from celery_app import celery_app
from tasks import simulate_event_mc, sync_sport_slate
from engine.monte_carlo import run_monte_carlo_simulation
from ingestion.mlb import ingest_mlb_slate, get_mlb_team_baseruns
from ingestion.cfb import ingest_cfb_slate, get_cfb_team_epa
from ingestion.nfl import ingest_nfl_slate, get_nfl_team_epa
from ingestion.tennis import ingest_tennis_slate, get_player_surface_elo
from ingestion.odds import fetch_market_odds_for_event

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nexus.api")

app = FastAPI(
    title="The Prediction Nexus API",
    version="1.0.0",
    description="Autonomous Quantitative Sports Prediction Gateway (MLB, CFB, NFL, Tennis)",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request schemas
class SimulationRequest(BaseModel):
    event_id: str
    sport: str
    home_participant: str
    away_participant: str
    surface: str | None = None
    model_params: Dict[str, Any] = Field(default_factory=dict)
    market_odds: Dict[str, Any] | None = None
    use_celery_worker: bool = True


# ==============================================================================
# KEEP-ALIVE & HEALTH ROUTES (Optimized for Render Web Service & Worker Pings)
# ==============================================================================
@app.get("/health")
@app.get("/healthz")
def health_check() -> Dict[str, Any]:
    """Lightweight keep-alive prober preventing idle spin-downs."""
    return {
        "status": "healthy",
        "service": "The Prediction Nexus Gateway",
        "vectorized_iterations_mandate": 50003,
        "sports_supported": ["mlb", "cfb", "nfl", "tennis"],
    }


# ==============================================================================
# SIMULATION ROUTES (50,003 Monte Carlo Runs)
# ==============================================================================
@app.post("/api/simulate")
def dispatch_simulation(req: SimulationRequest) -> Dict[str, Any]:
    """
    Dispatches a 50,003 Monte Carlo simulation run.
    Offloads to Celery task queue when Celery is enabled, or executes
    directly via vectorized NumPy in under 15ms.
    """
    sport_norm = req.sport.lower().strip()
    if sport_norm not in ["mlb", "cfb", "nfl", "tennis"]:
        raise HTTPException(status_code=400, detail=f"Unsupported sport: {req.sport}")

    # Determine ratings
    if sport_norm == "mlb":
        home_rating = get_mlb_team_baseruns(req.home_participant)
        away_rating = get_mlb_team_baseruns(req.away_participant)
    elif sport_norm == "cfb":
        home_rating = get_cfb_team_epa(req.home_participant)
        away_rating = get_cfb_team_epa(req.away_participant)
    elif sport_norm == "nfl":
        home_rating = get_nfl_team_epa(req.home_participant)
        away_rating = get_nfl_team_epa(req.away_participant)
    elif sport_norm == "tennis":
        surf = req.surface or "Clay"
        home_rating = get_player_surface_elo(req.home_participant, surf)
        away_rating = get_player_surface_elo(req.away_participant, surf)
    else:
        home_rating = 10.0
        away_rating = 10.0

    odds = req.market_odds or fetch_market_odds_for_event(req.event_id, req.sport)

    # Option A: Dispatch to Celery background task
    if req.use_celery_worker:
        try:
            task = simulate_event_mc.delay(
                event_id=req.event_id,
                sport=req.sport,
                home_participant=req.home_participant,
                away_participant=req.away_participant,
                surface=req.surface,
                model_params=req.model_params,
                market_odds=odds,
            )
            return {
                "status": "QUEUED",
                "task_id": task.id,
                "event_id": req.event_id,
                "message": "Dispatched 50,003 Monte Carlo calculation to Celery queue",
            }
        except Exception as exc:
            logger.warning(f"Celery dispatch failed ({exc}); falling back to inline vectorized NumPy execution.")

    # Option B: Direct Vectorized NumPy Execution (< 15ms)
    result = run_monte_carlo_simulation(
        event_id=req.event_id,
        sport=req.sport,
        home_rating=home_rating,
        away_rating=away_rating,
        model_params=req.model_params,
        market_odds=odds,
    )
    result["status"] = "COMPLETED"
    result["home_participant"] = req.home_participant
    result["away_participant"] = req.away_participant
    return result


@app.get("/api/tasks/{task_id}")
def get_task_status(task_id: str) -> Dict[str, Any]:
    """Polls status and result of asynchronous Celery task."""
    try:
        task_result = celery_app.AsyncResult(task_id)
        response: Dict[str, Any] = {
            "task_id": task_id,
            "status": task_result.status,
        }
        if task_result.status == "SUCCESS":
            response["result"] = task_result.result
        elif task_result.status == "FAILURE":
            response["error"] = str(task_result.result)
        return response
    except Exception as exc:
        return {"task_id": task_id, "status": "UNKNOWN", "detail": str(exc)}


# ==============================================================================
# INGESTION & SCHEDULE ROUTES
# ==============================================================================
@app.get("/api/events")
def list_all_events() -> List[Dict[str, Any]]:
    """Returns combined sporting events slate across all 4 sports."""
    mlb_events = ingest_mlb_slate()
    cfb_events = ingest_cfb_slate()
    nfl_events = ingest_nfl_slate()
    tennis_events = ingest_tennis_slate()
    return mlb_events + cfb_events + nfl_events + tennis_events


@app.post("/api/ingest/{sport}")
def trigger_sport_ingest(sport: str) -> Dict[str, Any]:
    """Triggers background slate ingestion for a sport."""
    sport_norm = sport.lower().strip()
    if sport_norm not in ["mlb", "cfb", "nfl", "tennis"]:
        raise HTTPException(status_code=400, detail=f"Unknown sport: {sport}")

    try:
        task = sync_sport_slate.delay(sport_norm)
        return {"status": "QUEUED", "task_id": task.id, "sport": sport_norm}
    except Exception as exc:
        logger.warning(f"Celery queue unavailable ({exc}); executing synchronously.")
        if sport_norm == "mlb":
            data = ingest_mlb_slate()
        elif sport_norm == "cfb":
            data = ingest_cfb_slate()
        elif sport_norm == "nfl":
            data = ingest_nfl_slate()
        else:
            data = ingest_tennis_slate()
        return {"status": "COMPLETED", "sport": sport_norm, "events_count": len(data), "events": data}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
