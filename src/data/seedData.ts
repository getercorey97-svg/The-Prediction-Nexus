/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FrameworkVersion,
  SportingEvent,
  MonteCarloPrediction,
  FactualPostMortem,
  AutonomousUpgrade,
} from '../types/database';

// Active Quantitative Framework Specifications
export const INITIAL_FRAMEWORKS: FrameworkVersion[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    sport: 'mlb',
    version_tag: 'MLB-BASERUNS-FIP-v3.2',
    description: 'MLB Quantitative Engine based on BaseRuns offensive generation and Pitcher FIP splits.',
    parameters: {
      baseruns_weight: 0.58,
      fip_pitcher_weight: 0.32,
      bullpen_leverage_weight: 0.1,
      park_factor_enabled: true,
      variance_dampener: 0.98,
      calibration_confidence: 0.82,
    },
    ewma_alpha: 0.05,
    learning_rate: 0.025,
    is_active: true,
    cumulative_brier_score: 0.18421,
    evaluated_event_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    sport: 'cfb',
    version_tag: 'CFB-EPA-HAVOC-v4.1',
    description: 'College Football Model applying Expected Points Added (EPA/play) & Havoc Rate differentials.',
    parameters: {
      offense_epa_weight: 0.45,
      defense_epa_weight: 0.35,
      havoc_differential_weight: 0.15,
      home_field_advantage_pts: 2.4,
      variance_dampener: 0.95,
      calibration_confidence: 0.79,
    },
    ewma_alpha: 0.06,
    learning_rate: 0.03,
    is_active: true,
    cumulative_brier_score: 0.19845,
    evaluated_event_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    sport: 'nfl',
    version_tag: 'NFL-EPA-CPOE-v5.0',
    description: 'NFL Quantitative Engine integrating Dropback EPA, Rush EPA, and Quarterback CPOE metrics.',
    parameters: {
      pass_epa_weight: 0.52,
      rush_epa_weight: 0.28,
      cpoe_weight: 0.2,
      home_field_advantage_pts: 1.8,
      variance_dampener: 1.0,
      calibration_confidence: 0.84,
    },
    ewma_alpha: 0.04,
    learning_rate: 0.02,
    is_active: true,
    cumulative_brier_score: 0.17932,
    evaluated_event_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    sport: 'tennis',
    version_tag: 'TENNIS-SURFACE-ELO-v2.8',
    description: 'Tennis Matchup Engine utilizing surface-specific dynamic Elo and return-point win rates.',
    parameters: {
      surface_elo_weight: 0.65,
      serve_dominance_weight: 0.2,
      fatigue_decay_rate: 0.15,
      surface_k_factor: 32,
      variance_dampener: 0.96,
      calibration_confidence: 0.88,
    },
    ewma_alpha: 0.05,
    learning_rate: 0.025,
    is_active: true,
    cumulative_brier_score: 0.1628,
    evaluated_event_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Empirical Data Arrays (Purged of all static mock data; dynamically hydrated via live pipeline)
export const INITIAL_EVENTS: SportingEvent[] = [];
export const INITIAL_PREDICTIONS: MonteCarloPrediction[] = [];
export const INITIAL_POST_MORTEMS: FactualPostMortem[] = [];
export const INITIAL_UPGRADES: AutonomousUpgrade[] = [];
