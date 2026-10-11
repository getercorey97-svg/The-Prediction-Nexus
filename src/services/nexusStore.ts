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
  RealtimeMessage,
  UpgradeActionType,
} from '../types/database';
import {
  INITIAL_FRAMEWORKS,
  INITIAL_EVENTS,
  INITIAL_PREDICTIONS,
  INITIAL_POST_MORTEMS,
  INITIAL_UPGRADES,
} from '../data/seedData';
import { fetchLiveEventsApi, triggerLiveIngestApi, runSimulationApi, API_BASE_URL } from './apiConfig';
import { runVectorizedMonteCarlo } from './simulationEngine';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { scrapeLiveSlateFromBrowser, upsertEventsToSupabase } from './browserScraper';

type Listener = () => void;

class NexusDatabaseStore {
  private frameworks: FrameworkVersion[] = JSON.parse(JSON.stringify(INITIAL_FRAMEWORKS));
  private events: SportingEvent[] = JSON.parse(JSON.stringify(INITIAL_EVENTS));
  private predictions: MonteCarloPrediction[] = JSON.parse(JSON.stringify(INITIAL_PREDICTIONS));
  private postMortems: FactualPostMortem[] = JSON.parse(JSON.stringify(INITIAL_POST_MORTEMS));
  private upgrades: AutonomousUpgrade[] = JSON.parse(JSON.stringify(INITIAL_UPGRADES));
  private realtimeLogs: RealtimeMessage[] = [];
  private listeners: Set<Listener> = new Set();
  private isLoadingLive: boolean = false;
  private lastHydrationError: string | null = null;

  constructor() {
    this.addRealtimeLog('system', 'INSERT', 'Nexus database initialized. Connecting to 3-Tier Live Multi-Scraper...');
    // Initial live hydration with automatic browser fallback
    this.refreshLiveIngestion('all');
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public getFrameworks(): FrameworkVersion[] {
    return [...this.frameworks];
  }

  public getEvents(): SportingEvent[] {
    return [...this.events];
  }

  public getPredictions(): MonteCarloPrediction[] {
    return [...this.predictions];
  }

  public getPostMortems(): FactualPostMortem[] {
    return [...this.postMortems];
  }

  public getUpgrades(): AutonomousUpgrade[] {
    return [...this.upgrades];
  }

  public getRealtimeLogs(): RealtimeMessage[] {
    return [...this.realtimeLogs];
  }

  public isLiveLoading(): boolean {
    return this.isLoadingLive;
  }

  public addRealtimeLog(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', summary: string) {
    const log: RealtimeMessage = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      table,
      eventType,
      summary,
    };
    this.realtimeLogs.unshift(log);
    if (this.realtimeLogs.length > 50) {
      this.realtimeLogs.pop();
    }
  }

  public getHydrationError(): string | null {
    return this.lastHydrationError;
  }

  public clearHydrationError(): void {
    this.lastHydrationError = null;
    this.notify();
  }

  /**
   * Directly ingests sporting events into local store state,
   * performs deduplicated non-destructive merge, and runs 50,003 Monte Carlo
   * simulations for newly added events.
   */
  public ingestEvents(rawEvents: any[]): number {
    let count = 0;
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return 0;
    }

    for (const raw of rawEvents) {
      const extId = raw.external_id || `ev_${raw.id || Math.random().toString(36).substring(2, 9)}`;
      const existingIdx = this.events.findIndex(
        (e) => e.external_id === extId || (raw.id && e.id === raw.id)
      );

      const normalizedEvent: SportingEvent = {
        id: existingIdx !== -1 ? this.events[existingIdx].id : (raw.id || `ev_${extId}`),
        sport: (raw.sport || 'tennis').toLowerCase(),
        external_id: extId,
        event_date: raw.event_date || new Date().toISOString(),
        home_participant: raw.home_participant || 'TBD',
        away_participant: raw.away_participant || 'TBD',
        surface: raw.surface || null,
        venue: raw.venue || 'Stadium / Court',
        status: raw.status || 'scheduled',
        home_score: raw.home_score != null && !isNaN(Number(raw.home_score)) ? Number(raw.home_score) : null,
        away_score: raw.away_score != null && !isNaN(Number(raw.away_score)) ? Number(raw.away_score) : null,
        actual_winner: raw.actual_winner ?? null,
        official_metadata: raw.official_metadata || {},
        created_at: raw.created_at || new Date().toISOString(),
        updated_at: raw.updated_at || new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        this.events[existingIdx] = {
          ...this.events[existingIdx],
          ...normalizedEvent,
          status: this.events[existingIdx].status === 'completed' ? 'completed' : normalizedEvent.status,
        };
      } else {
        this.events.push(normalizedEvent);
      }
      count++;

      // Ensure Monte Carlo prediction exists for this event
      this.ensurePredictionForEvent(normalizedEvent, raw.market_odds, raw.model_params);
    }

    this.notify();
    return count;
  }

  /**
   * Fetches live sporting fixtures from the 3-Tier Multi-Scraper via FastAPI gateway
   * or directly from Supabase, enriching with Monte Carlo simulations.
   */
  public async fetchLiveSlate(sport?: string): Promise<void> {
    await this.refreshLiveIngestion(sport || 'all');
  }

  /**
   * Generates or attaches a 50,003 Monte Carlo prediction for a sporting event.
   */
  public ensurePredictionForEvent(
    event: SportingEvent,
    marketOdds?: Record<string, any>,
    modelParams?: Record<string, any>
  ): MonteCarloPrediction {
    const existing = this.predictions.find((p) => p.event_id === event.id);
    if (existing) {
      return existing;
    }

    const framework = this.frameworks.find((f) => f.sport === event.sport) || this.frameworks[0];
    const odds = marketOdds || { bookmaker: 'Consensus', home_moneyline: -110, away_moneyline: -110, total_line: 8.5 };

    // Run client vectorized 50,003 simulation
    const simResult = runVectorizedMonteCarlo({
      eventId: event.id,
      sport: event.sport,
      homeParticipant: event.home_participant,
      awayParticipant: event.away_participant,
      surface: event.surface || undefined,
      modelParams: modelParams || (event.official_metadata as any)?.environmental ? { weather: (event.official_metadata as any)?.environmental } : {},
      marketOdds: odds,
    });

    const predictionId = `pred_${event.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const prediction: MonteCarloPrediction = {
      id: predictionId,
      event_id: event.id,
      framework_id: framework.id,
      simulation_iterations: 50003,
      home_win_probability: simResult.homeWinProbability,
      away_win_probability: simResult.awayWinProbability,
      predicted_home_spread: simResult.predictedHomeSpread,
      predicted_total_score: simResult.predictedTotalScore,
      p05_score_diff: simResult.p05ScoreDiff,
      p95_score_diff: simResult.p95ScoreDiff,
      market_implied_home_prob: simResult.marketImpliedHomeProb,
      edge_detected: simResult.edgeDetected,
      kelly_criterion_fraction: simResult.kellyCriterionFraction,
      distribution_histogram: simResult.histogram,
      market_odds: odds,
      created_at: new Date().toISOString(),
    };

    this.predictions.unshift(prediction);
    return prediction;
  }

  /**
   * Refreshes the live sporting slate with dual HTTP Serverless request and
   * instant browser direct fallback:
   * 1. Sends direct POST to /api/ingest/all (or /api/ingest/{sport}) with 8s timeout.
   * 2. If endpoint fails or times out (>8s), instantly queries ESPN public scoreboards directly from browser.
   * 3. Upserts parsed matches directly into Supabase and updates store state immediately so badges update from 0.
   * 4. Clears loading spinner lock on error or completion.
   */
  public async refreshLiveIngestion(
    sport: string = 'all'
  ): Promise<{ success: boolean; count: number; source: string; error?: string | null }> {
    this.isLoadingLive = true;
    this.lastHydrationError = null;
    this.notify();

    try {
      this.addRealtimeLog('system', 'UPDATE', `Triggered 3-Tier Multi-Scraper pipeline refresh for: ${sport.toUpperCase()}`);

      // Attempt 1: Direct HTTP request to Serverless Ingest endpoint with 8s timeout
      let apiEvents: any[] = [];
      let apiSucceeded = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const endpoint = sport === 'all' ? '/api/ingest/all' : `/api/ingest/${sport.toLowerCase()}`;
        const url = `${API_BASE_URL}${endpoint}`;

        const res = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.events) && json.events.length > 0) {
            apiEvents = json.events;
            apiSucceeded = true;
          } else if (json.ingested_count > 0) {
            const fetched = await fetchLiveEventsApi(sport === 'all' ? undefined : sport);
            if (fetched && fetched.length > 0) {
              apiEvents = fetched;
              apiSucceeded = true;
            }
          }
        }
      } catch (err: any) {
        console.warn('[NexusStore] Serverless /api/ingest failed or timed out (>8s):', err?.message || err);
      }

      if (apiSucceeded && apiEvents.length > 0) {
        const count = this.ingestEvents(apiEvents);
        this.addRealtimeLog(
          'sporting_events',
          'INSERT',
          `Hydrated ${count} live sporting events from Vercel Serverless API.`
        );
        return { success: true, count, source: 'serverless_api' };
      }

      // Attempt 2: Instant Client-Side Direct Scraper Fallback (ESPN Public Scoreboards)
      this.addRealtimeLog(
        'system',
        'UPDATE',
        'Triggering client-side direct scraper fallback via ESPN scoreboards...'
      );
      const browserEvents = await scrapeLiveSlateFromBrowser();

      if (browserEvents.length > 0) {
        // Upsert directly into Supabase (non-blocking)
        await upsertEventsToSupabase(browserEvents);

        // Update local store state immediately so badges update from 0
        const count = this.ingestEvents(browserEvents);
        this.addRealtimeLog(
          'sporting_events',
          'INSERT',
          `Hydrated ${count} live sporting fixtures directly via ESPN browser fallback.`
        );
        return { success: true, count, source: 'browser_fallback' };
      }

      // Attempt 3: Restore any existing records from Supabase
      if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('sporting_events')
            .select('*')
            .order('event_date', { ascending: true });
          if (!error && data && data.length > 0) {
            const count = this.ingestEvents(data);
            this.addRealtimeLog(
              'sporting_events',
              'INSERT',
              `Restored ${count} sporting fixtures from Supabase cache.`
            );
            return { success: true, count, source: 'supabase_cache' };
          }
        }
      }

      this.lastHydrationError = 'Live slate query completed with 0 fixtures. Showing existing stored events.';
      return { success: false, count: 0, source: 'none', error: this.lastHydrationError };
    } catch (err: any) {
      console.error('[NexusStore] Failed to hydrate live events:', err);
      this.lastHydrationError = err?.message || 'Ingestion encountered an unexpected issue.';
      return { success: false, count: 0, source: 'error', error: this.lastHydrationError };
    } finally {
      this.isLoadingLive = false;
      this.notify();
    }
  }

  /**
   * Completes an event with official scores and triggers post-mortem Brier evaluation.
   */
  public completeEventWithScores(
    eventId: string,
    homeScore: number,
    awayScore: number
  ): { postMortem: FactualPostMortem | null; upgrade: AutonomousUpgrade | null } {
    const eventIndex = this.events.findIndex((e) => e.id === eventId);
    if (eventIndex === -1) {
      throw new Error(`Event with ID ${eventId} not found.`);
    }

    const event = this.events[eventIndex];
    if (event.status === 'completed') {
      throw new Error(`Event ${event.external_id} is already completed. Factual post-mortem mandate prohibits re-simulating finished events.`);
    }

    // Determine empirical winner & numeric outcome
    const actualMargin = homeScore - awayScore;
    const actualTotal = homeScore + awayScore;
    let actualHomeOutcome = 0.5;
    let actualWinner = 'Tie / Push';

    if (homeScore > awayScore) {
      actualHomeOutcome = 1.0;
      actualWinner = event.home_participant;
    } else if (homeScore < awayScore) {
      actualHomeOutcome = 0.0;
      actualWinner = event.away_participant;
    }

    // Step 1: Update event record
    const updatedEvent: SportingEvent = {
      ...event,
      status: 'completed',
      home_score: homeScore,
      away_score: awayScore,
      actual_winner: actualWinner,
      updated_at: new Date().toISOString(),
    };
    this.events[eventIndex] = updatedEvent;
    this.addRealtimeLog(
      'sporting_events',
      'UPDATE',
      `Match finished: ${event.home_participant} ${homeScore} vs ${event.away_participant} ${awayScore}. Winner: ${actualWinner}.`
    );

    // Step 2: Trigger post-mortem Brier evaluation
    let prediction = this.predictions.find((p) => p.event_id === eventId);
    if (!prediction) {
      prediction = this.ensurePredictionForEvent(updatedEvent);
    }

    const frameworkIndex = this.frameworks.findIndex((f) => f.id === prediction!.framework_id);
    const framework = frameworkIndex !== -1 ? this.frameworks[frameworkIndex] : null;

    // Calculate Brier Score: (f_t - o_t)^2
    const brierScore = Number(Math.pow(prediction.home_win_probability - actualHomeOutcome, 2).toFixed(6));
    const spreadError = Number(Math.abs(actualMargin - prediction.predicted_home_spread).toFixed(2));
    const totalError = Number(Math.abs(actualTotal - prediction.predicted_total_score).toFixed(2));
    const withinInterval = actualMargin >= prediction.p05_score_diff && actualMargin <= prediction.p95_score_diff;

    const baseline = framework?.cumulative_brier_score ?? 0.25;
    const calibrationDelta = Number((brierScore - baseline).toFixed(6));

    const empiricalNotes = `Empirical Outcome: ${event.home_participant} ${homeScore}, ${event.away_participant} ${awayScore}. Margin: ${actualMargin > 0 ? '+' : ''}${actualMargin} (pred: ${prediction.predicted_home_spread > 0 ? '+' : ''}${prediction.predicted_home_spread}). Total: ${actualTotal} (pred: ${prediction.predicted_total_score}). Brier Score: ${brierScore} (baseline delta: ${calibrationDelta > 0 ? '+' : ''}${calibrationDelta}). 90% MC Interval: [${prediction.p05_score_diff}, ${prediction.p95_score_diff}] -> ${withinInterval ? 'CAPTURED' : 'OUTLIER'}.`;

    const postMortemId = `d${Math.random().toString(36).substring(2, 10)}${Date.now()}`.padEnd(36, '0').substring(0, 36);
    const newPostMortem: FactualPostMortem = {
      id: postMortemId,
      event_id: event.id,
      prediction_id: prediction.id,
      framework_id: prediction.framework_id,
      predicted_home_win_prob: prediction.home_win_probability,
      actual_home_outcome: actualHomeOutcome,
      brier_score: brierScore,
      actual_margin: actualMargin,
      actual_total: actualTotal,
      spread_absolute_error: spreadError,
      total_absolute_error: totalError,
      calibration_delta: calibrationDelta,
      within_p05_p95_interval: withinInterval,
      empirical_notes: empiricalNotes,
      evaluated_at: new Date().toISOString(),
    };

    this.postMortems.unshift(newPostMortem);
    this.addRealtimeLog(
      'factual_post_mortem',
      'INSERT',
      `Brier Score evaluated: ${brierScore} for ${event.external_id} (${withinInterval ? 'within MC interval' : 'interval outlier'}).`
    );

    // Step 3: Trigger autonomous EWMA calibration
    let newUpgrade: AutonomousUpgrade | null = null;

    if (framework && frameworkIndex !== -1) {
      const alpha = framework.ewma_alpha;
      const lr = framework.learning_rate;
      const prevWeights = { ...framework.parameters };
      const adjustedWeights = { ...framework.parameters };

      const prevCumulative = framework.cumulative_brier_score ?? 0.25;
      const newCumulativeBrier = Number((alpha * brierScore + (1.0 - alpha) * prevCumulative).toFixed(6));
      const brierDelta = Number((brierScore - prevCumulative).toFixed(6));

      let actionType: UpgradeActionType = 'ewma_reweight';
      let calibrationNotes = '';

      if (brierScore <= 0.1) {
        actionType = 'ewma_reweight';
        const currentConf = Number(prevWeights.calibration_confidence ?? 0.8);
        adjustedWeights.calibration_confidence = Number(Math.min(1.0, currentConf + lr * 0.5).toFixed(4));
        calibrationNotes = `Empirical validation confirmed. Low Brier score of ${brierScore} reinforced framework parameter confidence by +${(lr * 0.5).toFixed(4)}.`;
      } else if (brierScore > 0.45) {
        actionType = 'drift_penalty';
        const currentDampener = Number(prevWeights.variance_dampener ?? 1.0);
        adjustedWeights.variance_dampener = Number(Math.max(0.1, currentDampener - lr * 1.2).toFixed(4));
        calibrationNotes = `Empirical outlier detected. Elevated Brier score of ${brierScore} triggered drift penalty: variance dampener reduced by ${(lr * 1.2).toFixed(4)}.`;
      } else {
        actionType = 'ewma_reweight';
        adjustedWeights.last_ewma_step = Number((brierDelta * lr).toFixed(6));
        calibrationNotes = `Nominal post-mortem calibration. Applied EWMA step of ${(brierDelta * lr).toFixed(6)} against delta of ${brierDelta > 0 ? '+' : ''}${brierDelta}.`;
      }

      this.frameworks[frameworkIndex] = {
        ...framework,
        cumulative_brier_score: newCumulativeBrier,
        evaluated_event_count: framework.evaluated_event_count + 1,
        parameters: adjustedWeights,
        updated_at: new Date().toISOString(),
      };

      const upgradeId = `e${Math.random().toString(36).substring(2, 10)}${Date.now()}`.padEnd(36, '0').substring(0, 36);
      newUpgrade = {
        id: upgradeId,
        framework_id: framework.id,
        post_mortem_id: newPostMortem.id,
        action_type: actionType,
        previous_weights: prevWeights,
        adjusted_weights: adjustedWeights,
        brier_delta: brierDelta,
        applied_ewma_step: alpha,
        calibration_notes: calibrationNotes,
        created_at: new Date().toISOString(),
      };

      this.upgrades.unshift(newUpgrade);
      this.addRealtimeLog(
        'autonomous_upgrades',
        'INSERT',
        `Autonomous EWMA upgrade executed for ${framework.version_tag} (${actionType}): cumulative Brier adjusted to ${newCumulativeBrier}.`
      );
    }

    this.notify();
    return { postMortem: newPostMortem, upgrade: newUpgrade };
  }

  public resetToSeed() {
    this.frameworks = JSON.parse(JSON.stringify(INITIAL_FRAMEWORKS));
    this.events = [];
    this.predictions = [];
    this.postMortems = [];
    this.upgrades = [];
    this.realtimeLogs = [];
    this.addRealtimeLog('system', 'UPDATE', 'Nexus database state reset. Refetching live slate...');
    this.fetchLiveSlate();
  }
}

export const nexusStore = new NexusDatabaseStore();
