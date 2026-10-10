# The Prediction Nexus: 3-Tier Live Multi-Scraper & Cross-Enrichment Pipeline

Architectural refactoring plan to eliminate all static 2024–2025 mock/seed events and establish an autonomous 3-Tier Live Multi-Scraper and Cross-Enrichment Pipeline for MLB, CFB, NFL, and Tennis, complete with automated FastAPI startup synchronization and direct Supabase database upserts.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters were confirmed during Phase 1 clarification:

- **Schedule Query Window**: When a sport has zero games on today's calendar date, the pipeline automatically queries a rolling window of upcoming 7 days plus recently completed matches, ensuring the dashboard always displays active, verifiable sporting fixtures without static stubs.
- **Environmental & Dome Stadium Handling**: Outdoor venues query the Open-Meteo Live Weather API for real-time temperature, wind speed/direction, humidity, and precipitation probability; indoor/dome venues are tagged as climate-controlled ($72^\circ\text{F}$, 0 mph wind, 0% precip).
- **Database Upsert Strategy**: Events are upserted into Supabase on `external_id` using a non-destructive merge policy (`ON CONFLICT (external_id) DO UPDATE`), preserving existing Monte Carlo simulation predictions, factual post-mortems, and trigger states while updating live scores and statuses.
- **Zero Static Mock Data Mandate**: Complete removal of all hardcoded 2024–2025 mock matchups (e.g., Oct 30 2024 Yankees vs Dodgers, Jan 8 2024 Michigan vs Washington, Feb 11 2024 Chiefs vs 49ers, Jun 9 2024 Alcaraz vs Zverev). The application and API endpoints will exclusively serve empirical live data.

---

### 1. Overview & Core Concept

This refactor transforms **The Prediction Nexus** into a fully autonomous, live-connected sports analytics engine:

1. **Tier 1 (Primary Live Scraper - ESPN Hidden API)**:
   - Queries official hidden REST endpoints at `site.api.espn.com/apis/site/v2/sports/`:
     - MLB: `baseball/leagues/mlb/scoreboard`
     - CFB: `football/leagues/college-football/scoreboard`
     - NFL: `football/leagues/nfl/scoreboard`
     - Tennis: `tennis/leagues/atp/scoreboard` and `tennis/leagues/wta/scoreboard`
   - Extracts real event IDs, live match statuses (`STATUS_SCHEDULED`, `STATUS_IN_PROGRESS`, `STATUS_FINAL`), start times, home/away competitors, box scores, venues, surfaces, and consensus betting odds.
2. **Tier 2 (Secondary Scraper & Advanced Metrics Enricher)**:
   - Automatic failover if ESPN is unreachable (MLB StatsAPI, Yahoo Sports JSON, SofaScore).
   - Enriches games with micro-variables omitted by Tier 1: team BaseRuns & pitcher FIP (MLB), offensive/defensive EPA/play and Havoc rates (CFB/NFL), and surface-specific Elo ratings with break/hold percentages (Tennis).
3. **Tier 3 (Tertiary Scraper & Environmental Enricher)**:
   - Queries **Open-Meteo Live Weather API** (`api.open-meteo.com/v1/forecast`) using venue geographical coordinates.
   - Enriches every outdoor matchup with exact temperature, wind speed/direction, relative humidity, and precipitation risk.
   - Calculates rest-day differentials and travel fatigue metrics.
4. **FastAPI Lifespan Startup & Supabase Synchronization**:
   - Executes automatic ingestion on server boot / wake-up via `@asynccontextmanager(app: FastAPI)` in `backend/main.py`.
   - Directly upserts normalized events into Supabase PostgreSQL using `SUPABASE_SERVICE_ROLE_KEY`.
5. **Frontend Live Binding**:
   - Configures dual env var resolution (`VITE_` and `NEXT_PUBLIC_`) with production fallbacks to `https://nexus-api-3qk0.onrender.com` and `https://aywldwdvflwcanqxxdhi.supabase.co`.
   - Replaces static seed arrays with live state synchronization from `GET /api/events` and Supabase Realtime WebSockets.

---

### 2. User Experience & Visual Design

- **Live Multi-Sport Monitor**:
  - Displays live scores, in-progress game clocks/innings/sets, and scheduled fixtures across MLB, CFB, NFL, and Tennis.
  - Live environmental indicators: Outdoor weather badges (e.g., $68^\circ\text{F}$ · 8 mph NNW · 12% precip) vs. Climate-Controlled Dome badges.
  - Live bookmaker market consensus lines directly scraped from Tier 1/Tier 2.
- **Realtime Trigger Workbench**:
  - "Refresh Live Ingestion" button triggering background pipeline execution across all four sports.
  - "Simulate Match Completion" testing live score triggers directly on current calendar matchups.
- **Anti-Slop Restraint**:
  - Deep slate dark terminal theme (`#080c14`), hairline structural borders (`rgba(255, 255, 255, 0.08)`), clean unboxed metadata with `·` separators, tabular figures for all scores, odds, and weather metrics.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: ESPN Hidden API as Tier 1 Primary**
  - *Chosen Approach*: Official JSON endpoints at `site.api.espn.com`.
  - *Why*: Free, extremely high availability, sub-minute latency for live scores, zero API key requirement, and comprehensive multi-sport coverage including ATP/WTA tennis.
- **Decision 2: Circuit Breaker with Cross-Source Enrichment**
  - *Chosen Approach*: Rather than simple failover, Tiers 2 and 3 actively enrich Tier 1 records with metrics ESPN does not track (Statcast FIP, EPA, Havoc, and Open-Meteo weather).
  - *Why*: Delivers an institutional-grade predictive dataset with high dimensionality without paying for expensive private enterprise sports data APIs.
- **Decision 3: Non-Blocking FastAPI Lifespan Ingestion**
  - *Chosen Approach*: Background task triggered inside FastAPI lifespan startup.
  - *Why*: Prevents Render web service boot timeouts (Render health check must pass in $< 30\text{s}$) while ensuring the database is immediately hydrated with live sporting slates.

---

### 4. Technical Architecture & File Plan

```
┌────────────────────────────────────────────────────────────────────────┐
│                   3-TIER LIVE MULTI-SCRAPER PIPELINE                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   FastAPI Lifespan (Startup) & Worker Trigger                          │
│   backend/main.py                                                      │
│   └── background_tasks.add_task(run_unified_ingestion_pipeline)        │
│                                                                        │
│   Tier 1: Primary Live Scraper (backend/ingestion/tier1_espn.py)       │
│   └── site.api.espn.com/apis/site/v2/sports/ (MLB, CFB, NFL, Tennis)   │
│       ├── Live status, start times, scores, participants, venues       │
│       └── Consensus betting odds & bookmaker lines                     │
│                                                                        │
│   Tier 2: Advanced Metrics Enricher (tier2_metrics.py)                 │
│   └── MLB StatsAPI / Yahoo / SofaScore Failover & Stats                │
│       ├── MLB: BaseRuns, Pitcher FIP, bullpen leverage                 │
│       ├── CFB / NFL: Offensive/Defensive EPA/play, Havoc rates         │
│       └── Tennis: Surface Elo, hold/break %, fatigue                   │
│                                                                        │
│   Tier 3: Environmental Enricher (tier3_environment.py)                │
│   └── Open-Meteo Live Weather API (api.open-meteo.com)                 │
│       ├── Venue coordinates -> temp, wind speed/dir, precip %          │
│       └── Climate-controlled indoor constants (72°F, 0 mph)           │
│                                                                        │
│   Unified Ingestion Orchestrator (tier_orchestrator.py)                │
│   └── Deep-merges Tiers 1-3 -> upserts directly to Supabase            │
│                                                                        │
│   Frontend Data Binding (src/services/apiConfig.ts & nexusStore.ts)    │
│   └── Dual env resolution (VITE_ / NEXT_PUBLIC_)                       │
│   └── Zero static seed arrays; live hydration on load                  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Files to Create / Modify:
1. `backend/ingestion/tier1_espn.py`: Live scoreboard and schedule scraper for MLB, CFB, NFL, and Tennis using ESPN Hidden API.
2. `backend/ingestion/tier2_metrics.py`: Secondary scraper and metrics enricher (FIP, EPA, Havoc, Surface Elo).
3. `backend/ingestion/tier3_environment.py`: Open-Meteo Live Weather API caller with stadium coordinate dictionary.
4. `backend/ingestion/tier_orchestrator.py`: Unified pipeline orchestrator with circuit-breaker failovers and Supabase PostgreSQL upserts.
5. `backend/main.py`: Refactor with FastAPI lifespan startup trigger, live `GET /api/events`, and pipeline endpoints.
6. `backend/tasks.py`: Updated Celery tasks to call `run_unified_ingestion_pipeline`.
7. `src/services/apiConfig.ts`: Dual-env configuration supporting `VITE_` and `NEXT_PUBLIC_` with Render and Supabase fallbacks.
8. `src/services/nexusStore.ts`: Eliminate hardcoded seed arrays; fetch live events from API/Supabase on mount.
9. `src/data/seedData.ts`: Purge all static 2024-2025 matches; export clean empty defaults and model configurations.
10. `src/components/OverviewView.tsx`, `MonteCarloView.tsx`, `SimulationLabView.tsx`: Live data bindings with real-time refresh triggers.
