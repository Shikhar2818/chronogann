"""
Cycle Date Projector — lightweight Gann calendar-day projection and convergence.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Set

import pandas as pd

from app.gann_dates import (
    build_trading_adjustment,
    project_gann_cycle,
    project_raw_cycle_date,
    normalize_anchor_datetime,
    raw_dates_within_tolerance,
)
from app.market_calendar import (
    CORE_CYCLES,
    EXTENDED_CYCLES,
    get_trading_calendar,
    adjustment_note,
)


def _project_anchor(
    anchor_date: datetime,
    cycles: List[int],
    trading_dates: Set,
    calendar_label: str,
    calendar_source: str,
    market_type: str,
    symbol: Optional[str],
    anchor_index: int,
    future_only: bool,
) -> Dict:
    anchor_norm = normalize_anchor_datetime(anchor_date)
    now = pd.Timestamp.now().normalize()
    projections: List[Dict] = []

    for cycle in sorted(cycles):
        raw = project_raw_cycle_date(anchor_norm, cycle)
        proj = project_gann_cycle(anchor_norm, cycle, trading_dates=trading_dates)
        zone = proj["reaction_zone"]
        raw_ts = pd.Timestamp(raw).normalize()
        adj_ts = pd.Timestamp(proj["adjusted_date"]).normalize()

        if future_only and raw_ts < now:
            continue

        projections.append({
            "anchor_index": anchor_index,
            "cycle_length": cycle,
            "projected_date": raw_ts.to_pydatetime(),
            "projected_date_str": raw_ts.strftime("%Y-%m-%d"),
            "adjusted_date": adj_ts.to_pydatetime(),
            "adjusted_date_str": adj_ts.strftime("%Y-%m-%d"),
            "zone_start": zone.get("zone_start"),
            "zone_end": zone.get("zone_end"),
            "zone_start_str": (
                pd.Timestamp(zone["zone_start"]).strftime("%Y-%m-%d")
                if zone.get("zone_start")
                else adj_ts.strftime("%Y-%m-%d")
            ),
            "zone_end_str": (
                pd.Timestamp(zone["zone_end"]).strftime("%Y-%m-%d")
                if zone.get("zone_end")
                else adj_ts.strftime("%Y-%m-%d")
            ),
            "adjustment_type": proj["adjustment_type"],
            "adjustment_note": adjustment_note(zone, raw),
            "is_future": raw_ts >= now,
            "is_past": raw_ts < now,
            "days_from_anchor": cycle,
            "days_from_today": (raw_ts - now).days,
        })

    return {
        "anchor_index": anchor_index,
        "anchor_date": anchor_norm.strftime("%Y-%m-%d"),
        "symbol": symbol or "",
        "market_type": market_type,
        "calendar_label": calendar_label,
        "calendar_source": calendar_source,
        "projections": projections,
        "projection_count": len(projections),
    }


def project_cycle_dates(
    anchor_date: datetime,
    cycles: List[int],
    market_type: str,
    symbol: Optional[str] = None,
    future_only: bool = False,
) -> Dict:
    """Single-anchor projection (backward compatible)."""
    result = project_multi_anchor(
        anchor_dates=[anchor_date],
        cycles=cycles,
        market_type=market_type,
        symbol=symbol,
        tolerance_days=0,
        future_only=future_only,
    )
    anchor = result["anchors"][0]
    return {
        "anchor_date": anchor["anchor_date"],
        "symbol": result["symbol"],
        "market_type": result["market_type"],
        "calendar_label": result["calendar_label"],
        "calendar_source": result["calendar_source"],
        "cycles_used": result["cycles_used"],
        "future_only": future_only,
        "projections": anchor["projections"],
        "projection_count": anchor["projection_count"],
    }


def find_convergence_zones(
    anchor_results: List[Dict],
    trading_dates: Set,
    tolerance_days: int,
) -> List[Dict]:
    """
    Cluster raw calendar projections across anchors and return convergence zones.
    Requires projections from at least two different anchors.
    """
    events: List[Dict] = []
    for anchor_result in anchor_results:
        anchor_index = anchor_result["anchor_index"]
        anchor_date = anchor_result["anchor_date"]
        for proj in anchor_result["projections"]:
            events.append({
                "anchor_index": anchor_index,
                "anchor_date": anchor_date,
                "cycle_length": proj["cycle_length"],
                "raw_date": pd.Timestamp(proj["projected_date"]).normalize(),
                "projected_date_str": proj["projected_date_str"],
                "adjusted_date_str": proj["adjusted_date_str"],
                "zone_start_str": proj["zone_start_str"],
                "zone_end_str": proj["zone_end_str"],
            })

    if len(events) < 2:
        return []

    events.sort(key=lambda e: e["raw_date"])
    clusters: List[List[Dict]] = []
    current: List[Dict] = [events[0]]

    for event in events[1:]:
        cluster_latest = max(e["raw_date"] for e in current)
        if raw_dates_within_tolerance(event["raw_date"], cluster_latest, tolerance_days):
            current.append(event)
        else:
            clusters.append(current)
            current = [event]
    clusters.append(current)

    zones: List[Dict] = []
    for cluster in clusters:
        unique_anchors = {e["anchor_index"] for e in cluster}
        if len(unique_anchors) < 2:
            continue

        raw_dates = [e["raw_date"] for e in cluster]
        raw_center = min(raw_dates)
        spread = (max(raw_dates) - min(raw_dates)).days
        match_status = "exact" if spread == 0 else "near_match"

        trading_zone = build_trading_adjustment(raw_center.to_pydatetime(), trading_dates)
        center = trading_zone["center"]
        zone_start = trading_zone["zone_start"]
        zone_end = trading_zone["zone_end"]

        anchor_count = len(unique_anchors)
        if anchor_count >= 3:
            strength = "triple"
            strength_label = "Triple convergence (3 anchors)"
        else:
            strength = "dual"
            strength_label = "Dual convergence (2 anchors)"

        overlaps = []
        for e in cluster:
            overlaps.append({
                "anchor_index": e["anchor_index"],
                "anchor_date": e["anchor_date"],
                "cycle_length": e["cycle_length"],
                "projected_date_str": e["projected_date_str"],
                "adjusted_date_str": e["adjusted_date_str"],
            })

        cycles_involved = sorted({e["cycle_length"] for e in cluster})
        anchors_involved = sorted({e["anchor_date"] for e in cluster})

        zones.append({
            "convergence_date": raw_center.to_pydatetime(),
            "convergence_date_str": raw_center.strftime("%Y-%m-%d"),
            "adjusted_date": center,
            "adjusted_date_str": pd.Timestamp(center).strftime("%Y-%m-%d"),
            "zone_start": zone_start,
            "zone_end": zone_end,
            "zone_start_str": pd.Timestamp(zone_start).strftime("%Y-%m-%d"),
            "zone_end_str": pd.Timestamp(zone_end).strftime("%Y-%m-%d"),
            "match_status": match_status,
            "spread_days": spread,
            "strength": strength,
            "strength_label": strength_label,
            "anchor_count": anchor_count,
            "cycle_count": len(cluster),
            "cycles_involved": cycles_involved,
            "anchors_involved": anchors_involved,
            "tolerance_days": tolerance_days,
            "overlaps": overlaps,
            "confluence_score": min(100, anchor_count * 30 + len(cluster) * 10 + (10 if match_status == "exact" else 0)),
        })

    return sorted(zones, key=lambda z: (-z["confluence_score"], z["convergence_date_str"]))


def project_multi_anchor(
    anchor_dates: List[datetime],
    cycles: List[int],
    market_type: str,
    symbol: Optional[str] = None,
    tolerance_days: int = 0,
    future_only: bool = False,
) -> Dict:
    """
    Project Gann cycle dates from one or more anchors and detect convergence.
    """
    if not anchor_dates:
        raise ValueError("At least one anchor date is required")

    earliest = min(normalize_anchor_datetime(d) for d in anchor_dates)
    trading_dates, calendar_label, calendar_source = get_trading_calendar(
        market_type, symbol, earliest
    )

    anchor_results: List[Dict] = []
    for idx, anchor_date in enumerate(anchor_dates, start=1):
        anchor_results.append(
            _project_anchor(
                anchor_date=anchor_date,
                cycles=cycles,
                trading_dates=trading_dates,
                calendar_label=calendar_label,
                calendar_source=calendar_source,
                market_type=market_type,
                symbol=symbol,
                anchor_index=idx,
                future_only=future_only,
            )
        )

    convergence: List[Dict] = []
    if len(anchor_dates) >= 2:
        convergence = find_convergence_zones(anchor_results, trading_dates, tolerance_days)

    total_projections = sum(a["projection_count"] for a in anchor_results)

    return {
        "anchor_count": len(anchor_dates),
        "anchor_dates": [a["anchor_date"] for a in anchor_results],
        "anchors": anchor_results,
        "symbol": symbol or "",
        "market_type": market_type,
        "calendar_label": calendar_label,
        "calendar_source": calendar_source,
        "cycles_used": cycles,
        "tolerance_days": tolerance_days,
        "future_only": future_only,
        "convergence": convergence,
        "convergence_count": len(convergence),
        "projection_count": total_projections,
        # Legacy single-anchor fields
        "anchor_date": anchor_results[0]["anchor_date"],
        "projections": anchor_results[0]["projections"],
    }


def default_cycles(preset: str = "core", custom: Optional[List[int]] = None) -> List[int]:
    if custom:
        return sorted(set(int(c) for c in custom if c > 0))
    if preset == "extended":
        return sorted(set(CORE_CYCLES + EXTENDED_CYCLES))
    return list(CORE_CYCLES)
