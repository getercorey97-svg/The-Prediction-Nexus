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
  VegasComparisonRecord,
  WindowHydrationProgress,
} from '../types/database';
import {
  INITIAL_FRAMEWORKS,
  INITIAL_EVENTS,
  INITIAL_PREDICTIONS,
  INITIAL_POST_MORTEMS,
  INITIAL_UPGRADES,
} from '../data/seedData';
import { runVectorizedMonteCarlo } from './simulationEngine';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import {
  HISTORICAL_CALIBRATION_WINDOWS,
  fetchProgressiveWindowSlate,
  scrapeLiveSlateFromBrowser,
  upsertEventsToSupabase,
} from './browserScraper';
import {
  executeWalkForwardCalibration,
  CalibrationRunResult,
} from './calibrationEngine';

type Listener = () => void;

class NexusDatabaseStore {
  private frameworks: FrameworkVersion[] = JSON.parse(JSON.stringify(INITIAL_FRAMEWORKS));
  private events: SportingEvent[] = JSON.parse(JSON.stringify(INITIAL_EVENTS));
  private predictions: MonteCarloPrediction[] = JSON.parse(JSON.stringify(INITIAL_PREDICTIONS));
  private postMortems: FactualPostMortem[] = JSON.parse(JSON.stringify(INITIAL_POST_MORTEMS));
  private upgrades: AutonomousUpgrade[] = JSON.parse(JSON.stringify(INITIAL_UPGRADES));
  private vegasLedger: VegasComparisonRecord[] = [];
  private calibrationSummary: any = null;
  private realtimeLogs: RealtimeMessage[] = [];
  private listeners: Set<Listener> = new Set();
  private isLoadingLive: boolean = false;
  private lastHydrationError: string | null = null;

  private hydrationProgress: WindowHydrationProgress = {
    currentWindowIndex: 0,
    totalWindows: HISTORICAL_CALIBRATION_WINDOWS.length,
    currentWindowName: 'Initializing 60-Day Empirical Pipeline',
    eventsLoaded: 0,
    completedEvents: 0,
    activeEvents: 0,
    status: 'idle',
    progressPercent: 0,
  };

  constructor() {
    this.addRealtimeLog('system', 'INSERT', 'The Prediction Nexus Initialized: 60-Day Walk-Forward Pipeline Active.');
    // Start automatic progressive 7-window hydration on startup
    this.startProgressiveHydration();
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

  public getActiveEvents(): SportingEvent[] {
    return this.events.filter((e) => e.status === 'scheduled' || e.status === 'in_progress');
  }

  public getCompletedEvents(): SportingEvent[] {
    return this.events.filter((e) => e.status === 'completed');
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

  public getVegasLedger(): VegasComparisonRecord[] {
    return [...this.vegasLedger];
  }

  public getCalibrationSummary(): any {
    return this.calibrationSummary;
  }

  public getHydrationProgress(): WindowHydrationProgress {
    return { ...this.hydrationProgress };
  }

  public getRealtimeLogs(): RealtimeMessage[] {
    return [...this.realtimeLogs];
  }

  public isLiveLoading(): boolean {
    return this.isLoadingLive;
  }

  public getHydrationError(): string | null {
    return this.lastHydrationError;
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

  /**
   * Automatic progressive 7-window hydration and chronological walk-forward calibration.
   */
  public async startProgressiveHydration() {
    if (this.isLoadingLive) return;
    this.isLoadingLive = true;
    this.lastHydrationError = null;

    this.hydrationProgress = {
      currentWindowIndex: 0,
      totalWindows: HISTORICAL_CALIBRATION_WINDOWS.length,
      currentWindowName: 'Querying Supabase Cache & Checking Endpoints...',
      eventsLoaded: this.events.length,
      completedEvents: this.getCompletedEvents().length,
      activeEvents: this.getActiveEvents().length,
      status: 'hydrating',
      progressPercent: 5,
    };
    this.notify();

    try {
      // 1. First probe Supabase for cached sporting events
      if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
          try {
            const { data: cachedDbEvents, error } = await client
              .from('sporting_events')
              .select('*')
              .order('event_date', { ascending: true })
              .limit(800);

            if (!error && Array.isArray(cachedDbEvents) && cachedDbEvents.length > 0) {
              this.mergeEvents(cachedDbEvents);
              this.recalibrateModels();
              this.addRealtimeLog('sporting_events', 'INSERT', `Restored ${cachedDbEvents.length} cached events from Supabase.`);
            }
          } catch (dbErr) {
            console.warn('[NexusStore] Supabase initial query non-fatal warning:', dbErr);
          }
        }
      }

      // 2. Iterate sequentially through all 7 windows to load real empirical data
      for (let i = 0; i < HISTORICAL_CALIBRATION_WINDOWS.length; i++) {
        const win = HISTORICAL_CALIBRATION_WINDOWS[i];
        this.hydrationProgress.currentWindowIndex = i + 1;
        this.hydrationProgress.currentWindowName = win.title;
        this.hydrationProgress.progressPercent = Math.round(((i + 1) / HISTORICAL_CALIBRATION_WINDOWS.length) * 100);
        this.notify();

        try {
          const windowEvents = await fetchProgressiveWindowSlate(win);
          if (windowEvents.length > 0) {
            this.mergeEvents(windowEvents);
            this.recalibrateModels();

            // Run 50,003 Monte Carlo simulations for active/upcoming games
            if (win.isForwardLooking) {
              this.simulateActiveEvents();
            }

            // Asynchronously upsert to Supabase
            upsertEventsToSupabase(windowEvents).catch(() => {});

            this.addRealtimeLog(
              'sporting_events',
              'INSERT',
              `Hydrated Window #${win.id} (${win.title}): +${windowEvents.length} fixtures.`
            );
          }
        } catch (winErr) {
          console.warn(`[NexusStore] Window ${win.id} load error:`, winErr);
        }

        // Brief yield to keep UI responsive
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      // If active events are low, perform direct client-side live scraper fallback
      if (this.getActiveEvents().length < 5) {
        try {
          const liveSlate = await scrapeLiveSlateFromBrowser();
          if (liveSlate.length > 0) {
            this.mergeEvents(liveSlate);
            this.recalibrateModels();
            this.simulateActiveEvents();
            upsertEventsToSupabase(liveSlate).catch(() => {});
          }
        } catch (e) {
          // Non-fatal
        }
      }

      this.hydrationProgress.status = 'completed';
      this.hydrationProgress.progressPercent = 100;
      this.hydrationProgress.currentWindowName = '60-Day Calibration & Forward-Looking Slate Hydrated';
      this.addRealtimeLog('system', 'UPDATE', `Empirical calibration complete: ${this.events.length} total fixtures loaded.`);
    } catch (err: any) {
      console.error('[NexusStore] Progressive hydration error:', err);
      this.lastHydrationError = err.message || 'Error occurred during progressive hydration';
      this.hydrationProgress.status = 'error';
    } finally {
      this.isLoadingLive = false;
      this.notify();
    }
  }

  /**
   * Recalibrates all quantitative frameworks chronologically across all completed events
   */
  private recalibrateModels() {
    const calibrationResult: CalibrationRunResult = executeWalkForwardCalibration(
      this.events,
      INITIAL_FRAMEWORKS
    );

    this.frameworks = calibrationResult.calibratedFrameworks;
    this.postMortems = calibrationResult.postMortems;
    this.upgrades = calibrationResult.upgrades;
    this.vegasLedger = calibrationResult.vegasComparisonLedger;
    this.calibrationSummary = {
      summaryBySport: calibrationResult.summaryBySport,
      totalEvaluated: calibrationResult.totalEvaluated,
      overallModelBrier: calibrationResult.overallModelBrier,
      overallBenchmarkBrier: calibrationResult.overallBenchmarkBrier,
    };

    this.hydrationProgress.eventsLoaded = this.events.length;
    this.hydrationProgress.completedEvents = this.getCompletedEvents().length;
    this.hydrationProgress.activeEvents = this.getActiveEvents().length;
    this.notify();
  }

  /**
   * Runs vectorized 50,003-run Monte Carlo simulations for active & upcoming matches
   */
  private simulateActiveEvents() {
    const active = this.getActiveEvents();
    const newPredictions: MonteCarloPrediction[] = [];

    for (const ev of active) {
      const fw = this.frameworks.find((f) => f.sport === ev.sport) || this.frameworks[0];

      try {
        const simRes = runVectorizedMonteCarlo({
          eventId: ev.id,
          sport: ev.sport,
          homeParticipant: ev.home_participant,
          awayParticipant: ev.away_participant,
          surface: ev.surface || 'Hard',
          modelParams: fw.parameters,
          marketOdds: ev.market_odds,
        });

        newPredictions.push({
          id: `pred_${ev.id}`,
          event_id: ev.id,
          framework_id: fw.id,
          simulation_iterations: 50003,
          home_win_probability: simRes.homeWinProbability,
          away_win_probability: simRes.awayWinProbability,
          predicted_home_spread: simRes.predictedHomeSpread,
          predicted_total_score: simRes.predictedTotalScore,
          p05_score_diff: simRes.p05ScoreDiff,
          p95_score_diff: simRes.p95ScoreDiff,
          p05_total_score: simRes.p05TotalScore,
          p95_total_score: simRes.p95TotalScore,
          market_implied_home_prob: simRes.marketImpliedHomeProb,
          edge_detected: simRes.edgeDetected,
          kelly_criterion_fraction: simRes.kellyCriterionFraction,
          distribution_histogram: simRes.histogram,
          market_odds: ev.market_odds || {},
          simulated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn(`[NexusStore] Simulation exception for ${ev.id}:`, err);
      }
    }

    // Merge predictions
    const predMap = new Map<string, MonteCarloPrediction>();
    this.predictions.forEach((p) => predMap.set(p.event_id, p));
    newPredictions.forEach((p) => predMap.set(p.event_id, p));
    this.predictions = Array.from(predMap.values());
  }

  /**
   * Merges a batch of events with deduplication on external_id
   */
  private mergeEvents(newEvents: SportingEvent[]) {
    const map = new Map<string, SportingEvent>();
    this.events.forEach((e) => map.set(e.external_id, e));

    for (const ev of newEvents) {
      const existing = map.get(ev.external_id);
      if (existing) {
        map.set(ev.external_id, {
          ...existing,
          ...ev,
          // Preserve any higher-fidelity odds or metadata
          market_odds: ev.market_odds || existing.market_odds,
          official_metadata: {
            ...existing.official_metadata,
            ...ev.official_metadata,
          },
          updated_at: new Date().toISOString(),
        });
      } else {
        map.set(ev.external_id, ev);
      }
    }

    this.events = Array.from(map.values()).sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
  }

  /**
   * Manually re-syncs the entire 60-day historical and forward-looking pipeline
   */
  public async syncAll60Days(): Promise<void> {
    await this.startProgressiveHydration();
  }

  /**
   * Instant live slate refresh for active/today's games
   */
  public async refreshLiveIngestion(sport: string = 'all'): Promise<void> {
    this.isLoadingLive = true;
    this.notify();

    try {
      const liveEvents = await scrapeLiveSlateFromBrowser();
      if (liveEvents.length > 0) {
        this.mergeEvents(liveEvents);
        this.recalibrateModels();
        this.simulateActiveEvents();
        upsertEventsToSupabase(liveEvents).catch(() => {});
        this.addRealtimeLog('sporting_events', 'INSERT', `Scraped ${liveEvents.length} live matches directly from browser.`);
      }
    } catch (err: any) {
      console.warn('[NexusStore] Browser scrape error:', err);
      this.lastHydrationError = err.message || 'Live fetch failed';
    } finally {
      this.isLoadingLive = false;
      this.notify();
    }
  }

  public getPredictionForEvent(eventId: string): MonteCarloPrediction | undefined {
    return this.predictions.find((p) => p.event_id === eventId);
  }

  public getPostMortemForEvent(eventId: string): FactualPostMortem | undefined {
    return this.postMortems.find((pm) => pm.event_id === eventId);
  }
}

export const nexusStore = new NexusDatabaseStore();
