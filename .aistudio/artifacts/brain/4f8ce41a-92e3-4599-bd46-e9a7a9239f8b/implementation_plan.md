# The Prediction Nexus: 60-Day Walk-Forward Empirical Calibration & Hardened Production Pipeline

A comprehensive, zero-placeholder quantitative sports modeling and prediction platform covering **MLB, Tennis (ATP/WTA), College Football (CFB), and NFL**. This plan establishes an empirical pipeline that ingests real historical matches across a 60-day window (August 11, 2026 – October 11, 2026), executes chronological walk-forward out-of-sample calibration with zero look-ahead bias, populates the upcoming week (October 11–18, 2026), and benchmarks model accuracy directly against Vegas closing lines or transparent empirical prior baselines.

---

### User Review & Critical Hardening Decisions

> [!IMPORTANT]
> The following parameters and edge-case hardening rules are integrated into this plan:

- **Window Indexing & 7-Window Progressive Architecture**:
  - Window 1: `2026-08-11` to `2026-08-20` (10 days)
  - Window 2: `2026-08-21` to `2026-08-31` (11 days, fixing August 31 coverage)
  - Window 3: `2026-09-01` to `2026-09-10` (10 days)
  - Window 4: `2026-09-11` to `2026-09-20` (10 days)
  - Window 5: `2026-09-21` to `2026-09-30` (10 days)
  - Window 6: `2026-10-01` to `2026-10-11` (11 days)
  - Window 7 (Forward-Looking Active Window): `2026-10-11` to `2026-10-18` (7 days ahead for active NFL Week slates, CFB fixtures, MLB Postseason games, and active ATP/WTA tournament draws).
- **Zero Look-Ahead Bias Record Adjustments**:
  - For completed (`STATUS_FINAL`) matches retrieved from ESPN or MLB StatsAPI, the returned `competitor.records` already reflects the post-match outcome. The calibration engine strictly subtracts 1 win from the winning team's snapshot record and 1 loss from the losing team's snapshot record prior to calculating the pre-match forecasted probability $f_t$.
  - Dynamic Elo and rating weights are frozen at the pre-match state $t^-$ and updated strictly *after* $f_t$ is recorded and evaluated against outcome $o_t$.
- **Transparent Missing Odds Policy (Zero Fabrication)**:
  - When real closing odds exist (via pre-match ingestion or preserved ESPN `competition.odds`), calculate exact vig-free Vegas implied probabilities $v_t$ and evaluate $\text{BS}_{\text{Vegas}, t}$.
  - When ESPN archives an event without odds, never synthesize or fabricate mock betting lines. Instead, evaluate an empirical "Prior Record/Rank Baseline Brier" and label it transparently in the UI as `"Empirical Prior Baseline (ESPN Odds Archived)"`.
- **Infrastructure & Environment Hardening**:
  - `vite.config.ts`: Define `envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_']` and bind `process.env` mappings via `loadEnv`.
  - `vercel.json`: Configure `"functions": { "api/index.py": { "maxDuration": 60 } }` with rewrites from `/api/(.*)` to `/api/index.py`.

---

### 1. Mathematical Architecture & Calibration Theory

#### A. Out-of-Sample Pre-Match Probability Formulation ($f_t$)
To guarantee strict out-of-sample validity:
1. **Pre-Match State Reconstruction**:
   $$\text{Wins}_{\text{pre}} = \begin{cases} \text{Wins}_{\text{reported}} - 1 & \text{if winner} \\ \text{Wins}_{\text{reported}} & \text{if loser} \end{cases}$$
   $$\text{Losses}_{\text{pre}} = \begin{cases} \text{Losses}_{\text{reported}} & \text{if winner} \\ \text{Losses}_{\text{reported}} - 1 & \text{if loser} \end{cases}$$
2. **Sport-Specific Quantitative Baselines**:
   - **MLB**: Pythagenpat / BaseRuns formula parameterized by team pre-match run differentials, starting pitcher FIP, and venue park factors.
   - **CFB & NFL**: Net EPA/play differentials, Havoc rate margins, and pre-match scoring distributions adjusted for home-field advantage ($+2.4$ pts for CFB, $+1.8$ pts for NFL).
   - **Tennis**: Surface-specific Elo rating difference:
     $$P(A \succ B) = \frac{1}{1 + 10^{(\text{Elo}_B - \text{Elo}_A)/400}}$$
3. **50,003-Iteration Vectorized Monte Carlo**:
   - For all active and forward-looking games (Window 7: Oct 11–18, 2026), run 50,003 typed array iterations (`Float64Array`) yielding projected score spreads, totals, and percentiles (5th, 50th, 95th).

#### B. Walk-Forward Sequential EWMA Updates
Matches are sorted strictly by completion timestamp. For event $t$:
1. Compute Brier score: $\text{BS}_t = (f_t - o_t)^2$ where $o_t \in \{0, 1\}$.
2. Compute benchmark Brier score $\text{BS}_{\text{Benchmark}, t}$:
   - If closing odds are available: vig-free Vegas implied probability $v_t \implies (v_t - o_t)^2$.
   - If odds are archived/missing: empirical prior baseline probability $b_t \implies (b_t - o_t)^2$.
3. Sequentially update cumulative Exponentially Weighted Moving Average (EWMA) Brier score:
   $$\overline{\text{BS}}_{t} = \alpha \cdot \text{BS}_t + (1 - \alpha) \cdot \overline{\text{BS}}_{t-1}$$
4. Shift framework parameters $\theta$ proportionally to directional error $(f_t - o_t)$ using learning rate $\eta$.

---

### 2. Multi-Sport Data Pipeline & Ingestion Windows

```
┌────────────────────────────────────────────────────────────────────────┐
│             PROGRESSIVE 7-WINDOW SCRAPING & HYDRATION ARCHITECTURE     │
├────────────────────────────────────────────────────────────────────────┤
│ Window 1: 2026-08-11 to 2026-08-20 (10d) - Early Aug Historical        │
│ Window 2: 2026-08-21 to 2026-08-31 (11d) - Late Aug Historical [Fixed] │
│ Window 3: 2026-09-01 to 2026-09-10 (10d) - Early Sep Historical        │
│ Window 4: 2026-09-11 to 2026-09-20 (10d) - Mid Sep Historical          │
│ Window 5: 2026-09-21 to 2026-09-30 (10d) - Late Sep Historical         │
│ Window 6: 2026-10-01 to 2026-10-11 (11d) - Recent Oct Historical       │
│ Window 7: 2026-10-11 to 2026-10-18 ( 7d) - Forward-Looking Active Slate │
└────────────────────────────────────────────────────────────────────────┘
```

- **MLB**: Single high-efficiency call to MLB StatsAPI (`statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-08-11&endDate=2026-10-18&hydrate=probablePitcher,linescore,team`) capturing all regular season and postseason games in one request.
- **Tennis**: Rolling daily queries across ESPN ATP and WTA scoreboards (`site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=YYYYMMDD`) and SofaScore scheduled events.
- **CFB & NFL**: Scheduled weekly and daily queries across ESPN College Football (`groups=80&limit=100&dates=YYYYMMDD`) and NFL scoreboards.

---

### 3. File Implementation & Verification Plan

#### 1. `vite.config.ts` & `vercel.json`
- Ensure `vite.config.ts` includes `envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_']` and explicit `define` blocks with `loadEnv`.
- Ensure `vercel.json` configures Python serverless routing with `"maxDuration": 60` and routes `/api/(.*)` to `/api/index.py`.

#### 2. `src/types/database.ts`
- Add types for `CalibrationWindowProgress`, `VegasComparisonRecord`, `WalkForwardStep`, and `HistoricalWindowConfig`.
- Ensure distinct typing for `benchmark_type: 'vegas_closing' | 'prior_record_baseline'`.

#### 3. `src/data/seedData.ts`
- Zero hardcoded mock matches.
- All frameworks start with `cumulative_brier_score: null` ("Awaiting Calibration") and `evaluated_event_count: 0`.

#### 4. `src/services/browserScraper.ts`
- Configure exact 7 windows including August 31 leapfix (`2026-08-21` to `2026-08-31`) and forward-looking window (`2026-10-11` to `2026-10-18`).
- Implement cache-first Supabase checks, parallel browser fetches, and non-blocking error handling.
- Extract closing odds if present without inventing values when absent.

#### 5. `src/services/calibrationEngine.ts`
- Deduplicate and sort historical games chronologically.
- Apply look-ahead correction (subtract 1 win/1 loss from final record).
- Calculate $f_t$, event Brier score, and benchmark Brier score.
- Label missing odds as `"Empirical Prior Baseline (ESPN Odds Archived)"`.
- Compute dynamic EWMA parameter updates and cumulative accuracy curves.

#### 6. `src/services/simulationEngine.ts`
- Execute 50,003 Monte Carlo iterations (`Float64Array`) for upcoming/active games (Window 7).
- No random mock data generation.

#### 7. `src/services/nexusStore.ts`
- Manage progressive 7-window hydration and real-time state.
- Expose calibrated framework parameters, active slate, and post-mortem ledger.

#### 8. `src/components/AccuracyLedgerView.tsx`
- Build the 2-Month Calibration & Proof of Accuracy Ledger:
  - Model vs Vegas/Prior Baseline Brier score comparison cards.
  - Interactive convergence trajectory chart.
  - Per-match audit ledger with transparent benchmark labeling (`"Vegas Closing Lines"` vs `"Empirical Prior Baseline (ESPN Odds Archived)"`).
  - Sport-specific drilldowns with parameter drift indicators.

#### 9. `src/components/OverviewView.tsx` & `src/components/TopNav.tsx`
- Display active and upcoming fixtures (Window 7) with sport filters.
- Top progressive 7-window calibration status bar.
- Clean navigation to the Accuracy Ledger.

#### 10. `api/index.py`
- Async FastAPI endpoint supporting 60-day historical chunking and live slate ingestion.
- Pure Supabase REST upserts with zero Celery/Redis/Render dependencies.

---

### 4. Verification & Testing Steps

1. **Compilation Check**: Run `compile_applet` and verify 0 TypeScript/build errors.
2. **Lint Validation**: Run `lint_applet` and confirm 0 syntax or lint failures.
3. **Edge Case Verification**:
   - Verify Window 2 explicitly includes `2026-08-31`.
   - Verify Window 7 populates upcoming matches between `2026-10-11` and `2026-10-18`.
   - Verify completed matches exhibit no look-ahead leakage (pre-match record is accurately adjusted).
   - Verify events with missing odds display `"Empirical Prior Baseline (ESPN Odds Archived)"` without `NaN` or fabricated figures.
   - Confirm framework Brier scores update dynamically from `0.00000` solely through chronological post-mortem calculation.
