from __future__ import annotations

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    MLB_API_BASE_URL: str = "https://statsapi.mlb.com/api/v1"
    CURRENT_SEASON: int = 2025
    MIN_SEASONS_FOR_PARK_FACTOR: int = 3  # rolling 3-year window
    FANGRAPHS_CACHE_TTL_HOURS: int = 24
    STATCAST_CACHE_DIR: str = "./cache"
    MAX_STATCAST_DAYS_RANGE: int = 365
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    # Set STATCAST_CACHE_DIR=/data/cache in Railway and mount a persistent volume at /data
    STATCAST_CACHE_DIR: str = "./cache"

    class Config:
        env_file = ".env"


settings = Settings()
