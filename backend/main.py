"""
The Prediction Nexus: FastAPI Gateway & REST Controller
=========================================================
Production-grade ASGI service configured for Render Web Service.
Features:
- FastAPI lifespan startup trigger: Automatically runs the autonomous
  3-Tier Multi-Scraper pipeline on server boot / wake-up.
- Live sporting events endpoint: GET /api/events (zero static mock arrays).
- Asynchronous Celery dispatchers and 15ms vectorized Monte Carlo execution.
- Direct Supabase PostgreSQL upserts.
"""

from __future__ import annotations

import os
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from celery_app import celery_app
from tasks import simulate_event_mc, sync_sport_slate
from engine.monte_carlo import run_monte_carlo_simulation
from ingestion.mlb import get_mlb_team_baseruns
from ingestion.cfb import get_cfb_team_epa
from ingestion.nfl import get_nfl_team_epa
from ingestion.tennis import get_player_surface_elo
from ingestion.odds import fetch_market_odds_for_event
from ingestion.tier_orchestrator import (
    run_unified_ingestion_pipeline,
    get_live_events,
    LIVE_EVENTS_IN_MEMORY_REGISTRY,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nexus.api")


# ==============================================================================
# FASTAPI LIFESPAN STARTUP TRIGGER (Autonomous Ingestion on Server Boot/Wakeup)
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan trigger: When Render web service boots or wakes from idle,
    initiates background ingestion across MLB, CFB, NFL, and Tennis
    without delaying HTTP server readiness.
    """
    logger.info("Initializing The Prediction Nexus API Lifespan...")

    async def _startup_ingestion_worker():
        try:
            logger.info("Lifespan Startup: Executing autonomous 3-Tier Multi-Scraper pipeline...")
            # Run in worker thread to prevent blocking event loop
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, run_unified_ingestion_pipeline)
            logger.info(f"Lifespan Startup: Pipeline complete. Hydrated {len(LIVE_EVENTS_IN_MEMORY_REGISTRY)} live events.")
        except Exception as exc:
            logger.error(f"Lifespan Startup Ingestion Error: {exc}", exc_info=True)

    # Launch background startup ingestion task
    asyncio.create_task(_startup_ingestion_worker())
    yield
    logger.info("Shutting down The Prediction Nexus API...")


app = FastAPI(
    title="The Prediction Nexus API",
    version="2.0.0",
    description="Autonomous Quantitative Sports Prediction Gateway with 3-Tier Live Multi-Scraper",
    lifespan=lifespan,
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
    surface: Optional[str] = None
    model_params: Dict[str, Any] = Field(default_factory=dict)
    market_odds: Optional[Dict[str, Any]] = None
    use_celery_worker: bool = False  # Default to instant vectorized execution (<15ms)


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
        "version": "2.0.0",
        "vectorized_iterations_mandate": 50003,
        "sports_supported": ["mlb", "cfb", "nfl", "tennis"],
        "cached_live_events": len(LIVE_EVENTS_IN_MEMORY_REGISTRY),
        "pipeline": "3-Tier Live Multi-Scraper (ESPN + Advanced Metrics + Open-Meteo Weather)",
    }


# ==============================================================================
# LIVE SPORTING EVENTS ROUTES (Zero Static Mocks)
# ==============================================================================
@app.get("/api/events")
def list_all_events(sport: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns live sporting events slate across MLB, CFB, NFL, and Tennis.
    Directly queries empirical multi-tier ingestion feeds (never static dummy arrays).
    """
    events = get_live_events(sport)
    return events


@app.post("/api/ingest/{sport}")
def trigger_sport_ingest(sport: str, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Triggers autonomous 3-Tier ingestion for a sport and upserts to Supabase."""
    sport_norm = sport.lower().strip()
    if sport_norm not in ["mlb", "cfb", "nfl", "tennis", "all"]:
        raise HTTPException(status_code=400, detail=f"Unknown sport: {sport}")

    target_sport = None if sport_norm == "all" else sport_norm

    try:
        # Offload to celery if available
        task = sync_sport_slate.delay(sport_norm)
        return {
            "status": "QUEUED",
            "task_id": task.id,
            "sport": sport_norm,
            "message": "Dispatched ingestion task to Celery worker",
        }
    except Exception as exc:
        logger.warning(f"Celery queue unavailable ({exc}); executing in background task worker.")
        # Execute in background task
        background_tasks.add_task(run_unified_ingestion_pipeline, target_sport)
        return {
            "status": "INITIATED",
            "sport": sport_norm,
            "message": "Pipeline initiated in background thread. Events will upsert to Supabase.",
        }


@app.post("/api/ingest/sync")
def trigger_sync_ingest(sport: Optional[str] = None) -> Dict[str, Any]:
    """Synchronously executes the 3-Tier ingestion pipeline and returns refreshed records."""
    sport_norm = sport.lower().strip() if sport else None
    events = run_unified_ingestion_pipeline(sport_norm)
    return {
        "status": "COMPLETED",
        "sport": sport_norm or "all",
        "events_count": len(events),
        "events": events,
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
        surf = req.surface or "Hard"
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
