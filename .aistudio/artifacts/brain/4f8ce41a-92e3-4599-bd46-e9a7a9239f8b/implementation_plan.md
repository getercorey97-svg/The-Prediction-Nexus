# The Prediction Nexus: Production Web Application (Batch 4)

Complete implementation plan for **Batch 4** of **The Prediction Nexus**, assembling the full production frontend suite with zero code truncation, real-time Supabase WebSocket synchronization, interactive Tennis 1-on-1 head-to-head modeling, Model Factor Decomposition Inspector, and the live Simulation & Worker Lab.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters were confirmed during Phase 1 clarification:

- **Tennis Matchup Presets**: Includes one-click marquee Grand Slam presets (Alcaraz vs. Sinner, Djokovic vs. Alcaraz, Zverev vs. Medvedev, Swiatek vs. Sabalenka) while supporting arbitrary text inputs with automatic 1,500 baseline Elo handling.
- **Supabase Realtime Streaming**: Automatic WebSocket channel subscription (`supabase_realtime`) streaming live odds updates, match completion triggers, and EWMA calibrations directly to the interface with non-intrusive toast alerts.
- **Factor Decomposition Presentation**: Interactive quantitative breakdown displaying sport-specific mathematical factors (BaseRuns, FIP, EPA/play, Havoc rates, QB CPOE, Surface Elo) with visual weight sliders and calibration delta comparisons.

---

### 1. Overview & Core Concept

Batch 4 delivers the complete user-facing application for institutional sports quantitative analysis:

1. **Dashboard & Multi-Sport Monitor**:
   - Comprehensive live schedule across MLB, CFB, NFL, and Tennis.
   - Empirical outcome tracking and instant match completion trigger simulator.
2. **Tennis 1-on-1 Head-to-Head Prediction Tool (`TennisPredictorView.tsx`)**:
   - Arbitrary text-input endpoint for player names with surface selection (Hard, Clay, Grass) and match format (Best of 3 vs. Best of 5).
   - Generates exact win probabilities, set distribution breakdowns (e.g., 2-0, 2-1, 3-0, 3-1, 3-2), total games over/under lines, and 90% confidence bounds from 50,003 Monte Carlo runs.
3. **Model Factor Decomposition Inspector (`FactorDecompositionView.tsx`)**:
   - Deconstructs active algorithmic models into their constituent mathematical metrics.
   - MLB: BaseRuns generation vs. Pitcher FIP splits vs. Bullpen leverage.
   - CFB: Offensive EPA vs. Defensive EPA vs. Havoc Rate differentials.
   - NFL: Passing EPA vs. Rushing EPA vs. Quarterback CPOE.
   - Tennis: Surface Elo vs. Return point win rates vs. Serve dominance.
4. **Simulation & Worker Lab (`SimulationLabView.tsx`)**:
   - Real-time 50,003 Monte Carlo execution workbench with sub-15ms execution latency benchmarking.
   - Interactive 7-bucket density histogram of simulated margins and totals.
5. **Autonomous Upgrades Audit Trail & Post-Mortem Lab**:
   - Factual verification records showing exact Brier Scores $(f_t - o_t)^2$ and real-time EWMA parameter shift histories.
6. **Supabase Realtime WebSockets (`realtimeSubscription.ts`)**:
   - Listens to PostgreSQL `INSERT` and `UPDATE` events on `sporting_events`, `monte_carlo_predictions`, `factual_post_mortem`, and `autonomous_upgrades`.

---

### 2. User Experience & Visual Design

- **Dark Terminal Quant Aesthetic**:
  - Background: Deep neutral slate canvas (`#080c14`).
  - Structural cards: Single-elevation flat containers (`#0e1422` with hairline border `rgba(255, 255, 255, 0.08)`).
  - Accents: High-intent emerald (`#10b981`) for positive alpha, calibration confidence, and active states; rose (`#f43f5e`) for negative margins; amber (`#f59e0b`) for scheduled states.
  - Typography: Strict `Plus Jakarta Sans` for headings and brand wordmark; `JetBrains Mono` with `tabular-nums` for all metrics, spreads, odds, and Brier Scores.
- **Top Bar Contract**:
  - `Zone 1`: `The Prediction Nexus` (single text element wordmark).
  - `Zone 2`: Clean navigation links (Overview, Tennis 1-on-1, Simulation Lab, Factor Breakdown, Post-Mortem, Model Upgrades, SQL DDL).
  - `Zone 3`: Action buttons (`Simulate Match Completion` & `Download init.sql`).
- **Zero-Pill Discipline**: Metadata rendered as unboxed typography separated by `·` and `/`.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Zero Code Truncation Mandate**
  - *Chosen Approach*: Every component is implemented in full with complete JSX, working event handlers, interactive sliders, and state transitions. No placeholder comments or truncated methods.
- **Decision 2: Dual Mode Backend & Client Execution**
  - *Chosen Approach*: The frontend includes both native client-side vectorized routines (Mulberry32 PRNG + Box-Muller normal transforms running 50,003 iterations in $< 15\text{ms}$) and connection adaptors for the FastAPI/Celery backend.
  - *Why*: Guarantees instantaneous, zero-latency feedback in the web environment while maintaining 100% mathematical fidelity to the Python backend.

---

### 4. Technical Architecture & Component Tree

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PREDICTION NEXUS WEB APP                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   TopNav (Top Bar Contract: Wordmark — Nav Links — Action Buttons)     │
│                                                                        │
│   ├── OverviewView (KPIs, Active Frameworks, Sporting Events Slate)   │
│   ├── TennisPredictorView (1-on-1 Tool, Presets, Set Probabilities)    │
│   ├── SimulationLabView (50,003 Monte Carlo Workbench & Histogram)     │
│   ├── FactorDecompositionView (BaseRuns, EPA, Havoc, CPOE Breakdown)   │
│   ├── PostMortemView (Empirical Box Scores & Brier Score Calibrations)│
│   ├── AutonomousUpgradesView (EWMA Parameter Adaptation Audit Log)     │
│   └── SqlConsoleView (Raw init.sql Script Viewer, Copy & Export)       │
│                                                                        │
│   TriggerSimulatorModal (Official Final Score Verification Sandbox)    │
│   Realtime Toast Alerts (Supabase WebSocket Events)                    │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Files to Generate/Update:
1. `src/components/TennisPredictorView.tsx`: Complete Tennis 1-on-1 predictor with text inputs, marquee presets, surface selection, set score probabilities, and games total line.
2. `src/components/FactorDecompositionView.tsx`: Complete Model Factor Decomposition Inspector with active weight breakdown for MLB, CFB, NFL, Tennis.
3. `src/components/SimulationLabView.tsx`: Enhanced simulation workbench with histogram visualization and Celery queue monitors.
4. `src/components/TopNav.tsx`: Updated with all navigation tabs.
5. `src/App.tsx`: Main coordinator integrating all Batch 4 views with zero code truncation.
