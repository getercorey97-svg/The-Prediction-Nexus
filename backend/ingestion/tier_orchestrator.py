"""
The Prediction Nexus: Unified 3-Tier Multi-Scraper & Cross-Enrichment Orchestrator
==================================================================================
Coordinates the 3-Tier Ingestion Architecture across MLB, CFB, NFL, and Tennis:
- Tier 1: Primary Live Scrapers (ESPN Hidden API + SofaScore 24/7 Global Tennis)
- Tier 2: Advanced Metrics Enricher & Secondary Scraper (MLB StatsAPI / FIP / EPA / Havoc / Surface Elo)
- Tier 3: Environmental Enricher & Stadium Weather (Open-Meteo API / Domes / Fatigue)

Directly upserts normalized events into Supabase PostgreSQL using SUPABASE_SERVICE_ROLE_KEY
with non-destructive merge policy on external_id, preserving simulated predictions.
Prioritizes Tennis matches and eliminates all artificial query caps.
"""

from __future__ import annotations

import os
import json
import logging
import datetime
from typing import List, Dict, Any, Optional
import requests

from .tier1_espn import fetch_rolling_window_events
from .tier2_metrics import enrich_event_metrics, fetch_mlb_statsapi_failover
from .tier3_environment import enrich_event_environment
from .tennis_global import fetch_global_tennis_slate

logger = logging.getLogger("nexus.ingestion.orchestrator")

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "https://aywldwdvflwcanqxxdhi.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or ""

# In-Memory Live Events Cache (Guarantees zero static fallback and rapid GET /api/events response)
LIVE_EVENTS_IN_MEMORY_REGISTRY: Dict[str, Dict[str, Any]] = {}


def upsert_events_to_supabase(events: List[Dict[str, Any]]) -> int:
    """
    Directly upserts live ingested events into Supabase sporting_events table
    via the PostgREST API using non-destructive ON CONFLICT (external_id) merge.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.info("Supabase credentials not configured in environment; maintaining in-memory live registry.")
        return 0

    endpoint = f"{SUPABASE_URL.rstrip('/')}/rest/v1/sporting_events"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    records_to_upsert = []
    for ev in events:
        record = {
            "sport": ev["sport"],
            "external_id": ev["external_id"],
            "event_date": ev["event_date"],
            "home_participant": ev["home_participant"],
            "away_participant": ev["away_participant"],
            "surface": ev.get("surface"),
            "venue": ev.get("venue"),
            "status": ev["status"],
            "home_score": ev.get("home_score"),
            "away_score": ev.get("away_score"),
            "actual_winner": ev.get("actual_winner"),
            "official_metadata": ev.get("official_metadata", {}),
            "updated_at": datetime.datetime.utcnow().isoformat() + "Z",
        }
        records_to_upsert.append(record)

    try:
        resp = requests.post(
            endpoint,
            headers=headers,
            data=json.dumps(records_to_upsert),
            params={"on_conflict": "external_id"},
            timeout=10.0,
        )
        if resp.status_code in [200, 201]:
            logger.info(f"Supabase Realtime DB: Successfully upserted {len(records_to_upsert)} live events.")
            return len(records_to_upsert)
        else:
            logger.warning(f"Supabase upsert returned HTTP {resp.status_code}: {resp.text[:300]}")
    except Exception as exc:
        logger.warning(f"Supabase upsert connection error: {exc}")

    return 0


def ingest_sport_live(sport: str) -> List[Dict[str, Any]]:
    """
    Executes 3-Tier Multi-Scraper and Cross-Enrichment for a specific sport.
    For Tennis, triggers the high-volume 24/7 global multi-source pipeline (SofaScore + ESPN + Challenger/ITF).
    """
    sport_key = sport.lower().strip()
    logger.info(f"Executing 3-Tier Ingestion Pipeline for {sport_key.upper()}...")

    raw_events: List[Dict[str, Any]] = []

    if sport_key == "tennis":
        # Multi-Source Simultaneous Ingestion for 24/7 Global Tennis
        try:
            raw_events = fetch_global_tennis_slate()
        except Exception as e:
            logger.warning(f"Global tennis scraper error ({e}); falling back to ESPN rolling feed.")
            raw_events = fetch_rolling_window_events("tennis", days_ahead=7)
    else:
        # Step 1: Tier 1 (Primary Live Scraper - ESPN Hidden API)
        raw_events = fetch_rolling_window_events(sport_key, days_ahead=7)

        # Step 2: Circuit Breaker Failover if Tier 1 returned 0 events
        if not raw_events:
            logger.warning(f"Tier 1 returned 0 events for {sport_key}. Activating Tier 2 Failover Scraper...")
            if sport_key == "mlb":
                raw_events = fetch_mlb_statsapi_failover()

    if not raw_events:
        logger.info(f"No active games found in current calendar window for {sport_key}.")
        return []

    # Step 3: Cross-Source Enrichment (Tiers 2 & 3)
    enriched_events: List[Dict[str, Any]] = []
    for ev in raw_events:
        # Tier 2: Advanced Metrics (FIP, BaseRuns, EPA, Havoc, Surface Elo, Momentum)
        ev = enrich_event_metrics(ev)

        # Tier 3: Environmental (Live Open-Meteo Weather, Dome check, rest differential)
        ev = enrich_event_environment(ev)

        # Cache in memory
        LIVE_EVENTS_IN_MEMORY_REGISTRY[ev["external_id"]] = ev
        enriched_events.append(ev)

    logger.info(f"Successfully processed and enriched {len(enriched_events)} live events for {sport_key}.")
    return enriched_events


def run_unified_ingestion_pipeline(sport_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Runs the full ingestion pipeline, prioritizing Tennis first to guarantee
    coverage across global tours, followed by MLB, CFB, and NFL.
    Persists batch directly to Supabase.
    """
    # Prioritize Tennis first in pipeline order
    if sport_filter:
        sports = [sport_filter.lower().strip()]
    else:
        sports = ["tennis", "mlb", "cfb", "nfl"]

    all_events: List[Dict[str, Any]] = []

    for sp in sports:
        try:
            sp_events = ingest_sport_live(sp)
            all_events.extend(sp_events)
        except Exception as exc:
            logger.error(f"Error executing 3-Tier ingestion for {sp}: {exc}", exc_info=True)

    # Persist batch to Supabase without truncation
    if all_events:
        upsert_events_to_supabase(all_events)

    return all_events


def get_live_events(sport_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns live sporting events from memory registry without any artificial cap.
    If registry is empty, triggers immediate synchronous live ingestion.
    """
    if not LIVE_EVENTS_IN_MEMORY_REGISTRY:
        run_unified_ingestion_pipeline(sport_filter)

    events = list(LIVE_EVENTS_IN_MEMORY_REGISTRY.values())
    if sport_filter:
        sp_norm = sport_filter.lower().strip()
        events = [e for e in events if e.get("sport", "").lower() == sp_norm]

    # Sort status: in_progress first, scheduled second, completed third
    status_priority = {"in_progress": 0, "scheduled": 1, "completed": 2, "postponed": 3}
    events.sort(key=lambda x: (status_priority.get(x.get("status", "scheduled"), 4), x.get("event_date", "")))

    return events
