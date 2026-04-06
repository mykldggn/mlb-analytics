from __future__ import annotations

from fastapi import HTTPException


class PlayerNotFoundError(HTTPException):
    def __init__(self, player_id: int | str):
        super().__init__(status_code=404, detail=f"Player {player_id} not found")


class DataSourceError(HTTPException):
    def __init__(self, source: str, detail: str):
        super().__init__(status_code=502, detail=f"{source} error: {detail}")


class CacheError(Exception):
    pass


class JobNotFoundError(HTTPException):
    def __init__(self, job_id: str):
        super().__init__(status_code=404, detail=f"Job {job_id} not found")
