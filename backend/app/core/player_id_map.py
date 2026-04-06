from __future__ import annotations

"""
Cross-source player ID mapping.

MLBAM IDs  — used by MLB Stats API and Statcast
FanGraphs IDs — used by pybaseball FanGraphs functions

This module builds and caches a unified map at startup so all routes can
accept either ID type without caring about the underlying data source.
"""

import logging
from typing import Optional

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

# { mlbam_id(int) -> { fangraphs_id, fullName, team_abbr, position, active } }
_map_by_mlbam: dict[int, dict] = {}
# { fangraphs_id(int) -> mlbam_id }
_map_by_fg: dict[int, int] = {}
# { "lastname, firstname" -> [mlbam_id, ...] }
_map_by_name: dict[str, list[int]] = {}


async def build_map() -> None:
    """Fetch all active MLB players and build the ID cross-reference table."""
    logger.info("Building player ID map...")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.MLB_API_BASE_URL}/sports/1/players",
                params={"season": settings.CURRENT_SEASON, "gameType": "R"},
            )
            resp.raise_for_status()
            people = resp.json().get("people", [])

        for p in people:
            mid = p.get("id")
            if not mid:
                continue
            full = p.get("fullName", "")
            last = p.get("lastName", "")
            first = p.get("firstName", "")
            pos = p.get("primaryPosition", {}).get("abbreviation", "")
            team = p.get("currentTeam", {}).get("abbreviation", "")

            _map_by_mlbam[mid] = {
                "mlbam_id": mid,
                "fangraphs_id": None,  # populated below via pybaseball
                "fullName": full,
                "firstName": first,
                "lastName": last,
                "team_abbr": team,
                "position": pos,
                "active": p.get("active", True),
            }
            name_key = f"{last.lower()},{first.lower()}"
            _map_by_name.setdefault(name_key, []).append(mid)

        logger.info(f"Player ID map loaded: {len(_map_by_mlbam)} players")
    except Exception as exc:
        logger.warning(f"Could not build player ID map: {exc}")

    # Enrich with FanGraphs IDs from Chadwick Bureau register
    try:
        from app.services.fangraphs_service import build_mlbam_to_fangraphs_map
        mlb_to_fg = build_mlbam_to_fangraphs_map()
        count = 0
        for mlbam_id, info in _map_by_mlbam.items():
            fg_id = mlb_to_fg.get(mlbam_id)
            if fg_id:
                info["fangraphs_id"] = fg_id
                _map_by_fg[fg_id] = mlbam_id
                count += 1
        logger.info(f"Chadwick cross-reference: {count}/{len(_map_by_mlbam)} players matched")
    except Exception as exc:
        logger.warning(f"Could not enrich player map with Chadwick IDs: {exc}")


def get_player_info(mlbam_id: int) -> Optional[dict]:
    return _map_by_mlbam.get(mlbam_id)


def get_fangraphs_id(mlbam_id: int) -> Optional[int]:
    info = _map_by_mlbam.get(mlbam_id)
    return info.get("fangraphs_id") if info else None


def get_mlbam_id(fangraphs_id: int) -> Optional[int]:
    return _map_by_fg.get(fangraphs_id)


def lookup_by_name(query: str) -> list[dict]:
    """Return up to 10 players matching query against full name, last name, or first name."""
    q = query.lower().strip()
    if not q:
        return []

    exact: list[dict] = []
    partial: list[dict] = []

    for info in _map_by_mlbam.values():
        full = info["fullName"].lower()
        last = info.get("lastName", "").lower()
        first = info.get("firstName", "").lower()

        if full.startswith(q) or last.startswith(q):
            exact.append(info)
        elif first.startswith(q) or q in full:
            partial.append(info)

        if len(exact) >= 10:
            break

    results = exact + partial
    if len(results) < 5:
        # Fall back to Chadwick for historical/retired players not in active roster
        results += _lookup_historical(q, exclude_mlbam={r["mlbam_id"] for r in results})

    seen: set[int] = set()
    unique = []
    for r in results:
        if r["mlbam_id"] not in seen:
            seen.add(r["mlbam_id"])
            unique.append(r)
        if len(unique) >= 10:
            break
    return unique


def _lookup_historical(query: str, exclude_mlbam: set = frozenset()) -> list[dict]:
    """Search the Chadwick register for retired / historical players."""
    try:
        import pandas as pd
        from app.services.fangraphs_service import get_chadwick_register
        from app.services.mlb_api_service import headshot_url
        df = get_chadwick_register()
        if df.empty:
            return []

        q = query.lower().strip()
        last_col = df["name_last"].str.lower() if "name_last" in df.columns else pd.Series(dtype=str)
        first_col = df["name_first"].str.lower() if "name_first" in df.columns else pd.Series(dtype=str)

        mask = last_col.str.startswith(q, na=False) | (first_col + " " + last_col).str.startswith(q, na=False)
        matches = df[mask].dropna(subset=["key_mlbam"]).head(10)

        results = []
        for _, row in matches.iterrows():
            mlbam = int(float(row["key_mlbam"]))
            if mlbam in exclude_mlbam:
                continue
            fg_id = row.get("key_fangraphs")
            results.append({
                "mlbam_id": mlbam,
                "fangraphs_id": int(float(fg_id)) if fg_id and str(fg_id) not in ("", "nan") else None,
                "fullName": f"{row.get('name_first', '')} {row.get('name_last', '')}".strip(),
                "firstName": str(row.get("name_first", "")),
                "lastName": str(row.get("name_last", "")),
                "team_abbr": "",
                "position": "",
                "active": False,
                "headshot_url": headshot_url(mlbam),
            })
        return results
    except Exception as exc:
        logger.warning(f"Historical player lookup failed: {exc}")
        return []


def all_players() -> list[dict]:
    return list(_map_by_mlbam.values())
