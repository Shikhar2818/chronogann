"""
Market calendar resolution for cycle date projection.
Uses exchange trading days from market data when available.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd

from app.data_service import DataService

MARKET_LABELS = {
    "india": "India (NSE/BSE)",
    "us": "United States (NYSE/NASDAQ)",
    "forex": "Forex (24h, Mon–Fri sessions)",
    "commodity": "Commodities (exchange calendar)",
    "crypto": "Crypto (7-day calendar)",
}

MARKET_BENCHMARKS = {
    "india": "^NSEI",
    "us": "^GSPC",
    "forex": "EURUSD=X",
    "commodity": "GC=F",
    "crypto": "BTC-USD",
}

CORE_CYCLES = [30, 60, 90, 120, 180, 240, 270, 360]
EXTENDED_CYCLES = [45, 72, 90, 135, 144, 225, 315, 365, 720]


def resolve_symbol_for_calendar(symbol: Optional[str], market_type: str) -> str:
    if symbol and symbol.strip():
        return DataService.resolve_symbol(symbol.strip())
    return MARKET_BENCHMARKS.get(market_type, "^GSPC")


def _weekday_trading_dates(start: date, end: date) -> Set[date]:
    """Mon–Fri dates for forex-style calendars."""
    dates: Set[date] = set()
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            dates.add(cur)
        cur += timedelta(days=1)
    return dates


def _all_dates(start: date, end: date) -> Set[date]:
    dates: Set[date] = set()
    cur = start
    while cur <= end:
        dates.add(cur)
        cur += timedelta(days=1)
    return dates


def get_trading_calendar(
    market_type: str,
    symbol: Optional[str] = None,
    anchor_date: Optional[datetime] = None,
    forward_years: int = 3,
) -> Tuple[Set[date], str, str]:
    """
    Return trading dates set, calendar label, and data source description.
    """
    market_type = market_type.lower()
    label = MARKET_LABELS.get(market_type, market_type.title())

    anchor = pd.Timestamp(anchor_date or datetime.now()).normalize()
    start = (anchor - pd.Timedelta(days=30)).date()
    end = (anchor + pd.Timedelta(days=forward_years * 366)).date()

    if market_type == "crypto":
        return _all_dates(start, end), label, "7-day crypto calendar (no weekend adjustment)"

    if market_type == "forex":
        return _weekday_trading_dates(start, end), label, "Forex weekday calendar (Mon–Fri)"

    resolved = resolve_symbol_for_calendar(symbol, market_type)
    try:
        data = DataService.fetch_yfinance(
            resolved,
            start_date=datetime.combine(start, datetime.min.time()),
            end_date=datetime.combine(end, datetime.min.time()),
        )
        if DataService.validate_data(data):
            trading = set(pd.to_datetime(data.index).normalize().date)
            src = f"Exchange trading days from {resolved} (includes holidays)"
            return trading, label, src
    except Exception:
        pass

    # Fallback: weekday only
    return _weekday_trading_dates(start, end), label, f"Weekday fallback for {label}"


def adjustment_note(zone: Dict, raw_date: datetime) -> str:
    adj = zone.get("adjustment_type", "exact")
    raw = pd.Timestamp(raw_date).strftime("%Y-%m-%d")
    if adj == "exact":
        return "Falls on a trading day."
    prev_d = zone.get("previous_trading_day")
    next_d = zone.get("next_trading_day")
    prev_s = pd.Timestamp(prev_d).strftime("%Y-%m-%d") if prev_d else "—"
    next_s = pd.Timestamp(next_d).strftime("%Y-%m-%d") if next_d else "—"
    return f"Non-trading day ({raw}). Window: {prev_s} to {next_s}."
