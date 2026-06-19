"""
Feature engineering for the ML Confidence Engine.
Uses only information available at or before the cycle landing date (no future leakage).
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Any

import numpy as np
import pandas as pd

from app.indicators import TechnicalIndicators
from app.cycle_engine import ReactionType

FEATURE_COLUMNS = [
    "cycle_length",
    "anchor_type_low",
    "confluence_count",
    "rsi",
    "macd_bullish",
    "macd_bearish",
    "volume_ratio",
    "atr_norm",
    "trend_uptrend",
    "trend_downtrend",
    "dist_support_pct",
    "dist_resistance_pct",
    "historical_reliability",
    "tolerance_days",
    "market_regime_bull",
    "market_regime_bear",
    "asset_stock",
    "asset_index",
    "asset_forex",
    "asset_commodity",
    "asset_crypto",
]

POSITIVE_REACTIONS = {
    ReactionType.MAJOR_TOP.value,
    ReactionType.MAJOR_BOTTOM.value,
    ReactionType.HIGHER_LOW.value,
    ReactionType.LOWER_HIGH.value,
    "Major Top",
    "Major Bottom",
    "Higher Low",
    "Lower High",
}


def infer_asset_type(symbol: str) -> str:
    s = symbol.upper()
    if any(x in s for x in ("BTC", "ETH", "BNB", "-USD")):
        return "crypto"
    if s.endswith("=X") or "USD" in s:
        return "forex"
    if s.endswith("=F") or s in ("GC=F", "CL=F", "NG=F"):
        return "commodity"
    if s.startswith("^"):
        return "index"
    return "stock"


def reaction_to_binary(reaction_type: Any) -> int:
    if reaction_type is None:
        return 0
    label = reaction_type.value if hasattr(reaction_type, "value") else str(reaction_type)
    return 1 if label in POSITIVE_REACTIONS else 0


def _macd_state(histogram: float) -> str:
    if histogram > 0:
        return "bullish"
    if histogram < 0:
        return "bearish"
    return "neutral"


def _trend_direction(close: float, sma20: float, sma50: float) -> str:
    if close > sma20 > sma50:
        return "uptrend"
    if close < sma20 < sma50:
        return "downtrend"
    return "mixed"


def _market_regime(close: float, sma50: float, sma200: Optional[float]) -> str:
    if sma200 is None or np.isnan(sma200):
        if close > sma50:
            return "bull"
        if close < sma50:
            return "bear"
        return "sideways"
    if close > sma50 > sma200:
        return "bull"
    if close < sma50 < sma200:
        return "bear"
    return "sideways"


def indicators_at_date(ohlcv_df: pd.DataFrame, as_of: pd.Timestamp) -> Dict[str, Any]:
    """Indicator snapshot using data only up to as_of (no lookahead)."""
    return TechnicalIndicators.analyze_indicators_at_date(ohlcv_df, as_of)


def build_feature_row(
    *,
    cycle_length: int,
    anchor_type: str,
    confluence_count: int,
    tolerance_days: int,
    indicator_snapshot: Dict[str, Any],
    historical_reliability: float,
    asset_type: str,
    as_of: Optional[datetime] = None,
) -> Dict[str, float]:
    rsi = float(indicator_snapshot.get("rsi") or 50.0)
    hist = float(indicator_snapshot.get("macd_histogram") or 0.0)
    close = float(indicator_snapshot.get("close") or 0.0)
    sma20 = float(indicator_snapshot.get("sma_20") or close)
    sma50 = float(indicator_snapshot.get("sma_50") or close)
    sma200 = indicator_snapshot.get("sma_200")
    sma200 = float(sma200) if sma200 is not None else None
    atr = float(indicator_snapshot.get("atr") or 0.0)
    vol = float(indicator_snapshot.get("volume") or 0.0)
    vol_sma = float(indicator_snapshot.get("volume_sma") or vol or 1.0)
    support = float(indicator_snapshot.get("support") or close)
    resistance = float(indicator_snapshot.get("resistance") or close)

    macd = _macd_state(hist)
    trend = _trend_direction(close, sma20, sma50)
    regime = _market_regime(close, sma50, sma200)
    vol_ratio = vol / vol_sma if vol_sma else 1.0
    atr_norm = (atr / close * 100) if close else 0.0
    dist_support = ((close - support) / close * 100) if close else 0.0
    dist_resistance = ((resistance - close) / close * 100) if close else 0.0

    row = {
        "cycle_length": float(cycle_length),
        "anchor_type_low": 1.0 if anchor_type.lower() == "low" else 0.0,
        "confluence_count": float(confluence_count),
        "rsi": rsi,
        "macd_bullish": 1.0 if macd == "bullish" else 0.0,
        "macd_bearish": 1.0 if macd == "bearish" else 0.0,
        "volume_ratio": float(vol_ratio),
        "atr_norm": float(atr_norm),
        "trend_uptrend": 1.0 if trend == "uptrend" else 0.0,
        "trend_downtrend": 1.0 if trend == "downtrend" else 0.0,
        "dist_support_pct": float(dist_support),
        "dist_resistance_pct": float(dist_resistance),
        "historical_reliability": float(historical_reliability),
        "tolerance_days": float(tolerance_days),
        "market_regime_bull": 1.0 if regime == "bull" else 0.0,
        "market_regime_bear": 1.0 if regime == "bear" else 0.0,
        "asset_stock": 1.0 if asset_type == "stock" else 0.0,
        "asset_index": 1.0 if asset_type == "index" else 0.0,
        "asset_forex": 1.0 if asset_type == "forex" else 0.0,
        "asset_commodity": 1.0 if asset_type == "commodity" else 0.0,
        "asset_crypto": 1.0 if asset_type == "crypto" else 0.0,
    }
    return row


def row_to_vector(row: Dict[str, float]) -> np.ndarray:
    return np.array([row.get(c, 0.0) for c in FEATURE_COLUMNS], dtype=np.float64)


def feature_display_names() -> Dict[str, str]:
    return {
        "cycle_length": "Cycle Length",
        "anchor_type_low": "Anchor Low",
        "confluence_count": "Confluence Count",
        "rsi": "RSI",
        "macd_bullish": "Bullish MACD",
        "macd_bearish": "Bearish MACD",
        "volume_ratio": "Volume Ratio",
        "atr_norm": "ATR (normalized)",
        "trend_uptrend": "Uptrend",
        "trend_downtrend": "Downtrend",
        "dist_support_pct": "Distance From Support",
        "dist_resistance_pct": "Distance From Resistance",
        "historical_reliability": "Historical Reliability",
        "tolerance_days": "Tolerance Window",
        "market_regime_bull": "Bull Market Regime",
        "market_regime_bear": "Bear Market Regime",
        "asset_stock": "Stock Asset",
        "asset_index": "Index Asset",
        "asset_forex": "Forex Asset",
        "asset_commodity": "Commodity Asset",
        "asset_crypto": "Crypto Asset",
    }


def confidence_label(probability: float) -> str:
    pct = probability * 100
    if pct >= 80:
        return "Very High"
    if pct >= 65:
        return "High"
    if pct >= 45:
        return "Medium"
    return "Low"
