from __future__ import annotations

from fastapi import APIRouter, Query
from typing import Optional

from app.config import settings
from app.services import fangraphs_service, statcast_service
from app.services.mlb_api_service import headshot_url

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])

BATTING_POSITIONS = {"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH"}
PITCHING_ROLES = {"SP", "RP"}


def _paginate(records: list, page: int, page_size: int):
    start = (page - 1) * page_size
    return records[start: start + page_size], len(records)


def _normalize_team(team) -> str | None:
    """Normalize team value — FanGraphs uses '- - -' for multi-team seasons; display as 'TOT'."""
    if team is None or (isinstance(team, float) and team != team):
        return None
    s = str(team).strip()
    if not s or s == "- - -" or s == "---":
        return "TOT"
    return s


@router.get("/batting/{season}")
async def batting_leaderboard(
    season: int,
    sort_by: str = Query(default="war"),
    order: str = Query(default="desc"),
    min_pa: int = Query(default=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=200),
):
    df = fangraphs_service.get_batting_stats(season, min_pa=min_pa)
    if df.empty:
        return {"data": [], "total": 0, "page": page, "page_size": page_size, "sort_by": sort_by, "season": season}

    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(order == "asc"), na_position="last")

    records = df.to_dict(orient="records")
    page_data, total = _paginate(records, page, page_size)

    entries = []
    for r in page_data:
        mid = r.get("mlbam_id")
        entries.append({
            "mlbam_id": int(mid) if mid and mid == mid else None,
            "fangraphs_id": r.get("fangraphs_id"),
            "player_name": r.get("name", ""),
            "team": _normalize_team(r.get("team")),
            "headshot_url": headshot_url(int(mid)) if mid and mid == mid else None,
            "stats": {k: (None if v != v else v) for k, v in r.items() if k not in ("name", "team", "mlbam_id", "fangraphs_id")},
        })

    return {"data": entries, "total": total, "page": page, "page_size": page_size, "sort_by": sort_by, "season": season}


@router.get("/pitching/{season}")
async def pitching_leaderboard(
    season: int,
    sort_by: str = Query(default="war"),
    order: str = Query(default="desc"),
    min_ip: int = Query(default=40),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, le=200),
):
    df = fangraphs_service.get_pitching_stats(season, min_ip=min_ip)
    if df.empty:
        return {"data": [], "total": 0, "page": page, "page_size": page_size, "sort_by": sort_by, "season": season}

    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(order == "asc"), na_position="last")

    records = df.to_dict(orient="records")
    page_data, total = _paginate(records, page, page_size)

    entries = []
    for r in page_data:
        mid = r.get("mlbam_id")
        entries.append({
            "mlbam_id": int(mid) if mid and mid == mid else None,
            "fangraphs_id": r.get("fangraphs_id"),
            "player_name": r.get("name", ""),
            "team": _normalize_team(r.get("team")),
            "headshot_url": headshot_url(int(mid)) if mid and mid == mid else None,
            "stats": {k: (None if v != v else v) for k, v in r.items() if k not in ("name", "team", "mlbam_id", "fangraphs_id")},
        })

    return {"data": entries, "total": total, "page": page, "page_size": page_size, "sort_by": sort_by, "season": season}


@router.get("/sprint-speed/{season}")
async def sprint_speed_leaderboard(season: int):
    data = await statcast_service.get_sprint_speed_leaderboard(season)
    return {"season": season, "data": data}
