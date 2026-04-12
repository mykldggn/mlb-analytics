from __future__ import annotations

"""
MLB Stats API service — player bio, headshots, rosters, splits, game logs.
All free, no auth required.
"""

import logging
from typing import Optional

import httpx

from app.config import settings
from app.core import cache

logger = logging.getLogger(__name__)

MLB_HEADSHOT_TEMPLATE = (
    "https://img.mlbstatic.com/mlb-photos/image/upload/"
    "d_people:generic:headshot:67:current.png/w_213,q_auto:best/"
    "v1/people/{player_id}/headshot/67/current"
)


def headshot_url(mlbam_id: int) -> str:
    return MLB_HEADSHOT_TEMPLATE.format(player_id=mlbam_id)


def _parse_pct(val) -> Optional[float]:
    """Parse MLB API batting average strings like '.250' → 0.250."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _pct_of_pa(events, pa) -> Optional[float]:
    """Compute rate stat (e.g. K%) from raw counts."""
    try:
        pa_int = int(pa or 0)
        if pa_int <= 0:
            return None
        return round(int(events or 0) / pa_int, 4)
    except (ValueError, TypeError):
        return None


class MLBApiService:
    def __init__(self):
        self.base = settings.MLB_API_BASE_URL
        self._client = httpx.AsyncClient(timeout=15)

    async def get_player(self, mlbam_id: int) -> dict:
        cache_key = f"mlb_player_{mlbam_id}"
        cached = cache.memory_get(cache_key)
        if cached:
            return cached
        resp = await self._client.get(
            f"{self.base}/people/{mlbam_id}",
            params={"hydrate": "currentTeam"},
        )
        resp.raise_for_status()
        data = resp.json().get("people", [{}])[0]
        cache.memory_set(cache_key, data)
        return data

    async def get_player_bio(self, mlbam_id: int) -> dict:
        """Detailed player bio: education, draft info, MLB team history."""
        cache_key = f"mlb_bio_{mlbam_id}"
        cached = cache.memory_get(cache_key)
        if cached:
            return cached
        try:
            resp = await self._client.get(
                f"{self.base}/people/{mlbam_id}",
                params={"hydrate": "education,currentTeam,rosterEntries,stats(type=yearByYear,group=hitting,gameType=R)"},
            )
            if resp.status_code != 200:
                return {}
            data = resp.json().get("people", [{}])[0]
        except Exception:
            return {}

        edu = data.get("education", {})
        hs = edu.get("highschools", [{}])[0] if edu.get("highschools") else {}
        college = edu.get("colleges", [{}])[0] if edu.get("colleges") else {}

        # Build team history from rosterEntries (one entry per team stint)
        team_history = []
        for entry in data.get("rosterEntries", []):
            team = entry.get("team", {})
            abbrev = team.get("abbreviation") or team.get("name", "")
            start = entry.get("startDate", "")[:4]
            end = entry.get("statusDate", "")[:4]
            if abbrev:
                team_history.append({
                    "team": abbrev,
                    "teamName": team.get("name", ""),
                    "startYear": start,
                    "endYear": end,
                })

        # Fall back to year-by-year stats if rosterEntries is empty
        if not team_history:
            stats = data.get("stats", [])
            season_teams: dict = {}
            for sg in stats:
                for split in sg.get("splits", []):
                    season_yr = split.get("season", "")
                    t = split.get("team", {})
                    abbrev = t.get("abbreviation") or t.get("name", "")
                    if season_yr and abbrev:
                        season_teams[season_yr] = abbrev
            # Compress consecutive same-team years
            prev_team, start_yr = None, None
            for yr in sorted(season_teams):
                t = season_teams[yr]
                if t != prev_team:
                    if prev_team:
                        team_history.append({"team": prev_team, "startYear": start_yr, "endYear": str(int(yr) - 1)})
                    prev_team, start_yr = t, yr
            if prev_team:
                team_history.append({"team": prev_team, "startYear": start_yr, "endYear": str(settings.CURRENT_SEASON)})

        result = {
            "highSchool": f"{hs.get('name', '')} ({hs.get('city', '')}, {hs.get('state', '')})" if hs.get("name") else None,
            "college": college.get("name") if college.get("name") else None,
            "draftYear": data.get("draftYear"),
            "birthDate": data.get("birthDate"),
            "birthCity": data.get("birthCity"),
            "birthStateProvince": data.get("birthStateProvince"),
            "birthCountry": data.get("birthCountry"),
            "mlbDebutDate": data.get("mlbDebutDate"),
            "teamHistory": team_history,
        }
        cache.memory_set(cache_key, result)
        return result

    async def get_player_splits(self, mlbam_id: int, season: int, group: str = "hitting") -> list[dict]:
        """L/R splits via statSplits endpoint."""
        try:
            resp = await self._client.get(
                f"{self.base}/people/{mlbam_id}/stats",
                params={
                    "stats": "statSplits",
                    "group": group,
                    "season": season,
                    "sitCodes": "vl,vr,h,a",
                    "gameType": "R",
                },
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
        except Exception:
            return []
        splits_data = resp.json().get("stats", [])

        # For players traded mid-season the API returns one stat group per team stint.
        # Prefer the combined/total splits (stat groups whose individual splits have no
        # "team" association). Fall back to all splits if none are team-less.
        all_splits: list[dict] = []
        combined_splits: list[dict] = []
        for stat_group in splits_data:
            for split in stat_group.get("splits", []):
                all_splits.append(split)
                if not split.get("team"):
                    combined_splits.append(split)

        source = combined_splits if combined_splits else all_splits

        # If there are still duplicates (same split_code appearing from multiple groups),
        # keep only the entry with the highest PA per split_code.
        best: dict[str, dict] = {}
        for split in source:
            code = split.get("split", {}).get("code", "")
            stat = split.get("stat", {})
            pa_count = int(stat.get("plateAppearances") or stat.get("battersFaced") or stat.get("pa") or 0)
            if code not in best or pa_count > int(
                best[code]["stat"].get("plateAppearances") or
                best[code]["stat"].get("battersFaced") or
                best[code]["stat"].get("pa") or 0
            ):
                best[code] = split

        results = []
        for split in best.values():
            stat = split.get("stat", {})
            pa_count = (stat.get("plateAppearances") or stat.get("battersFaced") or stat.get("pa"))
            results.append({
                "split_name": split.get("split", {}).get("description", ""),
                "split_code": split.get("split", {}).get("code", ""),
                "pa": pa_count,
                "avg": _parse_pct(stat.get("avg")),
                "obp": _parse_pct(stat.get("obp")),
                "slg": _parse_pct(stat.get("slg")),
                "ops": _parse_pct(stat.get("ops")),
                "woba": stat.get("woba"),
                "hr": stat.get("homeRuns") or stat.get("hr"),
                "rbi": stat.get("rbi"),
                "k_pct": _pct_of_pa(stat.get("strikeOuts"), pa_count),
                "bb_pct": _pct_of_pa(stat.get("baseOnBalls"), pa_count),
            })
        return results

    async def get_player_game_log(self, mlbam_id: int, season: int, group: str = "hitting") -> list[dict]:
        resp = await self._client.get(
            f"{self.base}/people/{mlbam_id}/stats",
            params={"stats": "gameLog", "group": group, "season": season, "gameType": "R"},
        )
        resp.raise_for_status()
        stats_list = resp.json().get("stats", [])
        results = []
        for sg in stats_list:
            for split in sg.get("splits", []):
                results.append({
                    "date": split.get("date"),
                    "opponent": split.get("opponent", {}).get("abbreviation"),
                    "isHome": split.get("isHome"),
                    **split.get("stat", {}),
                })
        return results

    async def get_pitch_arsenal(self, mlbam_id: int, season: int) -> list[dict]:
        resp = await self._client.get(
            f"{self.base}/people/{mlbam_id}/stats",
            params={"stats": "pitchArsenal", "group": "pitching", "season": season},
        )
        resp.raise_for_status()
        stats_list = resp.json().get("stats", [])
        results = []
        for sg in stats_list:
            for split in sg.get("splits", []):
                results.append(split.get("stat", {}))
        return results

    async def get_teams(self, season: Optional[int] = None) -> list[dict]:
        cache_key = f"mlb_teams_{season or settings.CURRENT_SEASON}"
        cached = cache.memory_get(cache_key)
        if cached:
            return cached
        resp = await self._client.get(
            f"{self.base}/teams",
            params={"sportId": 1, "season": season or settings.CURRENT_SEASON},
        )
        resp.raise_for_status()
        teams = resp.json().get("teams", [])
        cache.memory_set(cache_key, teams)
        return teams

    async def get_roster(self, team_id: int, season: Optional[int] = None) -> list[dict]:
        resp = await self._client.get(
            f"{self.base}/teams/{team_id}/roster",
            params={"rosterType": "active", "season": season or settings.CURRENT_SEASON},
        )
        resp.raise_for_status()
        roster = resp.json().get("roster", [])
        for player in roster:
            pid = player.get("person", {}).get("id")
            if pid:
                player["headshot_url"] = headshot_url(pid)
        return roster

    async def get_standings(self, season: Optional[int] = None) -> list[dict]:
        resp = await self._client.get(
            f"{self.base}/standings",
            params={
                "leagueId": "103,104",
                "season": season or settings.CURRENT_SEASON,
                "standingsTypes": "regularSeason",
            },
        )
        resp.raise_for_status()
        return resp.json().get("records", [])

    async def search_players(self, query: str) -> list[dict]:
        from app.core import player_id_map
        return player_id_map.lookup_by_name(query)

    async def close(self):
        await self._client.aclose()


_mlb_api_service: Optional[MLBApiService] = None


def get_mlb_api_service() -> MLBApiService:
    global _mlb_api_service
    if _mlb_api_service is None:
        _mlb_api_service = MLBApiService()
    return _mlb_api_service
