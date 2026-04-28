from __future__ import annotations

import logging
from datetime import date, datetime, timezone, timedelta

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/games", tags=["games"])

MLB_SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule"

# Simple in-memory cache: (date_str, data, fetched_at)
_cache: dict = {}
CACHE_TTL_SECONDS = 30


def _et_label(game_date_str: str) -> str:
    """Convert ISO game date string (UTC) to Eastern time label."""
    try:
        dt = datetime.fromisoformat(game_date_str.replace("Z", "+00:00"))
        # ET = UTC-4 (EDT) during the season; close enough without pytz
        et = dt + timedelta(hours=-4)
        hour = et.hour % 12 or 12
        ampm = "pm" if et.hour >= 12 else "am"
        return f"{hour}:{et.minute:02d} {ampm} ET"
    except Exception:
        return ""


def _et_today() -> str:
    """Return today's date in Eastern Time (UTC-4 during EDT, UTC-5 EST).
    MLB season runs Mar–Nov, all in EDT (UTC-4), so -4 is always correct in-season."""
    now_utc = datetime.now(tz=timezone.utc)
    et = now_utc + timedelta(hours=-4)
    return et.date().isoformat()


@router.get("/today")
async def get_today_games():
    today = _et_today()
    now = datetime.now(tz=timezone.utc).timestamp()

    cached = _cache.get("today")
    if cached and cached["date"] == today and (now - cached["ts"]) < CACHE_TTL_SECONDS:
        return cached["data"]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                MLB_SCHEDULE_URL,
                params={"sportId": 1, "date": today, "hydrate": "linescore,team"},
            )
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        logger.warning(f"MLB schedule fetch failed: {exc}")
        return {"date": today, "games": []}

    games = []
    for date_block in raw.get("dates", []):
        for game in date_block.get("games", []):
            status = game.get("status", {})
            teams = game.get("teams", {})
            away = teams.get("away", {})
            home = teams.get("home", {})
            linescore = game.get("linescore", {})

            abstract_state = status.get("abstractGameState", "Preview")
            detailed_state = status.get("detailedState", "")
            inning = linescore.get("currentInning")
            is_top = linescore.get("isTopInning", True)
            outs = linescore.get("outs")

            if abstract_state == "Live":
                if inning:
                    half = "Top" if is_top else "Bot"
                    status_label = f"{half} {inning}"
                    if outs is not None:
                        status_label += f" · {outs} Out{'s' if outs != 1 else ''}"
                else:
                    status_label = "Live"
            elif abstract_state == "Final":
                innings_played = linescore.get("currentInning", 9)
                status_label = "Final" if innings_played == 9 else f"Final/{innings_played}"
            else:
                # Postponed, Suspended, etc.
                if detailed_state in ("Postponed", "Suspended", "Cancelled"):
                    status_label = detailed_state
                else:
                    game_date_str = game.get("gameDate", "")
                    status_label = _et_label(game_date_str) if game_date_str else detailed_state

            away_team = away.get("team", {})
            home_team = home.get("team", {})

            games.append({
                "gamePk": game.get("gamePk"),
                "status": abstract_state,
                "statusLabel": status_label,
                "away": {
                    "id": away_team.get("id"),
                    "abbrev": away_team.get("abbreviation", ""),
                    "score": away.get("score"),
                },
                "home": {
                    "id": home_team.get("id"),
                    "abbrev": home_team.get("abbreviation", ""),
                    "score": home.get("score"),
                },
            })

    result = {"date": today, "games": games}
    _cache["today"] = {"date": today, "ts": now, "data": result}
    return result
