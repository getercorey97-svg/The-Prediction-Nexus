# The Prediction Nexus: Yukalov-Sornette Quantum Decision Theory & The Geter Principle Upgrade

Architectural and quantitative implementation plan for upgrading **The Prediction Nexus** with the **Yukalov-Sornette (YS) Quantum Decision Theory** framework governed by **The Geter Principle (The Chaos or Peace Paradox)**.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters were confirmed during Phase 1 clarification:

- **Probability Normalization Method**: Sigmoidal log-odds projection preserving the strict unit interval $[0.001, 0.999]$ while allowing mathematically unbounded phase oscillations:
  $$\text{logit}(p(\pi)) = \text{logit}(f(\pi)) + \frac{q(\pi)}{\sqrt{f(\pi)(1 - f(\pi))}}$$
- **Quantum Inspector Interaction**: An interactive leverage slider in the UI ($0.0 \to 1.0$) driving seamless transitions between the **Peace State** (low leverage, $q(\pi) \to 0$) and the **Chaos State** (high leverage, active phase interference $\theta$).
- **Distribution Shift in Monte Carlo Generator**: Shifts the mean expected score margin proportionally to $q(\pi)$ while simultaneously triggering **quantum volatility expansion** (variance dilation) in the 50,003 NumPy iteration arrays during Chaos states.

---

### 1. Overview & Core Concept

Classical sports betting models rely purely on utility and frequentist probability ($f(\pi)$), failing to capture nonlinear subjective momentum shifts during sudden, high-stress game states. This upgrade introduces the **Yukalov-Sornette (YS) Quantum Decision Theory**:

$$p(\pi) = f(\pi) + q(\pi)$$

Where:
- $f(\pi)$ is the classical rational probability derived from verifiable sport fundamentals (MLB BaseRuns/FIP, CFB EPA/Havoc, NFL EPA/CPOE, Tennis Surface Elo).
- $q(\pi)$ is the **quantum interference term** modeling cognitive and emotional state superposition under uncertainty:
  $$q(\pi) = 2 \sqrt{f(\pi)(1 - f(\pi))} \cos(\theta)$$
- **The Geter Principle (The Chaos or Peace Paradox)** acts as the quantum decoherence governor:
  - **Peace State** (Normal/Equilibrium Flow): When game momentum aligns with statistical expectations, the quantum phase decoheres ($\cos(\theta) \to 0$ or leverage dampener $\lambda \to 0$), leaving $q(\pi) \to 0$ and yielding pure classical dominance $p(\pi) = f(\pi)$.
  - **Chaos State** (High-Leverage Inflection): Triggered when match pressure exceeds the critical threshold (late innings, red-zone 4th downs, break-point saves, sudden momentum swings). The governor activates full phase interference $q(\pi)$, shifting win probabilities and expanding stochastic variance across the 50,003 Monte Carlo iterations.

---

### 2. User Experience & Visual Design

- **Quantum State Inspector Panel (`src/components/FactorDecompositionView.tsx`)**:
  - Live status indicator: **PEACE STATE** (emerald baseline) vs. **CHAOS STATE** (amber/violet quantum interference).
  - Interactive **Game Leverage Index** slider ($0.0 \times$ to $1.0 \times$).
  - Phase Angle $\theta$ selector ($0^\circ \to 360^\circ$) representing constructive interference (positive surge) vs. destructive interference (choke/negative shock).
  - Comparative metrics bar:
    - Classical Probability $f(\pi)$
    - Quantum Interference $q(\pi)$
    - Resulting Quantum-Governed Probability $p(\pi)$
    - Volatility Expansion Multiplier ($1.0\times \to 1.45\times$)
  - Interference Wave visualization: Dynamic trigonometric sine/cosine curve illustrating phase shift $\cos(\theta)$.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Sigmoidal Log-Odds Projection vs. Hard Clamping**
  - *Chosen Approach*: Sigmoidal mapping $\text{logit}(p) = \text{logit}(f) + \delta_q$.
  - *Why*: Direct linear addition $f(\pi) + q(\pi)$ can breach $[0, 1]$ when $f(\pi)$ is near boundaries (e.g., $0.85 + 0.20 = 1.05$). Sigmoidal projection naturally squashes extreme shifts, ensuring mathematically rigorous probabilities while preserving sensitivity.
- **Decision 2: Volatility Expansion During Chaos**
  - *Chosen Approach*: Dilation of the covariance matrix by $(1 + |q(\pi)| \times 0.75)$ during Chaos states in 50,003 Monte Carlo simulations.
  - *Why*: High-leverage inflection moments not only shift expected outcomes but inherently increase game variance (wild finishes, sudden overtime, blowout runs).

---

### 4. Technical Architecture & Component Tree

```
┌────────────────────────────────────────────────────────────────────────┐
│                   YUKALOV-SORNETTE QUANTUM ECOSYSTEM                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   The Geter Principle Decoherence Governor                             │
│   backend/engine/quantum_governor.py                                   │
│   ├── YS Formula: p(π) = f(π) + q(π)                                   │
│   ├── Peace State: q(π) -> 0                                           │
│   └── Chaos State: q(π) = 2 * sqrt(f * (1-f)) * cos(θ)                 │
│                                                                        │
│                      │ Injects quantum term                            │
│                      ▼                                                 │
│   Vectorized Monte Carlo Generator                                     │
│   backend/engine/monte_carlo.py (Updated)                              │
│   ├── Intercepts f(π)                                                  │
│   ├── Applies q(π) shift to mean expected margin                       │
│   └── Expands NumPy distribution variance (50,003 iterations)          │
│                                                                        │
│                      │ Scans high-leverage triggers                    │
│                      ▼                                                 │
│   Sport Framework Inflection Scanners                                  │
│   ├── mlb.py    (Leverage Index & Late Bullpen Splits)                 │
│   ├── cfb.py    (Havoc Spikes & 4th Down Aggression)                   │
│   ├── nfl.py    (2-Minute Drill & Red-Zone High-Leverage)              │
│   └── tennis.py (Break-Point Saves & Tiebreak Deciders)                │
│                                                                        │
│                      │ Real-time UI Inspection                         │
│                      ▼                                                 │
│   Frontend Quantum Inspector (FactorDecompositionView.tsx)             │
│   ├── Peace / Chaos State Indicator                                    │
│   ├── Interactive Leverage Slider                                      │
│   ├── f(π) vs q(π) vs p(π) Breakdown                                   │
│   └── Quantum Phase Interference Wave Display                          │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Files to Generate/Update:
1. `backend/engine/quantum_governor.py`: The Geter Principle Decoherence Governor implementing the full Yukalov-Sornette formula, sigmoidal projection, Peace/Chaos states, and inflection detection.
2. `backend/engine/monte_carlo.py`: Update to intercept $f(\pi)$, evaluate game leverage state, shift expected spreads, and dilate variance across 50,003 NumPy iterations.
3. `backend/ingestion/mlb.py`, `cfb.py`, `nfl.py`, `tennis.py`: Update with inflection event triggers and $\theta$ phase shift modulations.
4. `src/services/simulationEngine.ts`: Mirror quantum governor logic in client runner so web simulations reflect the exact YS formulas.
5. `src/components/FactorDecompositionView.tsx`: Integrate the Quantum State Inspector panel with live leverage slider, state indicators, and phase curve graphics.
