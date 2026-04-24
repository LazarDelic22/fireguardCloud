"""Background weather polling.

Every hour the scheduler runs a risk computation for each city in CITIES,
using the same pipeline as the HTTP route. Results are persisted and
broadcast via SSE so connected browsers see new markers appear live.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.db import Run, open_db

logger = logging.getLogger(__name__)

# Watchlist of cities polled on the background schedule.
# Tuple shape: (name, country, lat, lon).
CITIES: list[tuple[str, str, float, float]] = [
    ("Bergen", "Norway", 60.39, 5.32),
    ("Oslo", "Norway", 59.91, 10.75),
    ("Trondheim", "Norway", 63.43, 10.39),
    ("London", "United Kingdom", 51.51, -0.13),
    ("Madrid", "Spain", 40.42, -3.70),
    ("Athens", "Greece", 37.98, 23.73),
    ("Los Angeles", "United States", 34.05, -118.24),
    ("Mexico City", "Mexico", 19.43, -99.13),
    ("Cape Town", "South Africa", -33.92, 18.42),
    ("Santiago", "Chile", -33.45, -70.67),
    ("Sydney", "Australia", -33.87, 151.21),
    ("Perth", "Australia", -31.95, 115.86),
    ("Tokyo", "Japan", 35.68, 139.65),
    ("Sao Paulo", "Brazil", -23.55, -46.64),
]

# Interval between full sweeps across all cities.
INTERVAL_MINUTES = 60

# Callback signature matches `compute_and_store_location_run` in main.py.
LocationRunFn = Callable[..., Awaitable[Run]]

_scheduler: AsyncIOScheduler | None = None


async def _run_all_cities(run_fn: LocationRunFn) -> None:
    for name, _country, lat, lon in CITIES:
        db = open_db()
        try:
            await run_fn(db, lat, lon, source="scheduled")
            logger.info("Scheduled risk run ok: %s (%s, %s)", name, lat, lon)
        except Exception:  # noqa: BLE001
            # One city failing (e.g. MET flaking) must not kill the loop.
            logger.exception("Scheduled risk run failed for %s", name)
        finally:
            db.close()


def start_scheduler(run_fn: LocationRunFn) -> None:
    """Start the hourly background poll. Safe to call once per process."""
    global _scheduler
    if _scheduler is not None:
        return

    loop = asyncio.get_event_loop()
    _scheduler = AsyncIOScheduler(event_loop=loop)
    _scheduler.add_job(
        _run_all_cities,
        trigger=IntervalTrigger(minutes=INTERVAL_MINUTES),
        args=[run_fn],
        id="poll_cities",
        next_run_time=None,  # Don't fire immediately on boot; first tick after the interval.
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started: polling %d cities every %d minutes", len(CITIES), INTERVAL_MINUTES)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
