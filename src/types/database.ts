/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SportType = 'mlb' | 'cfb' | 'nfl' | 'tennis';

export type EventStatus = 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled';

export type UpgradeActionType = 'ewma_reweight' | 'variance_dampening' | 'drift_penalty' | 'baseline_reset';

export interface FrameworkVersion {
  id: string;
  sport: SportType;
  version_tag: string;
  description: string;
  parameters: Record<string, number | boolean | string>;
  ewma_alpha: number;
  learning_rate: number;
  is_active: boolean;
  cumulative_brier_score: number | null;
  evaluated_event_count: number;
  created_at: string;
  updated_at: string;
}

export interface SportingEvent {
  id: string;
  sport: SportType;
  external_id: string;
  event_date: string;
  home_participant: string;
  away_participant: string;
  surface: string | null;
  venue: string | null;
  status: EventStatus;
  home_score: number | null;
  away_score: number | null;
  actual_winner: string | null;
  market_odds?: Record<string, any>;
  official_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MonteCarloPrediction {
  id: string;
  event_id: string;
  framework_id: string;
  simulation_iterations: number; // Strictly 50003
  home_win_probability: number;
  away_win_probability: number;
  predicted_home_spread: number;
  predicted_total_score: number;
  p05_score_diff: number;
  p95_score_diff: number;
  p05_total_score?: number;
  p95_total_score?: number;
  market_implied_home_prob: number | null;
  market_implied_away_prob?: number | null;
  edge_detected?: number | null;
  kelly_criterion_fraction?: number | null;
  distribution_histogram?: { bucket: string; count: number; percentage: number }[];
  market_odds: {
    bookmaker?: string;
    spread_line?: number;
    home_moneyline?: number;
    away_moneyline?: number;
    total_line?: number;
    total_games_line?: number;
  };
  simulated_at?: string;
  created_at: string;
}

export interface FactualPostMortem {
  id: string;
  event_id: string;
  prediction_id: string;
  framework_id: string;
  predicted_home_win_prob: number;
  actual_home_outcome: number; // 1.0 = home win, 0.0 = away win, 0.5 = push
  brier_score: number; // (predicted_prob - actual_outcome)^2
  actual_margin: number;
  actual_total: number;
  spread_absolute_error: number;
  total_absolute_error: number;
  calibration_delta: number;
  within_p05_p95_interval: boolean;
  empirical_notes: string;
  evaluated_at: string;
}

export interface AutonomousUpgrade {
  id: string;
  framework_id: string;
  post_mortem_id: string;
  action_type: UpgradeActionType;
  previous_weights: Record<string, any>;
  adjusted_weights: Record<string, any>;
  brier_delta: number;
  applied_ewma_step: number;
  calibration_notes: string;
  created_at: string;
}

export interface RealtimeMessage {
  id: string;
  timestamp: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  summary: string;
}

export interface HistoricalWindowConfig {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  isForwardLooking?: boolean;
}

export interface WindowHydrationProgress {
  currentWindowIndex: number;
  totalWindows: number;
  currentWindowName: string;
  eventsLoaded: number;
  completedEvents: number;
  activeEvents: number;
  status: 'idle' | 'hydrating' | 'calibrating' | 'completed' | 'error';
  progressPercent: number;
}

export interface VegasComparisonRecord {
  eventId: string;
  sport: SportType;
  eventDate: string;
  homeParticipant: string;
  awayParticipant: string;
  homeScore: number | null;
  awayScore: number | null;
  actualWinner: string | null;
  modelHomeProb: number;
  modelAwayProb: number;
  benchmarkType: 'vegas_closing' | 'prior_record_baseline';
  benchmarkLabel: string;
  vegasImpliedHomeProb: number;
  actualOutcome: number; // 1.0 = home win, 0.0 = away win
  modelBrierScore: number;
  benchmarkBrierScore: number;
  brierAdvantage: number; // benchmarkBrierScore - modelBrierScore (>0 is model advantage)
  preMatchHomeRecord: { wins: number; losses: number };
  preMatchAwayRecord: { wins: number; losses: number };
  cumulativeModelBrier: number;
  cumulativeBenchmarkBrier: number;
}
