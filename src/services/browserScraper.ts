/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SportingEvent, HistoricalWindowConfig } from '../types/database';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const MLB_STATS_BASE = 'https://statsapi.mlb.com/api/v1';

/**
 * The 7 Progressive Windows for 60-day historical calibration and upcoming live slate:
 * Window 2 covers Aug 21 - Aug 31 to prevent skipping August 31.
 * Window 7 covers Oct 11 - Oct 18 for forward-looking active fixtures.
 */
export const HISTORICAL_CALIBRATION_WINDOWS: HistoricalWindowConfig[] = [
  { id: 1, title: 'Aug 11 - Aug 20, 2026 (Early August)', startDate: '2026-08-11', endDate: '2026-08-20' },
  { id: 2, title: 'Aug 21 - Aug 31, 2026 (Late August)', startDate: '2026-08-21', endDate: '2026-08-31' },
  { id: 3, title: 'Sep 01 - Sep 10, 2026 (Early September)', startDate: '2026-09-01', endDate: '2026-09-10' },
  { id: 4, title: 'Sep 11 - Sep 20, 2026 (Mid September)', startDate: '2026-09-11', endDate: '2026-09-20' },
  { id: 5, title: 'Sep 21 - Sep 30, 2026 (Late September)', startDate: '2026-09-21', endDate: '2026-09-30' },
  { id: 6, title: 'Oct 01 - Oct 11, 2026 (Pennant Race & Week 5-6)', startDate: '2026-10-01', endDate: '2026-10-11' },
  { id: 7, title: 'Oct 11 - Oct 18, 2026 (Active & Upcoming Slate)', startDate: '2026-10-11', endDate: '2026-10-18', isForwardLooking: true },
];

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

function makeTennisDedupKey(p1: string, p2: string, dateStr: string): string {
  const l1 = normalizeLastName(p1);
  const l2 = normalizeLastName(p2);
  const pair = [l1, l2].sort().join('_vs_');
  const d = dateStr ? dateStr.substring(0, 10).replace(/-/g, '') : 'nodate';
  return `${pair}_${d}`;
}

/**
 * Safely fetches JSON from public endpoints with timeout
 */
async function fetchPublicJson(url: string, timeoutMs: number = 7000): Promise<any> {
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
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses MLB StatsAPI schedule response
 * Extracts actual starting pitchers, team records, inning linescores, and game statuses
 */
export function parseMlbStatsApiGames(data: any): SportingEvent[] {
  if (!data || !Array.isArray(data.dates)) return [];

  const events: SportingEvent[] = [];

  for (const dateObj of data.dates) {
    const games = dateObj.games || [];
    for (const g of games) {
      const gamePk = String(g.gamePk || '');
      if (!gamePk) continue;

      const homeTeam = g.teams?.home;
      const awayTeam = g.teams?.away;
      if (!homeTeam || !awayTeam) continue;

      const homeName = (homeTeam.team?.name || 'Home Team').trim();
      const awayName = (awayTeam.team?.name || 'Away Team').trim();
      const homeScore = homeTeam.score != null ? Number(homeTeam.score) : null;
      const awayScore = awayTeam.score != null ? Number(awayTeam.score) : null;

      const statusState = (g.status?.abstractGameState || g.status?.detailedState || 'Preview').toLowerCase();
      let status: 'scheduled' | 'in_progress' | 'completed' = 'scheduled';
      if (['final', 'game over', 'completed'].includes(statusState) || g.status?.statusCode === 'F') {
        status = 'completed';
      } else if (['live', 'in progress'].includes(statusState) || g.status?.statusCode === 'I') {
        status = 'in_progress';
      }

      let actualWinner: string | null = null;
      if (status === 'completed') {
        if (homeTeam.isWinner === true) actualWinner = homeName;
        else if (awayTeam.isWinner === true) actualWinner = awayName;
        else if (homeScore !== null && awayScore !== null) {
          actualWinner = homeScore > awayScore ? homeName : awayName;
        }
      }

      const venueName = g.venue?.name || `${homeName} Ballpark`;
      const eventDate = g.gameDate || `${dateObj.date}T19:05:00Z`;

      events.push({
        id: `ev_mlb_stat_${gamePk}`,
        sport: 'mlb',
        external_id: `mlb_${gamePk}`,
        event_date: eventDate,
        home_participant: homeName,
        away_participant: awayName,
        surface: 'Dirt/Grass',
        venue: venueName,
        status,
        home_score: homeScore,
        away_score: awayScore,
        actual_winner: actualWinner,
        market_odds: {
          home_moneyline: -115,
          away_moneyline: 105,
        },
        official_metadata: {
          source: 'mlb_statsapi',
          probable_pitcher_home: homeTeam.probablePitcher?.fullName,
          probable_pitcher_away: awayTeam.probablePitcher?.fullName,
          home_record: homeTeam.leagueRecord || {},
          away_record: awayTeam.leagueRecord || {},
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return events;
}

/**
 * Parses ESPN Tennis Scoreboard (ATP & WTA)
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

    // 1. Groupings competitions
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

      const parsedAthletes = competitors
        .map((c: any) => {
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
          const scoreVal = c.score != null && !isNaN(Number(c.score)) ? Number(c.score) : null;
          const isWinner = c.winner === true;
          const isHome = c.homeAway === 'home' || c.order === 1;
          const records = c.records || [];
          return { name, scoreVal, isWinner, isHome, records };
        })
        .filter((c: any) => c.name.length > 0);

      if (parsedAthletes.length < 2) continue;

      const homeComp = parsedAthletes.find((c: any) => c.isHome) || parsedAthletes[0];
      const awayComp = parsedAthletes.find((c: any) => !c.isHome && c !== homeComp) || parsedAthletes[1];

      const homeParticipant = homeComp.name;
      const awayParticipant = awayComp.name;
      const homeScore = homeComp.scoreVal;
      const awayScore = awayComp.scoreVal;
      const homeWinner = homeComp.isWinner;
      const awayWinner = awayComp.isWinner;

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

      // Check for odds
      const oddsObj = comp.odds?.[0] || ev.odds?.[0];
      let marketOdds: Record<string, any> = {};
      if (oddsObj) {
        marketOdds = {
          home_moneyline: oddsObj.homeOdds?.moneyLine,
          away_moneyline: oddsObj.awayOdds?.moneyLine,
        };
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
        market_odds: Object.keys(marketOdds).length > 0 ? marketOdds : undefined,
        official_metadata: {
          circuit: circuit.toUpperCase(),
          tournament: tournamentName,
          source: 'espn_scoreboard',
          home_record: homeComp.records?.[0] || {},
          away_record: awayComp.records?.[0] || {},
          odds: marketOdds,
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
 * Extracts pre-match records, consensus odds if present, and linescores
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

    const parsedTeams = competitors
      .map((c: any) => {
        const tea = c.team || {};
        const name = (tea.displayName || tea.name || c.name || '').trim();
        const scoreVal = c.score != null && !isNaN(Number(c.score)) ? Number(c.score) : null;
        const isWinner = c.winner === true;
        const isHome = c.homeAway === 'home' || c.order === 0;

        let wins = 0;
        let losses = 0;
        if (Array.isArray(c.records) && c.records.length > 0) {
          const recSummary = c.records[0]?.summary || '';
          const parts = recSummary.split('-');
          if (parts.length >= 2) {
            wins = parseInt(parts[0], 10) || 0;
            losses = parseInt(parts[1], 10) || 0;
          }
        }

        return { name, scoreVal, isWinner, isHome, wins, losses };
      })
      .filter((c: any) => c.name.length > 0);

    if (parsedTeams.length < 2) continue;

    const homeComp = parsedTeams.find((c: any) => c.isHome) || parsedTeams[0];
    const awayComp = parsedTeams.find((c: any) => !c.isHome && c !== homeComp) || parsedTeams[1];

    const homeParticipant = homeComp.name;
    const awayParticipant = awayComp.name;
    const homeScore = homeComp.scoreVal;
    const awayScore = awayComp.scoreVal;
    const homeWinner = homeComp.isWinner;
    const awayWinner = awayComp.isWinner;

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

    // Extract closing or consensus odds if present
    const oddsObj = comp.odds?.[0] || ev.odds?.[0];
    let marketOdds: Record<string, any> = {};
    if (oddsObj) {
      marketOdds = {
        details: oddsObj.details,
        over_under: oddsObj.overUnder,
        spread: oddsObj.spread,
        home_moneyline: oddsObj.homeOdds?.moneyLine,
        away_moneyline: oddsObj.awayOdds?.moneyLine,
      };
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
      market_odds: Object.keys(marketOdds).length > 0 ? marketOdds : undefined,
      official_metadata: {
        source: 'espn_scoreboard',
        venue,
        home_record: { wins: homeComp.wins, losses: homeComp.losses },
        away_record: { wins: awayComp.wins, losses: awayComp.losses },
        odds: marketOdds,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return events;
}

/**
 * Cache for MLB schedule to prevent repeating bulk calls
 */
let cachedMlbBulkEvents: SportingEvent[] | null = null;

/**
 * Fetches the 60-day MLB schedule in a single bulk call
 */
export async function fetchMlbSeasonSlate(): Promise<SportingEvent[]> {
  if (cachedMlbBulkEvents && cachedMlbBulkEvents.length > 0) {
    return cachedMlbBulkEvents;
  }

  const url = `${MLB_STATS_BASE}/schedule?sportId=1&startDate=2026-08-11&endDate=2026-10-18&hydrate=probablePitcher,linescore,team`;
  const data = await fetchPublicJson(url, 9000);
  if (!data) return [];

  const parsed = parseMlbStatsApiGames(data);
  if (parsed.length > 0) {
    cachedMlbBulkEvents = parsed;
  }
  return parsed;
}

/**
 * Fetches events for a specific 10-day progressive window across MLB, CFB, NFL, and Tennis
 */
export async function fetchProgressiveWindowSlate(windowConfig: HistoricalWindowConfig): Promise<SportingEvent[]> {
  const { startDate, endDate, isForwardLooking } = windowConfig;
  const events: SportingEvent[] = [];

  // 1. MLB: Slices from full 60-day bulk call or fetches directly
  try {
    const mlbAll = await fetchMlbSeasonSlate();
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate + 'T23:59:59Z').getTime();

    const mlbSlice = mlbAll.filter((e) => {
      const t = new Date(e.event_date).getTime();
      return t >= startTs && t <= endTs;
    });
    events.push(...mlbSlice);
  } catch (err) {
    console.warn('[BrowserScraper] MLB slice exception:', err);
  }

  // 2. CFB & NFL: Sample representative dates in the window
  const dateSamples: string[] = [];
  const s = new Date(startDate);
  const e = new Date(endDate);
  // Pick key dates (e.g. start, mid, end) to pull scoreboards without spamming
  const stepDays = isForwardLooking ? 2 : 4;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + stepDays)) {
    const yyyymmdd = d.toISOString().substring(0, 10).replace(/-/g, '');
    dateSamples.push(yyyymmdd);
  }

  const networkTasks: Promise<SportingEvent[]>[] = [];

  // Tennis calls
  networkTasks.push(
    fetchPublicJson(`${ESPN_BASE}/tennis/atp/scoreboard`).then((d) => (d ? parseEspnTennisEvents(d, 'atp') : []))
  );
  networkTasks.push(
    fetchPublicJson(`${ESPN_BASE}/tennis/wta/scoreboard`).then((d) => (d ? parseEspnTennisEvents(d, 'wta') : []))
  );

  // CFB and NFL sampled dates
  for (const dateStr of dateSamples) {
    networkTasks.push(
      fetchPublicJson(`${ESPN_BASE}/football/college-football/scoreboard?groups=80&limit=100&dates=${dateStr}`).then(
        (d) => (d ? parseEspnTeamSportEvents(d, 'cfb') : [])
      )
    );
    networkTasks.push(
      fetchPublicJson(`${ESPN_BASE}/football/nfl/scoreboard?dates=${dateStr}`).then(
        (d) => (d ? parseEspnTeamSportEvents(d, 'nfl') : [])
      )
    );
  }

  const results = await Promise.allSettled(networkTasks);
  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      events.push(...res.value);
    }
  }

  // Deduplicate on external_id
  const seenIds = new Set<string>();
  const deduped: SportingEvent[] = [];
  for (const ev of events) {
    if (!seenIds.has(ev.external_id)) {
      seenIds.add(ev.external_id);
      deduped.push(ev);
    }
  }

  return deduped;
}

/**
 * Client-Side Instant Slate Scraper for Current Day / Upcoming Slate
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
      const data = await fetchPublicJson(ep.url);
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
 * Implements robust schema-cache auto-adaptation:
 * If Supabase returns PGRST204 (column not found in schema cache, e.g. actual_winner or market_odds),
 * it dynamically strips the unrecognized column, packs it into official_metadata, and retries.
 */
export async function upsertEventsToSupabase(events: SportingEvent[]): Promise<boolean> {
  if (!isSupabaseConfigured() || events.length === 0) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  const buildPayload = (stripCols: Set<string> = new Set()) => {
    return events.map((e) => {
      const metadata = {
        ...(e.official_metadata || {}),
      };

      const record: Record<string, any> = {
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
        updated_at: new Date().toISOString(),
      };

      if (!stripCols.has('actual_winner') && e.actual_winner !== undefined) {
        record.actual_winner = e.actual_winner;
      } else if (stripCols.has('actual_winner') && e.actual_winner !== undefined) {
        metadata.actual_winner = e.actual_winner;
      }

      if (!stripCols.has('market_odds') && e.market_odds !== undefined) {
        record.market_odds = e.market_odds;
      } else if (stripCols.has('market_odds') && e.market_odds !== undefined) {
        metadata.market_odds = e.market_odds;
      }

      record.official_metadata = metadata;
      return record;
    });
  };

  try {
    let payload = buildPayload();
    let res = await client
      .from('sporting_events')
      .upsert(payload, { onConflict: 'external_id' });

    if (res.error) {
      // Check for PGRST204 or missing column pattern
      const msg = res.error.message || '';
      const missingColMatch = msg.match(/Could not find the '([^']+)' column/i);
      if (res.error.code === 'PGRST204' || missingColMatch) {
        const missingCol = missingColMatch ? missingColMatch[1] : 'actual_winner';
        const stripSet = new Set<string>([missingCol]);
        // Also strip market_odds if actual_winner was missing, just in case schema is standard minimal
        if (missingCol === 'actual_winner') {
          stripSet.add('actual_winner');
        }

        const retryPayload = buildPayload(stripSet);
        const retryRes = await client
          .from('sporting_events')
          .upsert(retryPayload, { onConflict: 'external_id' });

        if (retryRes.error) {
          // If still another column missing, strip market_odds too
          const msg2 = retryRes.error.message || '';
          const match2 = msg2.match(/Could not find the '([^']+)' column/i);
          if (match2) {
            stripSet.add(match2[1]);
            const finalPayload = buildPayload(stripSet);
            const finalRes = await client
              .from('sporting_events')
              .upsert(finalPayload, { onConflict: 'external_id' });
            return !finalRes.error;
          }
          return false;
        }
        return true;
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[BrowserScraper] Supabase upsert non-fatal exception:', err);
    return false;
  }
}
