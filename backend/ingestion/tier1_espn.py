"""
The Prediction Nexus: Tier 1 Primary Live Scraper (ESPN Hidden API)
===================================================================
Scrapes live daily scoreboards and schedules across MLB, CFB, NFL, and Tennis
(ATP/WTA) via site.api.espn.com/apis/site/v2/sports/.

Extracts:
- event_id, external_id, sport
- live status (scheduled, in_progress, completed)
- start times, home/away competitors, live/final box scores
- venue name, city/state, indoor/outdoor indicator, court surface
- bookmaker consensus market odds (moneyline, spread, over/under)
"""

from __future__ import annotations

import logging
import datetime
from typing import List, Dict, Any, Optional
import requests

logger = logging.getLogger("nexus.ingestion.tier1_espn")

ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports"

SPORT_ENDPOINT_MAP = {
    "mlb": f"{ESPN_BASE_URL}/baseball/mlb/scoreboard",
    "cfb": f"{ESPN_BASE_URL}/football/college-football/scoreboard",
    "nfl": f"{ESPN_BASE_URL}/football/nfl/scoreboard",
    "tennis_atp": f"{ESPN_BASE_URL}/tennis/atp/scoreboard",
    "tennis_wta": f"{ESPN_BASE_URL}/tennis/wta/scoreboard",
}


def fetch_espn_scoreboard(sport: str, date_str: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches raw scoreboard JSON from ESPN hidden API for a sport and optional YYYYMMDD date.
    Returns normalized Tier 1 event dictionaries.
    """
    sport_key = sport.lower().strip()
    endpoints = []
    if sport_key == "tennis":
        endpoints = [("tennis", SPORT_ENDPOINT_MAP["tennis_atp"]), ("tennis", SPORT_ENDPOINT_MAP["tennis_wta"])]
    elif sport_key in SPORT_ENDPOINT_MAP:
        endpoints = [(sport_key, SPORT_ENDPOINT_MAP[sport_key])]
    else:
        logger.error(f"Unsupported sport for Tier 1 scraper: {sport}")
        return []

    events: List[Dict[str, Any]] = []

    for sp_name, url in endpoints:
        params: Dict[str, Any] = {}
        if date_str:
            params["dates"] = date_str

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "application/json",
            }
            resp = requests.get(url, params=params, headers=headers, timeout=9.0)
            if resp.status_code == 200:
                data = resp.json()
                parsed = parse_espn_events(sp_name, data)
                events.extend(parsed)
                logger.info(f"Tier 1 ESPN: Scraped {len(parsed)} events for {sp_name} (date: {date_str or 'live'})")
            else:
                logger.warning(f"Tier 1 ESPN: {url} returned HTTP {resp.status_code}")
        except Exception as exc:
            logger.warning(f"Tier 1 ESPN: Request failed for {url} ({exc})")

    return events


def fetch_rolling_window_events(sport: str, days_ahead: int = 7) -> List[Dict[str, Any]]:
    """
    Queries today's slate, and if zero games are returned, queries a rolling
    window of the upcoming days to guarantee active live sporting fixtures.
    """
    today = datetime.date.today()
    today_str = today.strftime("%Y%m%d")
    events = fetch_espn_scoreboard(sport, today_str)

    if events:
        return events

    # If today has 0 matches (e.g. off-day or off-season calendar pause), query rolling window
    logger.info(f"Zero events on today ({today_str}) for {sport}. Scanning upcoming {days_ahead} days...")
    for offset in range(1, days_ahead + 1):
        target_date = today + datetime.timedelta(days=offset)
        target_str = target_date.strftime("%Y%m%d")
        day_events = fetch_espn_scoreboard(sport, target_str)
        if day_events:
            events.extend(day_events)
            logger.info(f"Found {len(day_events)} upcoming fixtures on {target_str} for {sport}")
            if len(events) >= 6:
                break

    # If still empty, check yesterday for recently completed empirical verification
    if not events:
        yesterday = today - datetime.timedelta(days=1)
        yesterday_str = yesterday.strftime("%Y%m%d")
        recent_events = fetch_espn_scoreboard(sport, yesterday_str)
        if recent_events:
            events.extend(recent_events)
            logger.info(f"Retrieved {len(recent_events)} recent completed events from yesterday ({yesterday_str})")

    return events


def parse_espn_events(sport: str, raw_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parses and normalizes ESPN scoreboard event array into Prediction Nexus format.
    """
    parsed_events: List[Dict[str, Any]] = []
    events_list = raw_json.get("events", [])

    for ev in events_list:
        try:
            event_id = str(ev.get("id", ""))
            name = ev.get("name", "")
            date_iso = ev.get("date", datetime.datetime.utcnow().isoformat() + "Z")
            status_obj = ev.get("status", {}).get("type", {})
            status_state = status_obj.get("state", "pre").lower()

            # Normalize status
            if status_state in ["post", "final", "completed"]:
                status = "completed"
            elif status_state in ["in", "live", "in_progress"]:
                status = "in_progress"
            else:
                status = "scheduled"

            competitions = ev.get("competitions", [])
            if not competitions:
                continue

            comp = competitions[0]
            competitors = comp.get("competitors", [])
            if len(competitors) < 2:
                continue

            home_team = None
            away_team = None
            for c in competitors:
                team_info = c.get("team", {})
                athlete_info = c.get("athlete", {})
                display_name = team_info.get("displayName") or athlete_info.get("displayName") or c.get("name", "Competitor")
                score_val = c.get("score")
                score_int = int(score_val) if score_val is not None and str(score_val).isdigit() else None

                entry = {
                    "name": display_name,
                    "score": score_int,
                    "is_winner": c.get("winner", False),
                }

                if c.get("homeAway") == "home" or (sport == "tennis" and home_team is None):
                    home_team = entry
                else:
                    away_team = entry

            if not home_team or not away_team:
                continue

            # Venue & Location
            venue_obj = comp.get("venue", {})
            venue_name = venue_obj.get("fullName", "Stadium / Court")
            address_obj = venue_obj.get("address", {})
            venue_city = address_obj.get("city", "")
            venue_state = address_obj.get("state", "")
            venue_display = f"{venue_name}, {venue_city}" if venue_city else venue_name

            # Indoor/Outdoor indicator
            is_indoor = venue_obj.get("indoor", False)

            # Surface for Tennis
            surface = None
            if sport == "tennis":
                court_surface = comp.get("surface", "").capitalize()
                if "Clay" in court_surface or "Roland" in name:
                    surface = "Clay"
                elif "Grass" in court_surface or "Wimbledon" in name:
                    surface = "Grass"
                else:
                    surface = "Hard"

            # Market Odds consensus from ESPN competitors/odds
            market_odds: Dict[str, Any] = {"bookmaker": "Consensus"}
            odds_list = comp.get("odds", [])
            if odds_list:
                primary_odds = odds_list[0]
                market_odds["bookmaker"] = primary_odds.get("provider", {}).get("name", "Consensus")
                if "details" in primary_odds:
                    market_odds["spread_details"] = primary_odds.get("details")
                if "overUnder" in primary_odds:
                    try:
                        market_odds["total_line"] = float(primary_odds.get("overUnder"))
                    except (ValueError, TypeError):
                        pass

                home_odds_obj = primary_odds.get("homeTeamOdds", {})
                away_odds_obj = primary_odds.get("awayTeamOdds", {})
                if "moneyLine" in home_odds_obj:
                    market_odds["home_moneyline"] = home_odds_obj.get("moneyLine")
                if "moneyLine" in away_odds_obj:
                    market_odds["away_moneyline"] = away_odds_obj.get("moneyLine")
                if "spreadOdds" in home_odds_obj:
                    market_odds["spread_line"] = home_odds_obj.get("spreadOdds")

            # Determine actual winner if completed
            actual_winner = None
            if status == "completed":
                if home_team.get("score") is not None and away_team.get("score") is not None:
                    if home_team["score"] > away_team["score"]:
                        actual_winner = home_team["name"]
                    elif home_team["score"] < away_team["score"]:
                        actual_winner = away_team["name"]
                    else:
                        actual_winner = "Tie / Push"

            external_id = f"{sport.upper()}_ESPN_{event_id}"

            parsed_events.append({
                "external_id": external_id,
                "sport": sport,
                "event_date": date_iso,
                "home_participant": home_team["name"],
                "away_participant": away_team["name"],
                "surface": surface,
                "venue": venue_display,
                "is_indoor": is_indoor,
                "status": status,
                "home_score": home_team["score"],
                "away_score": away_team["score"],
                "actual_winner": actual_winner,
                "market_odds": market_odds,
                "official_metadata": {
                    "espn_id": event_id,
                    "event_name": name,
                    "venue_city": venue_city,
                    "venue_state": venue_state,
                    "tier_source": "Tier 1 (ESPN Hidden API)",
                },
            })
        except Exception as parse_err:
            logger.debug(f"Skipping unparseable event in {sport}: {parse_err}")
            continue

    return parsed_events
