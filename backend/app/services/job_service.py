from __future__ import annotations

"""
Background job service for expensive Statcast queries.
Returns a job_id immediately; frontend polls /jobs/{job_id} for status.
"""

import asyncio
import logging
import time
import uuid
from typing import Any, Optional

from app.core import cache

logger = logging.getLogger(__name__)

_jobs: dict[str, dict] = {}


def create_job(job_type: str, params: dict) -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "id": job_id,
        "type": job_type,
        "status": "pending",
        "progress": 0,
        "created_at": time.time(),
        "params": params,
        "result_key": None,
        "error": None,
    }
    return job_id


def get_job(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)


def get_job_result(job_id: str) -> Optional[list]:
    job = _jobs.get(job_id)
    if not job or job["status"] != "complete":
        return None
    df = cache.disk_load(job["result_key"])
    return df.to_dict(orient="records") if df is not None else []


async def run_batter_statcast_job(job_id: str, mlbam_id: int, start_dt: str, end_dt: str):
    from app.services.statcast_service import get_batter_statcast, aggregate_batter_statcast

    job = _jobs.get(job_id)
    if not job:
        return
    job["status"] = "running"
    job["progress"] = 10
    try:
        df = get_batter_statcast(mlbam_id, start_dt, end_dt)
        job["progress"] = 80
        agg = aggregate_batter_statcast(df)
        result_key = f"job_result_{job_id}"
        import pandas as pd
        cache.disk_save(result_key, pd.DataFrame([agg]))
        job["result_key"] = result_key
        job["status"] = "complete"
        job["progress"] = 100
        logger.info(f"Batter Statcast job {job_id} complete")
    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)
        logger.error(f"Batter Statcast job {job_id} failed: {exc}")


async def run_pitcher_statcast_job(job_id: str, mlbam_id: int, start_dt: str, end_dt: str):
    from app.services.statcast_service import get_pitcher_statcast, aggregate_pitcher_statcast

    job = _jobs.get(job_id)
    if not job:
        return
    job["status"] = "running"
    job["progress"] = 10
    try:
        df = get_pitcher_statcast(mlbam_id, start_dt, end_dt)
        job["progress"] = 80
        agg = aggregate_pitcher_statcast(df)
        result_key = f"job_result_{job_id}"
        import pandas as pd
        cache.disk_save(result_key, pd.DataFrame([agg]))
        job["result_key"] = result_key
        job["status"] = "complete"
        job["progress"] = 100
        logger.info(f"Pitcher Statcast job {job_id} complete")
    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)
        logger.error(f"Pitcher Statcast job {job_id} failed: {exc}")
