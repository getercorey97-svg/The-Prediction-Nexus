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

type Listener = () => void;

class NexusDatabaseStore {
  private frameworks: FrameworkVersion[] = JSON.parse(JSON.stringify(INITIAL_FRAMEWORKS));
  private events: SportingEvent[] = JSON.parse(JSON.stringify(INITIAL_EVENTS));
  private predictions: MonteCarloPrediction[] = JSON.parse(JSON.stringify(INITIAL_PREDICTIONS));
  private postMortems: FactualPostMortem[] = JSON.parse(JSON.stringify(INITIAL_POST_MORTEMS));
  private upgrades: AutonomousUpgrade[] = JSON.parse(JSON.stringify(INITIAL_UPGRADES));
  private realtimeLogs: RealtimeMessage[] = [];
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.addRealtimeLog('system', 'INSERT', 'Nexus database initialized with Batch 1 schema and verified historical seed records.');
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

  private addRealtimeLog(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', summary: string) {
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
   * Executes the exact PostgreSQL trigger sequence:
   * 1. trg_event_completed_post_mortem -> fn_evaluate_event_post_mortem()
   * 2. trg_post_mortem_autonomous_upgrade -> fn_trigger_autonomous_model_upgrade()
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

    // Step 1: Update event record (Simulates UPDATE sporting_events)
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

    // Step 2: Trigger fn_evaluate_event_post_mortem()
    const prediction = this.predictions.find((p) => p.event_id === eventId);
    if (!prediction) {
      this.notify();
      return { postMortem: null, upgrade: null };
    }

    const frameworkIndex = this.frameworks.findIndex((f) => f.id === prediction.framework_id);
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

    // Step 3: Trigger fn_trigger_autonomous_model_upgrade()
    let newUpgrade: AutonomousUpgrade | null = null;

    if (framework && frameworkIndex !== -1) {
      const alpha = framework.ewma_alpha;
      const lr = framework.learning_rate;
      const prevWeights = { ...framework.parameters };
      const adjustedWeights = { ...framework.parameters };

      // Rolling EWMA: B_new = alpha * B_match + (1 - alpha) * B_prev
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

      // Update framework
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
    this.events = JSON.parse(JSON.stringify(INITIAL_EVENTS));
    this.predictions = JSON.parse(JSON.stringify(INITIAL_PREDICTIONS));
    this.postMortems = JSON.parse(JSON.stringify(INITIAL_POST_MORTEMS));
    this.upgrades = JSON.parse(JSON.stringify(INITIAL_UPGRADES));
    this.realtimeLogs = [];
    this.addRealtimeLog('system', 'UPDATE', 'Nexus database state reset to initial verified empirical seed state.');
    this.notify();
  }
}

export const nexusStore = new NexusDatabaseStore();
