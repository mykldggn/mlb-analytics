from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path
from threading import Lock
from typing import Any, Optional

import pandas as pd
from cachetools import TTLCache

from app.config import settings

_memory_cache: TTLCache = TTLCache(maxsize=256, ttl=300)
_memory_lock = Lock()


def memory_get(key: str) -> Optional[Any]:
    with _memory_lock:
        return _memory_cache.get(key)


def memory_set(key: str, value: Any) -> None:
    with _memory_lock:
        _memory_cache[key] = value


def _disk_path(key: str) -> Path:
    h = hashlib.md5(key.encode()).hexdigest()
    return Path(settings.STATCAST_CACHE_DIR) / f"{h}.parquet"


def disk_exists(key: str) -> bool:
    return _disk_path(key).exists()


def disk_age_hours(key: str) -> float:
    p = _disk_path(key)
    if not p.exists():
        return float("inf")
    return (time.time() - p.stat().st_mtime) / 3600


def disk_save(key: str, df: pd.DataFrame) -> None:
    Path(settings.STATCAST_CACHE_DIR).mkdir(parents=True, exist_ok=True)
    df.to_parquet(_disk_path(key), index=False)


def disk_load(key: str) -> Optional[pd.DataFrame]:
    p = _disk_path(key)
    if not p.exists():
        return None
    return pd.read_parquet(p)


def disk_get_fresh(key: str, ttl_hours: float = 24) -> Optional[pd.DataFrame]:
    if disk_exists(key) and disk_age_hours(key) < ttl_hours:
        return disk_load(key)
    return None
