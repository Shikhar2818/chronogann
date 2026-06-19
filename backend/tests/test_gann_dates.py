"""Tests for Gann calendar-day cycle projection."""
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.gann_dates import (
    project_raw_cycle_date,
    project_gann_cycle,
    build_trading_adjustment,
    raw_dates_within_tolerance,
)
from app.cycle_engine import CycleAnalyzer, attach_anchor_metadata, anchor_from_date
from app.data_service import DataService


def test_360_day_cycle_from_april_7_2025():
    anchor = datetime(2025, 4, 7)
    raw = project_raw_cycle_date(anchor, 360)
    assert raw.date() == datetime(2026, 4, 2).date()


def test_core_cycle_calendar_dates():
    anchor = datetime(2025, 4, 7)
    expected = {
        30: datetime(2025, 5, 7),
        60: datetime(2025, 6, 6),
        90: datetime(2025, 7, 6),
        120: datetime(2025, 8, 5),
        180: datetime(2025, 10, 4),
        240: datetime(2025, 12, 3),
        270: datetime(2026, 1, 2),
        360: datetime(2026, 4, 2),
    }
    for cycle, exp in expected.items():
        assert project_raw_cycle_date(anchor, cycle).date() == exp.date()


def test_trading_adjustment_on_weekend():
    trading_dates = {
        datetime(2026, 4, 3).date(),
        datetime(2026, 4, 6).date(),
    }
    raw = datetime(2026, 4, 4)
    zone = build_trading_adjustment(raw, trading_dates)
    assert zone["adjustment_type"] == "reaction_zone"
    assert zone["zone_start"].date() == datetime(2026, 4, 3).date()
    assert zone["zone_end"].date() == datetime(2026, 4, 6).date()


def test_raw_dates_within_tolerance():
    a = datetime(2026, 4, 2)
    b = datetime(2026, 4, 4)
    assert raw_dates_within_tolerance(a, b, 2) is True
    assert raw_dates_within_tolerance(a, b, 1) is False


def test_project_gann_cycle_returns_raw_before_adjustment():
    trading_dates = {datetime(2026, 4, 2).date()}
    proj = project_gann_cycle(datetime(2025, 4, 7), 360, trading_dates=trading_dates)
    assert proj["projected_date"].date() == datetime(2026, 4, 2).date()
    assert proj["adjusted_date"].date() == datetime(2026, 4, 2).date()
    assert proj["adjustment_type"] == "exact"


def test_cycle_analyzer_matches_calendar_math():
    data = DataService.fetch_yfinance("^NSEI", end_date=datetime.now())
    anchor = anchor_from_date(data, pd.Timestamp("2025-04-07").to_pydatetime())
    analyzer = CycleAnalyzer(data)
    projs = analyzer.project_cycles(anchor["date"], [360], forward_days=730, tolerance_days=2)
    attach_anchor_metadata(projs, anchor)
    assert len(projs) == 1
    assert projs[0]["projected_date"].date() == datetime(2026, 4, 2).date()
    assert projs[0]["projected_date"].date() != datetime(2026, 11, 21).date()


if __name__ == "__main__":
    test_360_day_cycle_from_april_7_2025()
    test_core_cycle_calendar_dates()
    test_trading_adjustment_on_weekend()
    test_raw_dates_within_tolerance()
    test_project_gann_cycle_returns_raw_before_adjustment()
    test_cycle_analyzer_matches_calendar_math()
    print("All tests passed.")
