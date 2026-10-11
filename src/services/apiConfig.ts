/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dual-Environment configuration supporting both Vite (VITE_) and Next.js (NEXT_PUBLIC_) prefixes
const getEnvVar = (viteKey: string, nextKey: string, fallback: string): string => {
  const metaEnv = (import.meta as any).env || {};
  return metaEnv[viteKey] || metaEnv[nextKey] || fallback;
};

export const API_BASE_URL = getEnvVar(
  'VITE_API_URL',
  'NEXT_PUBLIC_API_URL',
  ''
).replace(/\/$/, '');

export const SUPABASE_URL = getEnvVar(
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'https://aywldwdvflwcanqxxdhi.supabase.co'
).replace(/\/$/, '');

export const SUPABASE_ANON_KEY = getEnvVar(
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5d2xkd2R2Zmx3Y2FucXh4ZGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0NTkyMDAsImV4cCI6MjA0NTAzNTIwMH0.placeholder'
);

export interface ApiSimulationPayload {
  event_id: string;
  sport: string;
  home_participant: string;
  away_participant: string;
  surface?: string | null;
  model_params?: Record<string, any>;
  market_odds?: Record<string, any> | null;
}

/**
 * Fetches the live sporting events slate directly from the FastAPI gateway.
 */
export async function fetchLiveEventsApi(sport?: string): Promise<any[]> {
  const url = sport ? `${API_BASE_URL}/api/events?sport=${sport}` : `${API_BASE_URL}/api/events`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[API] Failed to fetch events from ${url}:`, err);
  }
  return [];
}

/**
 * Triggers background or sync slate ingestion across the 3-Tier scraper pipeline.
 */
export async function triggerLiveIngestApi(sport: string = 'all'): Promise<any> {
  const path = sport === 'all' ? '/api/ingest/all' : `/api/ingest/${sport.toLowerCase()}`;
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[API] Ingest trigger failed for ${sport}:`, err);
  }
  return null;
}

/**
 * Triggers full 50,003 Monte Carlo simulation run via backend endpoint.
 */
export async function runSimulationApi(payload: ApiSimulationPayload): Promise<any> {
  const url = `${API_BASE_URL}/api/simulate`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[API] Simulation dispatch failed:', err);
  }
  return null;
}
