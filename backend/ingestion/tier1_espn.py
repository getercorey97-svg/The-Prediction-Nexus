"""
The Prediction Nexus: Tier 1 Primary Live Scraper (ESPN Hidden API)
===================================================================
Scrapes live daily scoreboards and schedules across MLB, CFB, NFL, and Tennis
(ATP/WTA) via site.api.espn.com/apis/site/v2/sports/.

Features:
- Fixed ESPN Tennis parser: Handles tournaments where matches are nested
  inside `event.get("groupings", [])` -> `grouping.get("competitions", [])`
  AND top-level `event.get("competitions", [])`.
- Robust tennis competitor name extraction from `athlete.displayName`
  and `roster.displayName` (avoiding null `team` objects in singles).
- Rolling date window queries (`?dates=YYYYMMDD`) to capture all active
  and upcoming ATP and WTA matches.
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


def extract_competitor_info(c: Dict[str, Any], sport: str) -> Optional[Dict[str, Any]]:
    """
    Extracts normalized competitor info, prioritizing athlete displayName for Tennis
    and team displayName for MLB/CFB/NFL.
    """
    if not isinstance(c, dict):
        return None

    team_info = c.get("team") or {}
    athlete_info = c.get("athlete") or {}
    roster_info = c.get("roster") or {}

    display_name = ""
    if sport == "tennis":
        # In tennis singles, team is null; athlete has the player details
        display_name = (
            athlete_info.get("displayName")
            or athlete_info.get("fullName")
            or athlete_info.get("shortName")
            or roster_info.get("displayName")
            or team_info.get("displayName")
            or c.get("name")
            or ""
        )
    else:
        display_name = (
            team_info.get("displayName")
            or team_info.get("name")
            or athlete_info.get("displayName")
            or c.get("name")
            or ""
        )

    display_name = display_name.strip()
    if not display_name or display_name.lower() in ["tbd", "to be determined", "null", "none"]:
        return None

    score_val = c.get("score")
    score_int: Optional[int] = None
    if score_val is not None:
        try:
            score_int = int(str(score_val).strip())
        except (ValueError, TypeError):
            score_int = None

    # Extract linescores if available (e.g. set scores for tennis)
    linescores = []
    for ls in c.get("linescores", []):
        if isinstance(ls, dict) and "value" in ls:
            try:
                linescores.append(int(ls["value"]))
            except (ValueError, TypeError):
                pass
        elif isinstance(ls, (int, float)):
            linescores.append(int(ls))

    return {
        "name": display_name,
        "score": score_int,
        "linescores": linescores,
        "is_winner": bool(c.get("winner", False)),
        "seed": c.get("curatedRank", {}).get("current") if isinstance(c.get("curatedRank"), dict) else None,
    }


def parse_competition_item(
    comp: Dict[str, Any],
    sport: str,
    tournament_name: str = "",
    default_date: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Normalizes a single competition item into a Prediction Nexus event record.
    Works for both tournament-nested tennis matches and standard team sports.
    """
    comp_id = str(comp.get("id") or comp.get("uid") or "")
    if not comp_id:
        return None

    date_iso = comp.get("date") or default_date or (datetime.datetime.utcnow().isoformat() + "Z")
    
    status_obj = comp.get("status", {}).get("type", {})
    status_state = status_obj.get("state", "pre").lower()
    status_desc = status_obj.get("description", "")

    if status_state in ["post", "final", "completed"]:
        status = "completed"
    elif status_state in ["in", "live", "in_progress"]:
        status = "in_progress"
    else:
        status = "scheduled"

    competitors = comp.get("competitors", [])
    if len(competitors) < 2:
        return None

    home_entry = None
    away_entry = None

    for c in competitors:
        parsed_c = extract_competitor_info(c, sport)
        if not parsed_c:
            continue

        is_home = c.get("homeAway") == "home"
        if sport == "tennis":
            if home_entry is None:
                home_entry = parsed_c
            else:
                away_entry = parsed_c
        else:
            if is_home:
                home_entry = parsed_c
            else:
                away_entry = parsed_c

    # If home or away is missing after check
    if not home_entry or not away_entry:
        valid_entries = [extract_competitor_info(c, sport) for c in competitors]
        valid_entries = [v for v in valid_entries if v is not None]
        if len(valid_entries) >= 2:
            home_entry = valid_entries[0]
            away_entry = valid_entries[1]
        else:
            return None

    # Venue & surface detection
    venue_obj = comp.get("venue", {})
    venue_name = venue_obj.get("fullName", "") or tournament_name or "Stadium / Court"
    address_obj = venue_obj.get("address", {})
    venue_city = address_obj.get("city", "")
    venue_state = address_obj.get("state", "")
    venue_display = f"{venue_name}, {venue_city}" if venue_city and venue_city not in venue_name else venue_name

    is_indoor = venue_obj.get("indoor", False)

    surface = None
    if sport == "tennis":
        court_surface = str(comp.get("surface", "")).capitalize()
        tourn_lower = tournament_name.lower()
        if "clay" in court_surface.lower() or "roland" in tourn_lower or "madrid" in tourn_lower or "rome" in tourn_lower or "monte-carlo" in tourn_lower:
            surface = "Clay"
        elif "grass" in court_surface.lower() or "wimbledon" in tourn_lower or "halle" in tourn_lower or "queen" in tourn_lower:
            surface = "Grass"
        elif "indoor" in tourn_lower or "indoor" in court_surface.lower():
            surface = "Hard"
            is_indoor = True
        else:
            surface = "Hard"

    # Odds consensus
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
    elif sport == "tennis":
        # Default balanced tennis odds if bookmaker not specified
        market_odds.update({
            "home_moneyline": -120,
            "away_moneyline": +100,
            "total_games_line": 22.5,
        })

    # Winner determination
    actual_winner = None
    if status == "completed":
        if home_entry["is_winner"]:
            actual_winner = home_entry["name"]
        elif away_entry["is_winner"]:
            actual_winner = away_entry["name"]
        elif home_entry.get("score") is not None and away_entry.get("score") is not None:
            if home_entry["score"] > away_entry["score"]:
                actual_winner = home_entry["name"]
            elif home_entry["score"] < away_entry["score"]:
                actual_winner = away_entry["name"]
            else:
                actual_winner = "Tie / Push"

    external_id = f"{sport.upper()}_ESPN_{comp_id}"

    return {
        "external_id": external_id,
        "sport": sport,
        "event_date": date_iso,
        "home_participant": home_entry["name"],
        "away_participant": away_entry["name"],
        "surface": surface,
        "venue": venue_display,
        "is_indoor": is_indoor,
        "status": status,
        "home_score": home_entry["score"],
        "away_score": away_entry["score"],
        "actual_winner": actual_winner,
        "market_odds": market_odds,
        "official_metadata": {
            "espn_id": comp_id,
            "tournament_name": tournament_name,
            "venue_city": venue_city,
            "venue_state": venue_state,
            "status_description": status_desc,
            "home_linescores": home_entry.get("linescores", []),
            "away_linescores": away_entry.get("linescores", []),
            "tier_source": "Tier 1 (ESPN Hidden API)",
        },
    }


def parse_espn_events(sport: str, raw_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parses and normalizes ESPN scoreboard event array into Prediction Nexus format.
    Handles both direct team competitions and tournament-nested tennis fixtures.
    """
    parsed_events: List[Dict[str, Any]] = []
    events_list = raw_json.get("events", [])

    for ev in events_list:
        try:
            tournament_name = ev.get("name") or ev.get("shortName") or ""
            default_date = ev.get("date", "")

            # 1. Check groupings -> competitions (Standard structure for ESPN Tennis)
            groupings = ev.get("groupings", [])
            has_grouping_comps = False

            if isinstance(groupings, list):
                for grp in groupings:
                    if isinstance(grp, dict):
                        grp_comps = grp.get("competitions", [])
                        for comp in grp_comps:
                            has_grouping_comps = True
                            item = parse_competition_item(comp, sport, tournament_name, default_date)
                            if item:
                                parsed_events.append(item)

            # 2. Check top-level competitions
            top_comps = ev.get("competitions", [])
            if isinstance(top_comps, list):
                for comp in top_comps:
                    # Avoid duplicate if already parsed from groupings
                    comp_id = str(comp.get("id") or comp.get("uid") or "")
                    if any(p["official_metadata"].get("espn_id") == comp_id for p in parsed_events):
                        continue
                    item = parse_competition_item(comp, sport, tournament_name, default_date)
                    if item:
                        parsed_events.append(item)

        except Exception as parse_err:
            logger.debug(f"Skipping unparseable event in {sport}: {parse_err}")
            continue

    return parsed_events


def fetch_espn_scoreboard(sport: str, date_str: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches raw scoreboard JSON from ESPN hidden API for a sport and optional YYYYMMDD date.
    Returns normalized Tier 1 event dictionaries.
    """
    sport_key = sport.lower().strip()
    endpoints = []
    if sport_key == "tennis":
        endpoints = [
            ("tennis", SPORT_ENDPOINT_MAP["tennis_atp"]),
            ("tennis", SPORT_ENDPOINT_MAP["tennis_wta"]),
        ]
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
    Queries today's slate, and queries a rolling window of dates (?dates=YYYYMMDD)
    to guarantee active live and scheduled sporting fixtures.
    For tennis, automatically queries today, tomorrow, and subsequent dates to gather
    all active tour fixtures.
    """
    today = datetime.date.today()
    today_str = today.strftime("%Y%m%d")
    events = fetch_espn_scoreboard(sport, today_str)

    # For Tennis, always scan today + tomorrow + 2 days ahead to aggregate full tournament rounds
    if sport == "tennis":
        for offset in range(1, min(days_ahead, 4) + 1):
            target_date = today + datetime.timedelta(days=offset)
            target_str = target_date.strftime("%Y%m%d")
            upcoming_events = fetch_espn_scoreboard(sport, target_str)
            if upcoming_events:
                # Deduplicate by external_id
                existing_ids = {e["external_id"] for e in events}
                for u_ev in upcoming_events:
                    if u_ev["external_id"] not in existing_ids:
                        events.append(u_ev)
                        existing_ids.add(u_ev["external_id"])

        # Also check yesterday for completed post-mortems
        yesterday = today - datetime.timedelta(days=1)
        yesterday_str = yesterday.strftime("%Y%m%d")
        recent_events = fetch_espn_scoreboard(sport, yesterday_str)
        if recent_events:
            existing_ids = {e["external_id"] for e in events}
            for r_ev in recent_events:
                if r_ev["external_id"] not in existing_ids:
                    events.append(r_ev)
                    existing_ids.add(r_ev["external_id"])

        return events

    # For team sports (MLB, CFB, NFL)
    if events:
        return events

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

    # If still empty, check yesterday for completed
    if not events:
        yesterday = today - datetime.timedelta(days=1)
        yesterday_str = yesterday.strftime("%Y%m%d")
        recent_events = fetch_espn_scoreboard(sport, yesterday_str)
        if recent_events:
            events.extend(recent_events)
            logger.info(f"Retrieved {len(recent_events)} recent completed events from yesterday ({yesterday_str})")

    return events
