/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const RAW_INIT_SQL = `-- ============================================================================
-- THE PREDICTION NEXUS: BATCH 1 - SUPABASE DATABASE INFRASTRUCTURE
-- Autonomous Sports Prediction Platform (MLB, CFB, NFL, Tennis)
-- ============================================================================
-- Mandates:
-- 1. Exact 50,003 Monte Carlo simulated distributions aggregated into percentiles.
-- 2. Zero hallucination: Post-mortems evaluate solely against verified final outcomes.
-- 3. Automated PostgreSQL trigger for atomic Brier Score calculation on match completion.
-- 4. Instant autonomous model upgrades via EWMA hyperparameter calibration.
-- 5. Supabase Realtime publication enabled for zero-refresh clients.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CUSTOM TYPES & ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE sport_type AS ENUM ('mlb', 'cfb', 'nfl', 'tennis');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE upgrade_action_type AS ENUM ('ewma_reweight', 'variance_dampening', 'drift_penalty', 'baseline_reset');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. TABLE: framework_versions
-- Manages active model hyperparameters, EWMA learning rates, and sport weights.
-- ============================================================================
CREATE TABLE IF NOT EXISTS framework_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport sport_type NOT NULL,
    version_tag TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    ewma_alpha NUMERIC(6, 4) NOT NULL DEFAULT 0.0500 CHECK (ewma_alpha > 0 AND ewma_alpha <= 1.0000),
    learning_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0250 CHECK (learning_rate > 0 AND learning_rate <= 1.0000),
    is_active BOOLEAN NOT NULL DEFAULT true,
    cumulative_brier_score NUMERIC(8, 6) DEFAULT NULL CHECK (cumulative_brier_score IS NULL OR (cumulative_brier_score >= 0.0 AND cumulative_brier_score <= 1.0)),
    evaluated_event_count INTEGER NOT NULL DEFAULT 0 CHECK (evaluated_event_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing for active framework queries
CREATE INDEX IF NOT EXISTS idx_framework_sport_active ON framework_versions (sport, is_active);

-- ============================================================================
-- 3. TABLE: sporting_events
-- Central schedule and final empirical scores across MLB, CFB, NFL, and Tennis.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sporting_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport sport_type NOT NULL,
    external_id TEXT NOT NULL UNIQUE,
    event_date TIMESTAMPTZ NOT NULL,
    home_participant TEXT NOT NULL,
    away_participant TEXT NOT NULL,
    surface TEXT DEFAULT NULL,
    venue TEXT DEFAULT NULL,
    status event_status NOT NULL DEFAULT 'scheduled',
    home_score INTEGER DEFAULT NULL CHECK (home_score IS NULL OR home_score >= 0),
    away_score INTEGER DEFAULT NULL CHECK (away_score IS NULL OR away_score >= 0),
    actual_winner TEXT DEFAULT NULL,
    official_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing for match status & schedule lookup
CREATE INDEX IF NOT EXISTS idx_events_sport_status_date ON sporting_events (sport, status, event_date);
CREATE INDEX IF NOT EXISTS idx_events_external_id ON sporting_events (external_id);

-- ============================================================================
-- 4. TABLE: monte_carlo_predictions
-- Pre-match forecast runs: exactly 50,003 Monte Carlo iterations aggregated
-- into win probabilities, score margins, and 5th/95th confidence bounds.
-- ============================================================================
CREATE TABLE IF NOT EXISTS monte_carlo_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES sporting_events(id) ON DELETE CASCADE,
    framework_id UUID NOT NULL REFERENCES framework_versions(id) ON DELETE RESTRICT,
    simulation_iterations INTEGER NOT NULL DEFAULT 50003 CHECK (simulation_iterations = 50003),
    home_win_probability NUMERIC(6, 4) NOT NULL CHECK (home_win_probability >= 0.0 AND home_win_probability <= 1.0000),
    away_win_probability NUMERIC(6, 4) NOT NULL CHECK (away_win_probability >= 0.0 AND away_win_probability <= 1.0000),
    predicted_home_spread NUMERIC(6, 2) NOT NULL,
    predicted_total_score NUMERIC(6, 2) NOT NULL,
    p05_score_diff NUMERIC(6, 2) NOT NULL,
    p95_score_diff NUMERIC(6, 2) NOT NULL,
    p05_total_score NUMERIC(6, 2) NOT NULL,
    p95_total_score NUMERIC(6, 2) NOT NULL,
    market_implied_home_prob NUMERIC(6, 4) DEFAULT NULL CHECK (market_implied_home_prob IS NULL OR (market_implied_home_prob >= 0.0 AND market_implied_home_prob <= 1.0000)),
    market_implied_away_prob NUMERIC(6, 4) DEFAULT NULL CHECK (market_implied_away_prob IS NULL OR (market_implied_away_prob >= 0.0 AND market_implied_away_prob <= 1.0000)),
    market_odds JSONB NOT NULL DEFAULT '{}'::jsonb,
    simulated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_event_framework_prediction UNIQUE (event_id, framework_id),
    CONSTRAINT chk_probabilities_sum CHECK (ABS((home_win_probability + away_win_probability) - 1.0) <= 0.01)
);

-- Indexing for prediction retrieval
CREATE INDEX IF NOT EXISTS idx_predictions_event_id ON monte_carlo_predictions (event_id);
CREATE INDEX IF NOT EXISTS idx_predictions_framework_id ON monte_carlo_predictions (framework_id);

-- ============================================================================
-- 5. TABLE: factual_post_mortem
-- Evaluates pre-match predictions strictly against verified empirical results.
-- Computes the Brier Score = (predicted_probability - actual_binary_outcome)^2.
-- ============================================================================
CREATE TABLE IF NOT EXISTS factual_post_mortem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE REFERENCES sporting_events(id) ON DELETE CASCADE,
    prediction_id UUID NOT NULL REFERENCES monte_carlo_predictions(id) ON DELETE CASCADE,
    framework_id UUID NOT NULL REFERENCES framework_versions(id) ON DELETE RESTRICT,
    predicted_home_win_prob NUMERIC(6, 4) NOT NULL,
    actual_home_outcome NUMERIC(3, 1) NOT NULL CHECK (actual_home_outcome IN (0.0, 0.5, 1.0)),
    brier_score NUMERIC(8, 6) NOT NULL CHECK (brier_score >= 0.0 AND brier_score <= 1.0),
    actual_margin INTEGER NOT NULL,
    actual_total INTEGER NOT NULL,
    spread_absolute_error NUMERIC(6, 2) NOT NULL,
    total_absolute_error NUMERIC(6, 2) NOT NULL,
    calibration_delta NUMERIC(8, 6) NOT NULL,
    within_p05_p95_interval BOOLEAN NOT NULL DEFAULT true,
    empirical_notes TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_post_mortem_framework_brier ON factual_post_mortem (framework_id, brier_score);
CREATE INDEX IF NOT EXISTS idx_post_mortem_evaluated_at ON factual_post_mortem (evaluated_at DESC);

-- ============================================================================
-- 6. TABLE: autonomous_upgrades
-- Real-time audit log of EWMA parameter calibrations triggered by post-mortems.
-- ============================================================================
CREATE TABLE IF NOT EXISTS autonomous_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID NOT NULL REFERENCES framework_versions(id) ON DELETE RESTRICT,
    post_mortem_id UUID NOT NULL REFERENCES factual_post_mortem(id) ON DELETE CASCADE,
    action_type upgrade_action_type NOT NULL DEFAULT 'ewma_reweight',
    previous_weights JSONB NOT NULL,
    adjusted_weights JSONB NOT NULL,
    brier_delta NUMERIC(8, 6) NOT NULL,
    applied_ewma_step NUMERIC(6, 4) NOT NULL,
    calibration_notes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_upgrades_framework_created ON autonomous_upgrades (framework_id, created_at DESC);

-- ============================================================================
-- 7. AUTOMATED TRIGGER 1: EVALUATE FACTUAL POST-MORTEM ON EVENT COMPLETION
-- When sporting_events updates to 'completed' with scores, atomically compute Brier Score.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_evaluate_event_post_mortem()
RETURNS TRIGGER AS $$
DECLARE
    v_prediction RECORD;
    v_actual_home_outcome NUMERIC(3, 1);
    v_actual_winner TEXT;
    v_actual_margin INTEGER;
    v_actual_total INTEGER;
    v_brier_score NUMERIC(8, 6);
    v_spread_error NUMERIC(6, 2);
    v_total_error NUMERIC(6, 2);
    v_calibration_delta NUMERIC(8, 6);
    v_within_bounds BOOLEAN;
    v_notes TEXT;
BEGIN
    -- Only execute when transitioning to 'completed' with valid integer scores
    IF NEW.status = 'completed' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL AND (OLD.status <> 'completed' OR OLD.status IS NULL) THEN
        
        -- Determine empirical winner and numeric outcome
        v_actual_margin := NEW.home_score - NEW.away_score;
        v_actual_total := NEW.home_score + NEW.away_score;

        IF NEW.home_score > NEW.away_score THEN
            v_actual_home_outcome := 1.0;
            v_actual_winner := NEW.home_participant;
        ELSIF NEW.home_score < NEW.away_score THEN
            v_actual_home_outcome := 0.0;
            v_actual_winner := NEW.away_participant;
        ELSE
            v_actual_home_outcome := 0.5;
            v_actual_winner := 'Tie / Draw';
        END IF;

        -- Update actual winner on the event record
        NEW.actual_winner := v_actual_winner;
        NEW.updated_at := timezone('utc'::text, now());

        -- Locate latest pre-match Monte Carlo prediction for this event
        SELECT p.*, f.id AS active_framework_id, f.cumulative_brier_score, f.ewma_alpha
        INTO v_prediction
        FROM monte_carlo_predictions p
        JOIN framework_versions f ON f.id = p.framework_id
        WHERE p.event_id = NEW.id
        ORDER BY p.simulated_at DESC
        LIMIT 1;

        -- If a prediction exists, atomically evaluate post-mortem
        IF FOUND THEN
            -- Empirical Brier Score = (predicted_prob - actual_binary_outcome)^2
            v_brier_score := ROUND(POWER(v_prediction.home_win_probability - v_actual_home_outcome, 2)::numeric, 6);
            v_spread_error := ROUND(ABS(v_actual_margin - v_prediction.predicted_home_spread)::numeric, 2);
            v_total_error := ROUND(ABS(v_actual_total - v_prediction.predicted_total_score)::numeric, 2);
            v_within_bounds := (v_actual_margin >= v_prediction.p05_score_diff AND v_actual_margin <= v_prediction.p95_score_diff);

            -- Calibration Delta against framework running Brier baseline (or 0.25 unbiased coin)
            IF v_prediction.cumulative_brier_score IS NOT NULL THEN
                v_calibration_delta := ROUND((v_brier_score - v_prediction.cumulative_brier_score)::numeric, 6);
            ELSE
                v_calibration_delta := ROUND((v_brier_score - 0.250000)::numeric, 6);
            END IF;

            v_notes := FORMAT(
                'Empirical Outcome: %s %s, %s %s. Margin: %+s (pred: %+s). Total: %s (pred: %s). Brier Score: %s (baseline delta: %+s). 90%% MC Interval: [%s, %s] -> %s.',
                NEW.home_participant, NEW.home_score,
                NEW.away_participant, NEW.away_score,
                v_actual_margin, v_prediction.predicted_home_spread,
                v_actual_total, v_prediction.predicted_total_score,
                v_brier_score, v_calibration_delta,
                v_prediction.p05_score_diff, v_prediction.p95_score_diff,
                CASE WHEN v_within_bounds THEN 'CAPTURED' ELSE 'OUTLIER' END
            );

            -- Insert or replace post-mortem entry
            INSERT INTO factual_post_mortem (
                event_id,
                prediction_id,
                framework_id,
                predicted_home_win_prob,
                actual_home_outcome,
                brier_score,
                actual_margin,
                actual_total,
                spread_absolute_error,
                total_absolute_error,
                calibration_delta,
                within_p05_p95_interval,
                empirical_notes,
                evaluated_at
            ) VALUES (
                NEW.id,
                v_prediction.id,
                v_prediction.active_framework_id,
                v_prediction.home_win_probability,
                v_actual_home_outcome,
                v_brier_score,
                v_actual_margin,
                v_actual_total,
                v_spread_error,
                v_total_error,
                v_calibration_delta,
                v_within_bounds,
                v_notes,
                timezone('utc'::text, now())
            )
            ON CONFLICT (event_id) DO UPDATE SET
                prediction_id = EXCLUDED.prediction_id,
                framework_id = EXCLUDED.framework_id,
                predicted_home_win_prob = EXCLUDED.predicted_home_win_prob,
                actual_home_outcome = EXCLUDED.actual_home_outcome,
                brier_score = EXCLUDED.brier_score,
                actual_margin = EXCLUDED.actual_margin,
                actual_total = EXCLUDED.actual_total,
                spread_absolute_error = EXCLUDED.spread_absolute_error,
                total_absolute_error = EXCLUDED.total_absolute_error,
                calibration_delta = EXCLUDED.calibration_delta,
                within_p05_p95_interval = EXCLUDED.within_p05_p95_interval,
                empirical_notes = EXCLUDED.empirical_notes,
                evaluated_at = timezone('utc'::text, now());
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_completed_post_mortem ON sporting_events;
CREATE TRIGGER trg_event_completed_post_mortem
    BEFORE UPDATE ON sporting_events
    FOR EACH ROW
    EXECUTE FUNCTION fn_evaluate_event_post_mortem();

-- ============================================================================
-- 8. AUTOMATED TRIGGER 2: AUTONOMOUS MODEL UPGRADES VIA EWMA ADAPTATION
-- When a post-mortem is recorded, update framework running Brier and log weight step.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_trigger_autonomous_model_upgrade()
RETURNS TRIGGER AS $$
DECLARE
    v_framework RECORD;
    v_new_cumulative_brier NUMERIC(8, 6);
    v_brier_delta NUMERIC(8, 6);
    v_prev_weights JSONB;
    v_adjusted_weights JSONB;
    v_alpha NUMERIC(6, 4);
    v_learning_rate NUMERIC(6, 4);
    v_action upgrade_action_type;
    v_notes TEXT;
BEGIN
    -- Fetch active framework version
    SELECT * INTO v_framework
    FROM framework_versions
    WHERE id = NEW.framework_id
    FOR UPDATE;

    IF FOUND THEN
        v_alpha := v_framework.ewma_alpha;
        v_learning_rate := v_framework.learning_rate;
        v_prev_weights := v_framework.parameters;

        -- Compute EWMA running Brier score: B_new = (alpha * match_brier) + ((1 - alpha) * B_prev)
        IF v_framework.cumulative_brier_score IS NULL THEN
            v_new_cumulative_brier := NEW.brier_score;
            v_brier_delta := ROUND((NEW.brier_score - 0.250000)::numeric, 6);
        ELSE
            v_new_cumulative_brier := ROUND((v_alpha * NEW.brier_score + (1.0 - v_alpha) * v_framework.cumulative_brier_score)::numeric, 6);
            v_brier_delta := ROUND((NEW.brier_score - v_framework.cumulative_brier_score)::numeric, 6);
        END IF;

        -- Determine autonomous calibration action based on match discrepancy
        IF NEW.brier_score <= 0.100000 THEN
            -- Exceptional calibration: reinforce active weights with minor dampening
            v_action := 'ewma_reweight';
            v_adjusted_weights := jsonb_set(
                v_prev_weights,
                '{calibration_confidence}',
                to_jsonb(LEAST(1.0, COALESCE((v_prev_weights->>'calibration_confidence')::numeric, 0.5) + (v_learning_rate * 0.5)))
            );
            v_notes := FORMAT('Empirical validation confirmed. Low Brier score of %s reinforced framework parameter confidence by %+s.', NEW.brier_score, ROUND((v_learning_rate * 0.5)::numeric, 4));
        ELSIF NEW.brier_score > 0.450000 THEN
            -- Severe miscalibration: apply drift penalty and adjust variance dampeners
            v_action := 'drift_penalty';
            v_adjusted_weights := jsonb_set(
                v_prev_weights,
                '{variance_dampener}',
                to_jsonb(GREATEST(0.1, COALESCE((v_prev_weights->>'variance_dampener')::numeric, 1.0) - (v_learning_rate * 1.2)))
            );
            v_notes := FORMAT('Empirical outlier detected. Elevated Brier score of %s triggered drift penalty: variance dampener reduced by %s.', NEW.brier_score, ROUND((v_learning_rate * 1.2)::numeric, 4));
        ELSE
            -- Standard EWMA calibration step
            v_action := 'ewma_reweight';
            v_adjusted_weights := jsonb_set(
                v_prev_weights,
                '{last_ewma_step}',
                to_jsonb(ROUND((v_brier_delta * v_learning_rate)::numeric, 6))
            );
            v_notes := FORMAT('Nominal post-mortem calibration. Applied EWMA step of %s against delta of %+s.', ROUND((v_brier_delta * v_learning_rate)::numeric, 6), v_brier_delta);
        END IF;

        -- Update framework version tracking
        UPDATE framework_versions
        SET cumulative_brier_score = v_new_cumulative_brier,
            evaluated_event_count = evaluated_event_count + 1,
            parameters = v_adjusted_weights,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.framework_id;

        -- Audit record in autonomous_upgrades
        INSERT INTO autonomous_upgrades (
            framework_id,
            post_mortem_id,
            action_type,
            previous_weights,
            adjusted_weights,
            brier_delta,
            applied_ewma_step,
            calibration_notes,
            created_at
        ) VALUES (
            NEW.framework_id,
            NEW.id,
            v_action,
            v_prev_weights,
            v_adjusted_weights,
            v_brier_delta,
            v_alpha,
            v_notes,
            timezone('utc'::text, now())
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_mortem_autonomous_upgrade ON factual_post_mortem;
CREATE TRIGGER trg_post_mortem_autonomous_upgrade
    AFTER INSERT ON factual_post_mortem
    FOR EACH ROW
    EXECUTE FUNCTION fn_trigger_autonomous_model_upgrade();

-- ============================================================================
-- 9. SUPABASE REALTIME REPLICATION CONFIGURATION
-- Publish sporting_events, monte_carlo_predictions, factual_post_mortem,
-- and autonomous_upgrades for instantaneous client WebSocket synchronization.
-- ============================================================================

-- Ensure full replica identities for complete row streaming
ALTER TABLE sporting_events REPLICA IDENTITY FULL;
ALTER TABLE monte_carlo_predictions REPLICA IDENTITY FULL;
ALTER TABLE factual_post_mortem REPLICA IDENTITY FULL;
ALTER TABLE autonomous_upgrades REPLICA IDENTITY FULL;
ALTER TABLE framework_versions REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sporting_events;
        ALTER PUBLICATION supabase_realtime ADD TABLE monte_carlo_predictions;
        ALTER PUBLICATION supabase_realtime ADD TABLE factual_post_mortem;
        ALTER PUBLICATION supabase_realtime ADD TABLE autonomous_upgrades;
        ALTER PUBLICATION supabase_realtime ADD TABLE framework_versions;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict read-open access for authenticated & anonymous clients;
-- write access strictly guarded for service roles and authenticated ingest workers.
-- ============================================================================

ALTER TABLE framework_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sporting_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monte_carlo_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE factual_post_mortem ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_upgrades ENABLE ROW LEVEL SECURITY;

-- framework_versions policies
CREATE POLICY "Allow public read access to framework_versions"
    ON framework_versions FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated service workers to manage framework_versions"
    ON framework_versions FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- sporting_events policies
CREATE POLICY "Allow public read access to sporting_events"
    ON sporting_events FOR SELECT
    USING (true);

CREATE POLICY "Allow service workers to insert and update sporting_events"
    ON sporting_events FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- monte_carlo_predictions policies
CREATE POLICY "Allow public read access to monte_carlo_predictions"
    ON monte_carlo_predictions FOR SELECT
    USING (true);

CREATE POLICY "Allow service workers to insert monte_carlo_predictions"
    ON monte_carlo_predictions FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- factual_post_mortem policies
CREATE POLICY "Allow public read access to factual_post_mortem"
    ON factual_post_mortem FOR SELECT
    USING (true);

CREATE POLICY "Allow service workers to insert factual_post_mortem"
    ON factual_post_mortem FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- autonomous_upgrades policies
CREATE POLICY "Allow public read access to autonomous_upgrades"
    ON autonomous_upgrades FOR SELECT
    USING (true);

CREATE POLICY "Allow service workers to inspect autonomous_upgrades"
    ON autonomous_upgrades FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================================
-- 11. ACTIVE MODEL FRAMEWORKS INITIALIZATION
-- Initializes the 4 sport quantitative frameworks in framework_versions.
-- Sporting events and Monte Carlo distributions are dynamically populated
-- by the autonomous 3-Tier Multi-Scraper pipeline (Tier 1 ESPN + Tier 2 Metrics + Tier 3 Open-Meteo).
-- ============================================================================

-- Framework versions for each sport
INSERT INTO framework_versions (id, sport, version_tag, description, parameters, ewma_alpha, learning_rate, is_active, cumulative_brier_score, evaluated_event_count)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'mlb', 'MLB-BASERUNS-FIP-v3.2', 'MLB Quantitative Engine based on BaseRuns offensive generation and Pitcher FIP splits.', '{"baseruns_weight": 0.58, "fip_pitcher_weight": 0.32, "bullpen_leverage_weight": 0.10, "park_factor_enabled": true, "variance_dampener": 0.98, "calibration_confidence": 0.82}'::jsonb, 0.0500, 0.0250, true, NULL, 0),
    ('a0000000-0000-0000-0000-000000000002', 'cfb', 'CFB-EPA-HAVOC-v4.1', 'College Football Model applying Expected Points Added (EPA/play) & Havoc Rate differentials.', '{"offense_epa_weight": 0.45, "defense_epa_weight": 0.35, "havoc_differential_weight": 0.15, "home_field_advantage_pts": 2.4, "variance_dampener": 0.95, "calibration_confidence": 0.79}'::jsonb, 0.0600, 0.0300, true, NULL, 0),
    ('a0000000-0000-0000-0000-000000000003', 'nfl', 'NFL-EPA-CPOE-v5.0', 'NFL Vectorized Simulator based on QB CPOE and Success Rate differentials.', '{"pass_epa_weight": 0.40, "rush_epa_weight": 0.20, "qb_cpoe_weight": 0.25, "red_zone_success_weight": 0.15, "variance_dampener": 1.00, "calibration_confidence": 0.86}'::jsonb, 0.0450, 0.0200, true, NULL, 0),
    ('a0000000-0000-0000-0000-000000000004', 'tennis', 'TENNIS-SURFACE-ELO-v2.8', 'Tennis Matchup Engine utilizing surface-specific dynamic Elo and return-point win rates.', '{"surface_elo_weight": 0.65, "serve_dominance_weight": 0.20, "fatigue_decay_rate": 0.15, "surface_k_factor": 32, "variance_dampener": 0.96, "calibration_confidence": 0.88}'::jsonb, 0.0500, 0.0250, true, NULL, 0)
ON CONFLICT (id) DO UPDATE SET
    version_tag = EXCLUDED.version_tag,
    parameters = EXCLUDED.parameters,
    cumulative_brier_score = EXCLUDED.cumulative_brier_score;

-- End of BATCH 1: Supabase Database Infrastructure
`;
