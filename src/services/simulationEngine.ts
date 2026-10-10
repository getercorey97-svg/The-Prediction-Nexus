/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SimulationResult {
  eventId: string;
  sport: string;
  iterations: number;
  homeWinProbability: number;
  awayWinProbability: number;
  predictedHomeSpread: number;
  predictedTotalScore: number;
  p05ScoreDiff: number;
  p95ScoreDiff: number;
  p05TotalScore: number;
  p95TotalScore: number;
  marketImpliedHomeProb: number | null;
  edgeDetected: number | null;
  kellyCriterionFraction: number | null;
  executionDurationMs: number;
  histogram: { bucket: string; count: number; percentage: number }[];
}

/**
 * Simple deterministic 32-bit PRNG (Mulberry32) seeded from string hash.
 */
function createDeterministicRng(seedString: string) {
  let h = 0;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(31, h) + seedString.charCodeAt(i) | 0;
  }
  let s = h >>> 0;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard Normal Box-Muller transform
 */
function randomNormal(rng: () => number, mean = 0, std = 1): number {
  let u1 = rng();
  let u2 = rng();
  while (u1 === 0) u1 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * std + mean;
}

/**
 * Poisson random variate using Knuth's algorithm
 */
function randomPoisson(rng: () => number, lambda: number): number {
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= rng();
    } while (p > L);
    return k - 1;
  } else {
    return Math.max(0, Math.round(randomNormal(rng, lambda, Math.sqrt(lambda))));
  }
}

/**
 * Vectorized in-browser simulation executing exactly 50,003 iterations,
 * mirroring backend/engine/monte_carlo.py
 */
export function runClientMonteCarloSimulation(
  eventId: string,
  sport: string,
  homeParticipant: string,
  awayParticipant: string,
  homeRating: number,
  awayRating: number,
  marketHomeMoneyline: number | null = -115,
  surface: string = 'Clay'
): SimulationResult {
  const startTime = performance.now();
  const ITERATIONS = 50003;
  const rng = createDeterministicRng(eventId);

  const margins: number[] = new Float32Array(ITERATIONS) as any;
  const totals: number[] = new Float32Array(ITERATIONS) as any;

  let homeWins = 0;
  let ties = 0;
  const sportNorm = sport.toLowerCase().trim();

  for (let i = 0; i < ITERATIONS; i++) {
    let homeScore = 0;
    let awayScore = 0;

    if (sportNorm === 'mlb') {
      const lamHome = Math.max(1.5, homeRating * 1.02);
      const lamAway = Math.max(1.5, awayRating * 0.98);
      homeScore = randomPoisson(rng, lamHome);
      awayScore = randomPoisson(rng, lamAway);
      if (homeScore === awayScore) {
        if (rng() < 0.525) homeScore += 1;
        else awayScore += 1;
      }
    } else if (sportNorm === 'cfb') {
      const hfa = 2.4;
      const std = 15.2 * 0.95;
      const meanHome = 28.5 + homeRating * 18.0 + hfa / 2;
      const meanAway = 26.0 + awayRating * 18.0 - hfa / 2;
      homeScore = Math.max(0, Math.round(randomNormal(rng, meanHome, std)));
      awayScore = Math.max(0, Math.round(randomNormal(rng, meanAway, std)));
      if (homeScore === awayScore) {
        if (rng() < 0.51) homeScore += 3;
        else awayScore += 3;
      }
    } else if (sportNorm === 'nfl') {
      const std = 12.8;
      const meanHome = 23.5 + homeRating * 15.0 + 1.5;
      const meanAway = 21.0 + awayRating * 15.0 - 1.5;
      homeScore = Math.max(0, Math.round(randomNormal(rng, meanHome, std)));
      awayScore = Math.max(0, Math.round(randomNormal(rng, meanAway, std)));
      if (homeScore === awayScore) {
        if (rng() < 0.52) homeScore += 3;
        else awayScore += 3;
      }
    } else if (sportNorm === 'tennis') {
      const eloDelta = homeRating - awayRating;
      const p = 1.0 / (1.0 + Math.pow(10, -eloDelta / 400.0));
      const s1 = rng() < p;
      const s2 = rng() < p;
      let hSets = (s1 ? 1 : 0) + (s2 ? 1 : 0);
      let aSets = (s1 ? 0 : 1) + (s2 ? 0 : 1);
      if (hSets === 1 && aSets === 1) {
        if (rng() < p) hSets += 1;
        else aSets += 1;
      }
      homeScore = hSets;
      awayScore = aSets;
    } else {
      homeScore = Math.max(0, Math.round(randomNormal(rng, homeRating, 10)));
      awayScore = Math.max(0, Math.round(randomNormal(rng, awayRating, 10)));
    }

    const margin = homeScore - awayScore;
    const total = homeScore + awayScore;
    margins[i] = margin;
    totals[i] = total;

    if (margin > 0) homeWins++;
    else if (margin === 0) ties++;
  }

  const duration = performance.now() - startTime;
  const homeWinProb = (homeWins + 0.5 * ties) / ITERATIONS;
  const awayWinProb = 1.0 - homeWinProb;

  // Sort samples to compute exact percentiles
  // To avoid sorting entire 50,003 array on every tick, sort a 5,000 uniform sub-sample
  const sampleSize = 5000;
  const sampleMargins: number[] = [];
  const sampleTotals: number[] = [];
  const step = Math.floor(ITERATIONS / sampleSize);
  for (let i = 0; i < ITERATIONS; i += step) {
    sampleMargins.push(margins[i]);
    sampleTotals.push(totals[i]);
  }
  sampleMargins.sort((a, b) => a - b);
  sampleTotals.sort((a, b) => a - b);

  let sumMargin = 0;
  let sumTotal = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    sumMargin += margins[i];
    sumTotal += totals[i];
  }
  const meanSpread = Number((sumMargin / ITERATIONS).toFixed(2));
  const meanTotal = Number((sumTotal / ITERATIONS).toFixed(2));

  const p05Margin = Number(sampleMargins[Math.floor(sampleMargins.length * 0.05)].toFixed(2));
  const p95Margin = Number(sampleMargins[Math.floor(sampleMargins.length * 0.95)].toFixed(2));
  const p05Total = Number(sampleTotals[Math.floor(sampleTotals.length * 0.05)].toFixed(2));
  const p95Total = Number(sampleTotals[Math.floor(sampleTotals.length * 0.95)].toFixed(2));

  // Compute 7-bucket histogram of margins for visualization
  const minM = sampleMargins[0];
  const maxM = sampleMargins[sampleMargins.length - 1];
  const bucketWidth = (maxM - minM) / 7 || 1;
  const histogramBuckets = Array(7).fill(0);
  for (let i = 0; i < sampleMargins.length; i++) {
    const idx = Math.min(6, Math.max(0, Math.floor((sampleMargins[i] - minM) / bucketWidth)));
    histogramBuckets[idx]++;
  }

  const histogram = histogramBuckets.map((cnt, idx) => {
    const low = Math.round(minM + idx * bucketWidth);
    const high = Math.round(minM + (idx + 1) * bucketWidth);
    return {
      bucket: `${low > 0 ? '+' : ''}${low} to ${high > 0 ? '+' : ''}${high}`,
      count: cnt,
      percentage: Number(((cnt / sampleMargins.length) * 100).toFixed(1)),
    };
  });

  // Market edge & Kelly
  let marketImplied: number | null = null;
  let edge: number | null = null;
  let kelly: number | null = null;

  if (marketHomeMoneyline !== null) {
    if (marketHomeMoneyline < 0) {
      marketImplied = Math.abs(marketHomeMoneyline) / (Math.abs(marketHomeMoneyline) + 100);
    } else {
      marketImplied = 100 / (marketHomeMoneyline + 100);
    }
    marketImplied = Number(marketImplied.toFixed(4));
    edge = Number((homeWinProb - marketImplied).toFixed(4));

    const decimalOdds =
      marketHomeMoneyline < 0
        ? 1.0 + 100 / Math.abs(marketHomeMoneyline)
        : 1.0 + marketHomeMoneyline / 100;
    const b = decimalOdds - 1.0;
    if (b > 0 && edge > 0) {
      const k = (b * homeWinProb - (1.0 - homeWinProb)) / b;
      kelly = Number(Math.max(0, k * 0.25).toFixed(4));
    }
  }

  return {
    eventId,
    sport,
    iterations: ITERATIONS,
    homeWinProbability: Number(homeWinProb.toFixed(4)),
    awayWinProbability: Number(awayWinProb.toFixed(4)),
    predictedHomeSpread: meanSpread,
    predictedTotalScore: meanTotal,
    p05ScoreDiff: p05Margin,
    p95ScoreDiff: p95Margin,
    p05TotalScore: p05Total,
    p95TotalScore: p95Total,
    marketImpliedHomeProb: marketImplied,
    edgeDetected: edge,
    kellyCriterionFraction: kelly,
    executionDurationMs: Number(duration.toFixed(2)),
    histogram,
  };
}
