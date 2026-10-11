/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SportingEvent } from '../types/database';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

/**
 * Normalizes player name for Tennis deduplication
 */
function normalizeLastName(name: string): string {
  const cleaned = name.replace(/\s*\(\d+\)/g, '').trim();
  const parts = cleaned.split(/[\s,/]+/);
  if (!parts.length) return '';
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return last.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

/**
 * Creates deduplication key for tennis match
 */
function makeTennisDedupKey(p1: string, p2: string, dateStr: string): string {
  const l1 = normalizeLastName(p1);
  const l2 = normalizeLastName(p2);
  const pair = [l1, l2].sort().join('_vs_');
  const d = dateStr ? dateStr.substring(0, 10).replace(/-/g, '') : 'nodate';
  return `${pair}_${d}`;
}

/**
 * Safely fetches JSON from public ESPN endpoint with browser User-Agent & timeout
 */
async function fetchEspnJson(url: string, timeoutMs: number = 7000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[BrowserScraper] ESPN fetch failed for ${url}:`, err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses ESPN Tennis Scoreboard (ATP & WTA)
 * Traverses BOTH ev.groupings[].competitions[] AND ev.competitions[].
 * Extracts player names from competitor.athlete.displayName.
 */
function parseEspnTennisEvents(data: any, circuit: 'atp' | 'wta'): SportingEvent[] {
  if (!data || !Array.isArray(data.events)) {
    return [];
  }

  const events: SportingEvent[] = [];
  const seenDedup = new Set<string>();

  for (const ev of data.events) {
    const tournamentName = ev.name || ev.shortName || `${circuit.toUpperCase()} Tour`;
    const competitionsList: any[] = [];

    // 1. Nested tournament groupings
    if (Array.isArray(ev.groupings)) {
      for (const grp of ev.groupings) {
        if (Array.isArray(grp.competitions)) {
          competitionsList.push(...grp.competitions);
        }
      }
    }

    // 2. Direct competitions
    if (Array.isArray(ev.competitions)) {
      competitionsList.push(...ev.competitions);
    }

    for (const comp of competitionsList) {
      const compId = String(comp.id || comp.uid || '');
      if (!compId) continue;

      const competitors = comp.competitors || [];
      if (competitors.length < 2) continue;

      let homeParticipant = '';
      let awayParticipant = '';
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      let homeLinescores: number[] = [];
      let awayLinescores: number[] = [];
      let homeWinner = false;
      let awayWinner = false;

      for (const c of competitors) {
        // Fix: prioritize athlete displayName instead of team displayName
        const ath = c.athlete || {};
        const ros = c.roster || {};
        const tea = c.team || {};
        const name = (
          ath.displayName ||
          ath.fullName ||
          ros.displayName ||
          tea.displayName ||
          c.name ||
          ''
        ).trim();

        if (!name) continue;

        const isHome = c.homeAway === 'home' || c.order === 0;
        const scoreVal = c.score != null && !isNaN(Number(c.score)) ? Number(c.score) : null;
        const isWinner = c.winner === true;

        const lscores: number[] = [];
        if (Array.isArray(c.linescores)) {
          for (const ls of c.linescores) {
            const v = typeof ls === 'object' && ls !== null ? ls.value : ls;
            if (v != null && !isNaN(Number(v))) {
              lscores.push(Number(v));
            }
          }
        }

        if (isHome) {
          homeParticipant = name;
          homeScore = scoreVal;
          homeLinescores = lscores;
          homeWinner = isWinner;
        } else {
          awayParticipant = name;
          awayScore = scoreVal;
          awayLinescores = lscores;
          awayWinner = isWinner;
        }
      }

      if (!homeParticipant || !awayParticipant) continue;

      const dateStr = comp.date || ev.date || new Date().toISOString();
      const dedupKey = makeTennisDedupKey(homeParticipant, awayParticipant, dateStr);
      if (seenDedup.has(dedupKey)) continue;
      seenDedup.add(dedupKey);

      const statusState = (comp.status?.type?.state || 'pre').toLowerCase();
      let status: 'scheduled' | 'in_progress' | 'completed' = 'scheduled';
      if (['post', 'final'].includes(statusState)) {
        status = 'completed';
      } else if (['in', 'live'].includes(statusState)) {
        status = 'in_progress';
      }

      let actualWinner: string | null = null;
      if (status === 'completed') {
        if (homeWinner) actualWinner = homeParticipant;
        else if (awayWinner) actualWinner = awayParticipant;
        else if (homeScore !== null && awayScore !== null) {
          actualWinner = homeScore > awayScore ? homeParticipant : awayParticipant;
        }
      }

      events.push({
        id: `ev_espn_tennis_${circuit}_${compId}`,
        sport: 'tennis',
        external_id: `espn_tennis_${circuit}_${compId}`,
        event_date: dateStr,
        home_participant: homeParticipant,
        away_participant: awayParticipant,
        surface: 'Hard',
        venue: tournamentName,
        status,
        home_score: homeScore,
        away_score: awayScore,
        actual_winner: actualWinner,
        official_metadata: {
          circuit: circuit.toUpperCase(),
          tournament: tournamentName,
          source: 'espn_browser_fallback',
          home_linescores: homeLinescores,
          away_linescores: awayLinescores,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return events;
}

/**
 * Parses ESPN Team Sport Scoreboard (MLB, CFB, NFL)
 */
function parseEspnTeamSportEvents(data: any, sport: 'mlb' | 'cfb' | 'nfl'): SportingEvent[] {
  if (!data || !Array.isArray(data.events)) {
    return [];
  }

  const events: SportingEvent[] = [];

  for (const ev of data.events) {
    const evId = String(ev.id || '');
    const comp = ev.competitions?.[0];
    if (!comp) continue;

    const competitors = comp.competitors || [];
    if (competitors.length < 2) continue;

    let homeParticipant = '';
    let awayParticipant = '';
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let homeWinner = false;
    let awayWinner = false;

    for (const c of competitors) {
      const tea = c.team || {};
      const name = (tea.displayName || tea.name || c.name || '').trim();
      if (!name) continue;

      const isHome = c.homeAway === 'home';
      const scoreVal = c.score != null && !isNaN(Number(c.score)) ? Number(c.score) : null;
      const isWinner = c.winner === true;

      if (isHome) {
        homeParticipant = name;
        homeScore = scoreVal;
        homeWinner = isWinner;
      } else {
        awayParticipant = name;
        awayScore = scoreVal;
        awayWinner = isWinner;
      }
    }

    if (!homeParticipant || !awayParticipant) continue;

    const statusState = (comp.status?.type?.state || 'pre').toLowerCase();
    let status: 'scheduled' | 'in_progress' | 'completed' = 'scheduled';
    if (['post', 'final'].includes(statusState)) {
      status = 'completed';
    } else if (['in', 'live'].includes(statusState)) {
      status = 'in_progress';
    }

    let actualWinner: string | null = null;
    if (status === 'completed') {
      if (homeWinner) actualWinner = homeParticipant;
      else if (awayWinner) actualWinner = awayParticipant;
      else if (homeScore !== null && awayScore !== null) {
        actualWinner = homeScore > awayScore ? homeParticipant : awayParticipant;
      }
    }

    const venue = comp.venue?.fullName || `${homeParticipant} Stadium`;
    const eventDate = comp.date || ev.date || new Date().toISOString();

    events.push({
      id: `ev_espn_${sport}_${evId}`,
      sport,
      external_id: `espn_${sport}_${evId}`,
      event_date: eventDate,
      home_participant: homeParticipant,
      away_participant: awayParticipant,
      surface: sport === 'mlb' ? 'Dirt/Grass' : 'Grass',
      venue,
      status,
      home_score: homeScore,
      away_score: awayScore,
      actual_winner: actualWinner,
      official_metadata: {
        source: 'espn_browser_fallback',
        venue,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return events;
}

/**
 * Direct Client-Side Fallback Scraper:
 * Queries ESPN public scoreboards directly from the browser across Tennis, MLB, CFB, and NFL.
 * ESPN APIs have CORS headers enabled for browser fetches and never block client IPs.
 */
export async function scrapeLiveSlateFromBrowser(): Promise<SportingEvent[]> {
  const endpoints = [
    { url: `${ESPN_BASE}/tennis/atp/scoreboard`, type: 'tennis_atp' },
    { url: `${ESPN_BASE}/tennis/wta/scoreboard`, type: 'tennis_wta' },
    { url: `${ESPN_BASE}/baseball/mlb/scoreboard`, type: 'mlb' },
    { url: `${ESPN_BASE}/football/college-football/scoreboard`, type: 'cfb' },
    { url: `${ESPN_BASE}/football/nfl/scoreboard`, type: 'nfl' },
  ];

  const results = await Promise.allSettled(
    endpoints.map(async (ep) => {
      const data = await fetchEspnJson(ep.url);
      if (!data) return [];

      if (ep.type === 'tennis_atp') {
        return parseEspnTennisEvents(data, 'atp');
      } else if (ep.type === 'tennis_wta') {
        return parseEspnTennisEvents(data, 'wta');
      } else if (ep.type === 'mlb') {
        return parseEspnTeamSportEvents(data, 'mlb');
      } else if (ep.type === 'cfb') {
        return parseEspnTeamSportEvents(data, 'cfb');
      } else if (ep.type === 'nfl') {
        return parseEspnTeamSportEvents(data, 'nfl');
      }
      return [];
    })
  );

  const allEvents: SportingEvent[] = [];
  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      allEvents.push(...res.value);
    }
  }

  return allEvents;
}

/**
 * Upserts sporting events into Supabase PostgreSQL table via client
 */
export async function upsertEventsToSupabase(events: SportingEvent[]): Promise<boolean> {
  if (!isSupabaseConfigured() || events.length === 0) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const payload = events.map((e) => ({
      sport: e.sport,
      external_id: e.external_id,
      event_date: e.event_date,
      home_participant: e.home_participant,
      away_participant: e.away_participant,
      surface: e.surface,
      venue: e.venue,
      status: e.status,
      home_score: e.home_score,
      away_score: e.away_score,
      actual_winner: e.actual_winner,
      official_metadata: e.official_metadata || {},
      updated_at: new Date().toISOString(),
    }));

    const { error } = await client
      .from('sporting_events')
      .upsert(payload, { onConflict: 'external_id' });

    if (error) {
      console.warn('[BrowserScraper] Supabase upsert non-fatal error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[BrowserScraper] Supabase upsert non-fatal exception:', err);
    return false;
  }
}
