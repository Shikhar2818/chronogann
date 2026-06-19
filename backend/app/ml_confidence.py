"""
ML Confidence Engine — scores probability of meaningful cycle reaction.
Does NOT predict prices or generate trading signals.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Any

import numpy as np
import pandas as pd

from app.ml_features import (
    FEATURE_COLUMNS,
    build_feature_row,
    infer_asset_type,
    indicators_at_date,
    row_to_vector,
    confidence_label,
    feature_display_names,
)
from app.training_pipeline import load_model_artifact, load_metrics


def _confluence_count_for_date(
    target_date: pd.Timestamp,
    confluence_zones: Optional[List[Dict]],
    tolerance_days: int,
) -> int:
    if not confluence_zones:
        return 1
    count = 0
    for zone in confluence_zones:
        zs = pd.Timestamp(zone.get("zone_start") or zone.get("zone_date"))
        ze = pd.Timestamp(zone.get("zone_end") or zone.get("zone_date"))
        if zs - pd.Timedelta(days=tolerance_days) <= target_date <= ze + pd.Timedelta(days=tolerance_days):
            count = max(count, zone.get("overlapping_projections", zone.get("anchor_count", 2)))
    return max(1, count)


def _feature_contributions(model, feature_row: Dict[str, float]) -> Dict[str, List[str]]:
    """Explain score using tree feature importances × feature values (SHAP-free fallback)."""
    names = feature_display_names()
    importances = getattr(model, "feature_importances_", None)
    if importances is None:
        return {"positive": [], "negative": []}

    vector = row_to_vector(feature_row)
    weighted = []
    for i, col in enumerate(FEATURE_COLUMNS):
        contribution = float(importances[i] * vector[i])
        weighted.append((col, contribution, names.get(col, col)))

    weighted.sort(key=lambda x: abs(x[1]), reverse=True)
    positive = [f"{label}" for _, c, label in weighted if c > 0][:4]
    negative = [f"{label}" for _, c, label in weighted if c < 0][:3]

    # User-friendly phrasing
    friendly_pos = []
    for col, _, label in sorted([(w[0], w[1], w[2]) for w in weighted if w[1] > 0], key=lambda x: -x[1])[:4]:
        if col == "cycle_length":
            friendly_pos.append(f"{int(feature_row['cycle_length'])}-Day Cycle")
        elif col == "confluence_count" and feature_row["confluence_count"] >= 2:
            friendly_pos.append("High Confluence")
        elif col == "macd_bullish" and feature_row.get("macd_bullish"):
            friendly_pos.append("Bullish MACD")
        elif col == "rsi":
            rsi = feature_row["rsi"]
            if rsi < 35:
                friendly_pos.append("Oversold RSI")
            elif rsi > 65:
                friendly_pos.append("Overbought RSI")
            else:
                friendly_pos.append(f"RSI at {rsi:.0f}")
        elif col == "historical_reliability" and feature_row["historical_reliability"] > 55:
            friendly_pos.append("Strong Historical Reliability")
        elif col == "volume_ratio" and feature_row["volume_ratio"] > 1.2:
            friendly_pos.append("Elevated Volume")
        else:
            friendly_pos.append(label)

    friendly_neg = []
    for col, _, label in sorted([(w[0], w[1], w[2]) for w in weighted if w[1] < 0], key=lambda x: x[1])[:3]:
        if col == "volume_ratio" and feature_row["volume_ratio"] < 0.9:
            friendly_neg.append("Low Volume")
        elif col == "historical_reliability" and feature_row["historical_reliability"] < 40:
            friendly_neg.append("Weak Historical Reliability")
        elif col == "confluence_count" and feature_row["confluence_count"] < 2:
            friendly_neg.append("Low Confluence")
        else:
            friendly_neg.append(label)

    return {
        "positive": friendly_pos or positive,
        "negative": friendly_neg or negative,
    }


def score_cycle_setup(
    ohlcv_df: pd.DataFrame,
    symbol: str,
    *,
    cycle_length: int,
    anchor_type: str,
    target_date: datetime,
    tolerance_days: int = 2,
    confluence_zones: Optional[List[Dict]] = None,
    historical_reliability: float = 50.0,
    indicator_snapshot: Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Score a single cycle setup. Called AFTER cycle projection and technical confirmation.
    """
    artifact = load_model_artifact()
    if artifact is None:
        return {
            "available": False,
            "message": "ML model not trained. Run training from the research panel.",
            "reaction_probability": None,
            "confidence_label": None,
            "historical_reliability": historical_reliability,
        }

    model = artifact["model"]
    as_of = pd.Timestamp(target_date).normalize()
    snap = indicator_snapshot or indicators_at_date(ohlcv_df, as_of)
    if snap.get("error"):
        snap = indicators_at_date(ohlcv_df, pd.Timestamp.now().normalize())

    conf_count = _confluence_count_for_date(as_of, confluence_zones, tolerance_days)

    feature_row = build_feature_row(
        cycle_length=cycle_length,
        anchor_type=anchor_type,
        confluence_count=conf_count,
        tolerance_days=tolerance_days,
        indicator_snapshot=snap,
        historical_reliability=historical_reliability,
        asset_type=infer_asset_type(symbol),
    )

    X = row_to_vector(feature_row).reshape(1, -1)
    proba = float(model.predict_proba(X)[0, 1])
    label = confidence_label(proba)
    contributions = _feature_contributions(model, feature_row)

    metrics = load_metrics() or {}
    return {
        "available": True,
        "reaction_probability": round(proba * 100, 1),
        "confidence_label": label,
        "historical_reliability": round(historical_reliability, 1),
        "model_type": artifact.get("model_type", "unknown"),
        "model_metrics": metrics.get("metrics", artifact.get("metrics", {})),
        "strong_contributors": contributions["positive"],
        "weak_contributors": contributions["negative"],
        "disclaimer": (
            "This estimates the probability of a meaningful time-cycle reaction based on "
            "historical cycle behavior — not a price prediction or trade signal."
        ),
    }


def score_analysis(
    ohlcv_df: pd.DataFrame,
    symbol: str,
    projections: List[Dict],
    anchors: List[Dict],
    *,
    tolerance_days: int = 2,
    confluence_zones: Optional[List[Dict]] = None,
    cycle_reliability: Optional[Dict[str, float]] = None,
    indicator_snapshot: Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Score the primary upcoming (or most recent) cycle setup for the analysis.
    """
    if not projections:
        return {"available": False, "message": "No projections to score."}

    now = pd.Timestamp.now()
    future = [p for p in projections if pd.Timestamp(p["adjusted_date"]) >= now]
    target_proj = future[0] if future else projections[-1]

    anchor = anchors[0] if anchors else {}
    anchor_type = anchor.get("anchor_type", "low")
    cycle_len = target_proj.get("cycle_length", 90)
    target_date = target_proj.get("adjusted_date", now)

    rel = 50.0
    if cycle_reliability:
        rel = cycle_reliability.get(str(cycle_len), 50.0)

    return score_cycle_setup(
        ohlcv_df,
        symbol,
        cycle_length=cycle_len,
        anchor_type=anchor_type,
        target_date=target_date,
        tolerance_days=tolerance_days,
        confluence_zones=confluence_zones,
        historical_reliability=rel,
        indicator_snapshot=indicator_snapshot,
    )
