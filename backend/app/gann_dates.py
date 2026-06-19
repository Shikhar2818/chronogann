"""
Gann calendar-day cycle date utilities for ChronoGann.

Cycle lengths (30, 60, 90, 360, etc.) are always CALENDAR days from the anchor.
Trading-day adjustment is applied only after the raw date is calculated.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Set

import pandas as pd


def normalize_anchor_datetime(anchor_date: datetime) -> datetime:
    """Normalize anchor to midnight. The anchor date is day 0."""
    return pd.Timestamp(anchor_date).normalize().to_pydatetime()


def project_raw_cycle_date(anchor_date: datetime, cycle_days: int) -> datetime:
    """
    Project the raw Gann cycle landing date using exact calendar days.

    Rules:
    - Anchor date is day 0
    - Add cycle_days as calendar days (not trading sessions)
    - Example: 2025-04-07 + 360 -> 2026-04-02
    """
    anchor = pd.Timestamp(anchor_date).normalize()
    return (anchor + pd.Timedelta(days=int(cycle_days))).to_pydatetime()


def find_nearest_trading_day(
    target: datetime,
    trading_dates: Set[date],
    direction: str,
    max_search_days: int = 30,
) -> Optional[datetime]:
    """Find the nearest trading day before ('prev') or after ('next') target."""
    if not trading_dates:
        return target

    date_only = pd.Timestamp(target).date()
    for i in range(1, max_search_days + 1):
        test = date_only + timedelta(days=i if direction == "next" else -i)
        if test in trading_dates:
            return datetime.combine(test, datetime.min.time())
    return None


def build_trading_adjustment(
    raw_date: datetime,
    trading_dates: Set[date],
) -> Dict:
    """
    Convert a raw calendar cycle date into a trading-day window.

    If raw_date is a trading day, all window fields equal that date.
    Otherwise, previous and next trading days bound the reaction window.
    """
    raw_ts = pd.Timestamp(raw_date).normalize()
    raw_dt = raw_ts.to_pydatetime()

    if not trading_dates:
        return {
            "center": raw_dt,
            "previous_trading_day": raw_dt,
            "next_trading_day": raw_dt,
            "zone_start": raw_dt,
            "zone_end": raw_dt,
            "adjustment_type": "exact",
        }

    date_only = raw_ts.date()
    if date_only in trading_dates:
        return {
            "center": raw_dt,
            "previous_trading_day": raw_dt,
            "next_trading_day": raw_dt,
            "zone_start": raw_dt,
            "zone_end": raw_dt,
            "adjustment_type": "exact",
        }

    prev_td = find_nearest_trading_day(raw_dt, trading_dates, "prev")
    next_td = find_nearest_trading_day(raw_dt, trading_dates, "next")
    center = prev_td or next_td or raw_dt
    zone_start = prev_td or center
    zone_end = next_td or center

    return {
        "center": center,
        "previous_trading_day": prev_td,
        "next_trading_day": next_td,
        "zone_start": zone_start,
        "zone_end": zone_end,
        "adjustment_type": "reaction_zone",
    }


def get_tolerance_trading_window(
    center_date: datetime,
    trading_dates: Set[date],
    sorted_trading_timestamps: List[pd.Timestamp],
    tolerance_days: int,
) -> List[datetime]:
    """Return ±N trading days around center_date for reaction validation."""
    if tolerance_days <= 0:
        ts = pd.Timestamp(center_date).normalize()
        if ts.date() in trading_dates:
            return [ts.to_pydatetime()]
        return []

    if not trading_dates:
        return [
            center_date + timedelta(days=d)
            for d in range(-tolerance_days, tolerance_days + 1)
        ]

    center_ts = pd.Timestamp(center_date).normalize()
    if center_ts not in sorted_trading_timestamps:
        diffs = [(abs((d - center_ts).days), d) for d in sorted_trading_timestamps]
        center_ts = min(diffs, key=lambda x: x[0])[1]

    idx = sorted_trading_timestamps.index(center_ts)
    dates: List[datetime] = [center_ts.to_pydatetime()]

    before = idx - 1
    after = idx + 1
    added = 0
    while added < tolerance_days and (before >= 0 or after < len(sorted_trading_timestamps)):
        if before >= 0:
            dates.append(sorted_trading_timestamps[before].to_pydatetime())
            before -= 1
            added += 1
        if added >= tolerance_days:
            break
        if after < len(sorted_trading_timestamps):
            dates.append(sorted_trading_timestamps[after].to_pydatetime())
            after += 1
            added += 1

    return sorted(set(dates))


def project_gann_cycle(
    anchor_date: datetime,
    cycle_days: int,
    trading_dates: Optional[Set[date]] = None,
    sorted_trading_timestamps: Optional[List[pd.Timestamp]] = None,
    tolerance_days: int = 0,
) -> Dict:
    """
    Single source of truth for Gann cycle projection.

    1. Raw date = anchor + cycle_days (calendar days)
    2. Trading adjustment applied only after raw date is known
    3. Optional tolerance window for reaction checks (trading days)
    """
    anchor_norm = normalize_anchor_datetime(anchor_date)
    raw_date = project_raw_cycle_date(anchor_norm, cycle_days)
    trading_dates = trading_dates or set()
    zone = build_trading_adjustment(raw_date, trading_dates)

    dates_to_check: List[datetime] = []
    if tolerance_days > 0 and sorted_trading_timestamps is not None:
        dates_to_check = get_tolerance_trading_window(
            zone["center"],
            trading_dates,
            sorted_trading_timestamps,
            tolerance_days,
        )

    return {
        "cycle_length": cycle_days,
        "anchor_date": anchor_norm,
        "projected_date": raw_date,
        "adjusted_date": zone["center"],
        "adjustment_type": zone["adjustment_type"],
        "reaction_zone": zone,
        "dates_to_check": dates_to_check,
    }


def raw_dates_within_tolerance(date_a: datetime, date_b: datetime, tolerance_days: int) -> bool:
    """True when two raw calendar cycle dates fall within ±tolerance calendar days."""
    delta = abs((pd.Timestamp(date_a).normalize() - pd.Timestamp(date_b).normalize()).days)
    return delta <= tolerance_days
