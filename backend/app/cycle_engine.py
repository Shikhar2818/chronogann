"""
Core cycle analysis engine for ChronoGann
Handles projection, backtesting, and confluence analysis
"""
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Optional
from enum import Enum

from app.gann_dates import (
    project_gann_cycle,
    project_raw_cycle_date,
    build_trading_adjustment,
    raw_dates_within_tolerance,
)

class ReactionType(str, Enum):
    """Classification of price reaction to cycle"""
    MAJOR_TOP = "Major Top"
    MAJOR_BOTTOM = "Major Bottom"
    HIGHER_LOW = "Higher Low"
    LOWER_HIGH = "Lower High"
    PULLBACK = "Pullback"
    NO_REACTION = "No Reaction"

class CyclePreset(str, Enum):
    """Cycle presets available in the app"""
    CORE = "Core"
    EXTENDED = "Extended"
    ADVANCED = "Advanced"
    CUSTOM = "Custom"

# Predefined cycle lengths by preset (string keys for API compatibility)
CYCLE_PRESETS = {
    "Core": [30, 60, 90, 120, 180, 240, 270, 360],
    "Extended": [45, 135, 225, 315],
    "Advanced": [72, 144, 365, 720],
}


def resolve_cycle_preset(preset: str, custom_cycles: Optional[List[int]] = None) -> List[int]:
    """Resolve cycle list from preset name (case-insensitive) or custom values."""
    if custom_cycles:
        return custom_cycles
    normalized = preset.strip().capitalize() if preset.lower() != "custom" else "Custom"
    if normalized == "Custom":
        return CYCLE_PRESETS["Core"]
    return CYCLE_PRESETS.get(normalized, CYCLE_PRESETS["Core"])


def anchor_from_date(ohlcv_df: pd.DataFrame, anchor_date: datetime) -> Dict:
    """
    Build an anchor from a user-supplied date.
    Uses nearest trading day and infers high/low from price action.
    """
    df = ohlcv_df.sort_index()
    df.index = pd.to_datetime(df.index).normalize()
    ts = pd.Timestamp(anchor_date).normalize()

    if ts in df.index:
        candle = df.loc[ts]
        actual_date = ts.to_pydatetime()
    else:
        # Nearest trading day on or before the requested date
        prior = df.index[df.index <= ts]
        if len(prior) == 0:
            after = df.index[df.index >= ts]
            if len(after) == 0:
                raise ValueError(f"No market data near date {anchor_date}")
            actual_date = after[0].to_pydatetime()
            candle = df.loc[after[0]]
        else:
            actual_date = prior[-1].to_pydatetime()
            candle = df.loc[prior[-1]]

    high = float(candle.get("high", candle.get("High", 0)))
    low = float(candle.get("low", candle.get("Low", 0)))
    close = float(candle.get("close", candle.get("Close", 0)))
    mid = (high + low) / 2
    anchor_type = "high" if close >= mid else "low"
    price = high if anchor_type == "high" else low

    return {
        "date": actual_date,
        "price": price,
        "anchor_type": anchor_type,
        "requested_date": pd.Timestamp(anchor_date).to_pydatetime(),
    }


def detect_anchors(
    ohlcv_df: pd.DataFrame,
    lookback: int = 5,
    max_anchors: int = 8,
) -> List[Dict]:
    """
    Detect swing high/low anchor points from OHLCV data.
    Uses local extrema within a rolling lookback window.
    """
    df = ohlcv_df.sort_index()
    if len(df) < lookback * 2 + 1:
        return []

    highs = df["high"].values
    lows = df["low"].values
    dates = df.index
    anchors: List[Dict] = []

    for i in range(lookback, len(df) - lookback):
        window_high = highs[i - lookback : i + lookback + 1]
        window_low = lows[i - lookback : i + lookback + 1]

        if highs[i] == window_high.max():
            anchors.append({
                "date": pd.Timestamp(dates[i]).to_pydatetime(),
                "price": float(highs[i]),
                "anchor_type": "high",
            })
        elif lows[i] == window_low.min():
            anchors.append({
                "date": pd.Timestamp(dates[i]).to_pydatetime(),
                "price": float(lows[i]),
                "anchor_type": "low",
            })

    # Deduplicate nearby anchors of same type, keep strongest
    anchors.sort(key=lambda a: a["date"])
    filtered: List[Dict] = []
    for anchor in anchors:
        if filtered:
            last = filtered[-1]
            days_apart = abs((anchor["date"] - last["date"]).days)
            if days_apart < lookback and anchor["anchor_type"] == last["anchor_type"]:
                if anchor["anchor_type"] == "high" and anchor["price"] > last["price"]:
                    filtered[-1] = anchor
                elif anchor["anchor_type"] == "low" and anchor["price"] < last["price"]:
                    filtered[-1] = anchor
                continue
        filtered.append(anchor)

    # Prefer recent anchors, alternating types when possible
    if len(filtered) > max_anchors:
        step = max(1, len(filtered) // max_anchors)
        filtered = filtered[-max_anchors * step :: step][-max_anchors:]

    return filtered


def _fmt_date(d) -> str:
    if d is None:
        return ""
    if hasattr(d, "strftime"):
        return d.strftime("%Y-%m-%d")
    return str(d).split("T")[0]


def _reaction_label(reaction: Dict) -> str:
    if not reaction:
        return "Pending"
    rt = reaction.get("reaction_type", "Pending")
    if hasattr(rt, "value"):
        return rt.value
    return str(rt)


def _adjustment_note(proj: Dict) -> str:
    adj = proj.get("adjustment_type", "exact")
    if adj == "exact":
        return "Projected date falls on a trading day."
    zone = proj.get("reaction_zone", {})
    prev_d = _fmt_date(zone.get("previous_trading_day"))
    next_d = _fmt_date(zone.get("next_trading_day"))
    raw = _fmt_date(proj.get("projected_date"))
    if adj == "reaction_zone":
        return (
            f"Cycle date {raw} fell on a non-trading day. "
            f"Reaction window: {prev_d} to {next_d} (nearest trading days)."
        )
    return f"Adjusted from {raw} to nearest trading day."


def attach_anchor_metadata(projections: List[Dict], anchor: Dict) -> List[Dict]:
    """Tag each projection with its source anchor and adjustment note."""
    anchor_date = _fmt_date(anchor.get("date"))
    anchor_type = anchor.get("anchor_type", "low")
    for proj in projections:
        proj["anchor_date"] = anchor_date
        proj["anchor_type"] = anchor_type
        proj["anchor_price"] = anchor.get("price")
        proj["adjustment_note"] = _adjustment_note(proj)
        proj["source_label"] = (
            f"{proj['cycle_length']}-day calendar cycle from anchor {anchor_date} ({anchor_type})"
        )
    return projections


def generate_ai_summary(
    symbol: str,
    projections: List[Dict],
    backtest_results: Optional[Dict] = None,
    confluence_zones: Optional[List[Dict]] = None,
    indicator_data: Optional[Dict] = None,
    anchors: Optional[List[Dict]] = None,
    analysis_mode: str = "single-anchor",
    per_anchor_projections: Optional[Dict[str, List[Dict]]] = None,
    ml_confidence: Optional[Dict] = None,
) -> str:
    """Generate objective Gann cycle research summary — not price prediction."""
    parts: List[str] = []
    anchors = anchors or []

    if analysis_mode == "single-anchor" and anchors:
        a = anchors[0]
        ad = _fmt_date(a.get("date"))
        at = a.get("anchor_type", "low")
        parts.append(
            f"{symbol} — Single mode (without convergence). "
            f"Anchor: {ad} major {at} at ${a.get('price', 0):,.2f}. "
            f"All cycle dates are projected forward from this anchor only."
        )
        for proj in projections:
            cycle = proj.get("cycle_length")
            adj = _fmt_date(proj.get("adjusted_date"))
            raw = _fmt_date(proj.get("projected_date"))
            reaction = _reaction_label(proj.get("reaction", {}))
            note = proj.get("adjustment_note") or _adjustment_note(proj)
            line = f"The {cycle}-day calendar cycle raw date is {raw}"
            if raw != adj:
                line += f"; trading window near {adj} ({note})"
            else:
                line += f"; trading date {adj}"
            if reaction not in ("Pending", "No Reaction"):
                line += f". Price reaction near this date: {reaction}."
            elif pd.Timestamp(proj.get("adjusted_date", datetime.now())) <= pd.Timestamp.now():
                line += ". No significant reaction detected within the tolerance window."
            else:
                line += ". Upcoming cycle date — reaction pending."
            parts.append(line)

    elif analysis_mode == "convergence" and anchors:
        parts.append(
            f"{symbol} — Convergence mode. "
            f"{len(anchors)} anchor dates used; cycles projected independently from each anchor."
        )
        for a in anchors:
            ad = _fmt_date(a.get("date"))
            at = a.get("anchor_type", "low")
            parts.append(f"Anchor: {ad} ({at}) at ${a.get('price', 0):,.2f}.")

        if per_anchor_projections:
            for ad, projs in per_anchor_projections.items():
                cycles_str = ", ".join(str(p.get("cycle_length")) for p in projs[:6])
                parts.append(f"From {ad}: projected cycles at {cycles_str} days.")

        if confluence_zones:
            for zone in confluence_zones[:3]:
                expl = zone.get("explanation")
                if expl:
                    parts.append(expl)
                else:
                    zs = _fmt_date(zone.get("zone_start"))
                    ze = _fmt_date(zone.get("zone_end"))
                    parts.append(
                        f"Confluence zone {zs}–{ze} (score {zone.get('confluence_score', 0):.0f}): "
                        f"{zone.get('anchor_count', 0)} anchors, cycles {zone.get('cycles_involved', [])}."
                    )
        else:
            parts.append("No confluence zones detected within the configured tolerance window.")

    if backtest_results:
        parts.append(
            f"Historical validation: {backtest_results.get('hit_rate', 0):.1f}% hit rate across "
            f"{backtest_results.get('total_cycles_tested', 0)} cycle tests."
        )

    if indicator_data and indicator_data.get("confirmation"):
        parts.append(
            f"Technical confirmation (optional): {indicator_data['confirmation']} — "
            f"indicators do not alter cycle dates."
        )

    if ml_confidence and ml_confidence.get("available"):
        prob = ml_confidence.get("reaction_probability")
        label = ml_confidence.get("confidence_label", "")
        hist = ml_confidence.get("historical_reliability")
        parts.append(
            f"ML confidence engine (secondary): estimates a {prob}% probability of a meaningful "
            f"cycle reaction ({label} confidence). Historical cycle reliability for this setup: {hist}%. "
            f"This is not a price prediction — it scores how often similar cycle setups reacted in the past."
        )

    return " ".join(parts)

class CycleAnalyzer:
    """
    Single-anchor cycle projector.
    Projects future cycle dates from one historical anchor point using
    calendar-day Gann math, then adjusts for trading days.
    """
    
    def __init__(self, ohlcv_df: pd.DataFrame, trading_days_only: bool = True):
        """
        Args:
            ohlcv_df: DataFrame with OHLCV data, index must be datetime
            trading_days_only: If True, use market data for trading-day windows
        """
        self.ohlcv = ohlcv_df.sort_index()
        self.ohlcv.index = pd.to_datetime(self.ohlcv.index).normalize()
        self.trading_days_only = trading_days_only
        self.trading_dates = set(self.ohlcv.index.date) if trading_days_only else set()
        self._sorted_trading_dates = sorted(self.ohlcv.index) if trading_days_only else []
        
    def project_cycles(
        self,
        anchor_date: datetime,
        cycles: List[int],
        forward_days: int = 365,
        tolerance_days: int = 1
    ) -> List[Dict]:
        """
        Project cycle dates forward from an anchor point.

        Gann cycles use calendar days from the anchor (day 0).
        Trading-day adjustment is applied only after the raw date is known.
        """
        results = []
        anchor_dt = pd.Timestamp(anchor_date).normalize().to_pydatetime()
        
        for cycle in cycles:
            raw_date = project_raw_cycle_date(anchor_dt, cycle)

            if raw_date > datetime.now() + timedelta(days=forward_days):
                continue

            proj = project_gann_cycle(
                anchor_dt,
                cycle,
                trading_dates=self.trading_dates if self.trading_days_only else None,
                sorted_trading_timestamps=self._sorted_trading_dates if self.trading_days_only else None,
                tolerance_days=tolerance_days,
            )
            results.append(proj)
        
        return results
    
    def classify_reaction(
        self,
        dates_to_check: List[datetime],
        anchor_price: float,
        anchor_type: str = "low"  # low or high
    ) -> Dict:
        """
        Classify what price did at the projected cycle dates.
        
        Args:
            dates_to_check: List of dates to examine
            anchor_price: The anchor point price
            anchor_type: Whether the anchor was a "low" or "high"
        
        Returns:
            {
                'reaction_type': ReactionType,
                'confidence': float,
                'details': str,
                'price_range': {'high': float, 'low': float, 'close': float}
            }
        """
        reaction_data = []
        
        for date in dates_to_check:
            ts = pd.Timestamp(date).normalize()
            if ts not in self.ohlcv.index:
                continue
            candle = self.ohlcv.loc[ts]
            reaction_data.append({
                'date': date,
                'high': candle.get('high', candle.get('High', np.nan)),
                'low': candle.get('low', candle.get('Low', np.nan)),
                'close': candle.get('close', candle.get('Close', np.nan))
            })
        
        if not reaction_data:
            return {
                'reaction_type': ReactionType.NO_REACTION,
                'confidence': 0,
                'details': 'No data available for reaction check',
                'price_range': {}
            }
        
        df_reaction = pd.DataFrame(reaction_data)
        window_high = df_reaction['high'].max()
        window_low = df_reaction['low'].min()
        window_close = df_reaction['close'].iloc[-1] if len(df_reaction) > 0 else np.nan
        
        # Determine reaction type
        if anchor_type == "low":
            if window_low < anchor_price * 0.95:  # Price went lower
                reaction = ReactionType.MAJOR_BOTTOM
                confidence = 90
            elif window_high > anchor_price * 1.05:  # Price went significantly higher
                reaction = ReactionType.HIGHER_LOW
                confidence = 75
            elif abs(window_close - anchor_price) / anchor_price < 0.02:
                reaction = ReactionType.PULLBACK
                confidence = 60
            else:
                reaction = ReactionType.NO_REACTION
                confidence = 20
        else:  # anchor_type == "high"
            if window_high > anchor_price * 1.05:
                reaction = ReactionType.MAJOR_TOP
                confidence = 90
            elif window_low < anchor_price * 0.95:
                reaction = ReactionType.LOWER_HIGH
                confidence = 75
            elif abs(window_close - anchor_price) / anchor_price < 0.02:
                reaction = ReactionType.PULLBACK
                confidence = 60
            else:
                reaction = ReactionType.NO_REACTION
                confidence = 20
        
        return {
            'reaction_type': reaction,
            'confidence': confidence,
            'details': f"Price range: {window_low:.2f} - {window_high:.2f}",
            'price_range': {
                'high': float(window_high),
                'low': float(window_low),
                'close': float(window_close)
            }
        }


class BacktestEngine:
    """
    Backtests cycle effectiveness against historical data.
    Tests multiple anchors and cycles, calculates hit rates.
    """
    
    def __init__(self, ohlcv_df: pd.DataFrame):
        self.ohlcv = ohlcv_df.sort_index()
        self.analyzer = CycleAnalyzer(ohlcv_df)
    
    def backtest_cycles(
        self,
        anchors: List[Dict],
        cycles: List[int],
        tolerance_days: int = 1
    ) -> Dict:
        """
        Backtest cycles against historical anchors.
        
        Args:
            anchors: List of dicts with keys: date, price, type (high/low)
            cycles: List of cycle lengths to test
            tolerance_days: Tolerance window
        
        Returns:
            {
                'total_cycles_tested': int,
                'total_hits': int,
                'hit_rate': float,
                'best_cycle': int,
                'worst_cycle': int,
                'cycle_stats': {
                    '30': {'hits': int, 'tests': int, 'hit_rate': float},
                    ...
                },
                'detailed_results': [...]
            }
        """
        detailed_results = []
        cycle_stats = {str(c): {'hits': 0, 'tests': 0, 'hit_rate': 0.0} for c in cycles}
        anchor_stats: Dict[str, Dict] = {}

        for anchor in anchors:
            anchor_key = pd.Timestamp(anchor['date']).strftime('%Y-%m-%d')
            if anchor_key not in anchor_stats:
                anchor_stats[anchor_key] = {'hits': 0, 'tests': 0, 'hit_rate': 0.0, 'anchor_type': anchor.get('anchor_type', 'low')}
            projections = self.analyzer.project_cycles(
                anchor['date'],
                cycles,
                tolerance_days=tolerance_days
            )
            
            for proj in projections:
                cycle = proj['cycle_length']
                anchor_type = anchor.get('anchor_type') or anchor.get('type', 'low')
                reaction = self.analyzer.classify_reaction(
                    proj['dates_to_check'],
                    anchor['price'],
                    anchor_type
                )
                
                is_hit = reaction['reaction_type'] != ReactionType.NO_REACTION
                cycle_stats[str(cycle)]['tests'] += 1
                anchor_stats[anchor_key]['tests'] += 1
                if is_hit:
                    cycle_stats[str(cycle)]['hits'] += 1
                    anchor_stats[anchor_key]['hits'] += 1
                
                detailed_results.append({
                    'anchor_date': anchor['date'],
                    'anchor_price': anchor['price'],
                    'anchor_type': anchor.get('anchor_type') or anchor.get('type', 'low'),
                    'cycle_length': cycle,
                    'projected_date': proj['projected_date'],
                    'adjusted_date': proj['adjusted_date'],
                    'reaction_type': reaction['reaction_type'],
                    'confidence': reaction['confidence'],
                    'hit': is_hit
                })
        
        # Calculate hit rates per cycle and per anchor
        for stats in list(cycle_stats.values()) + list(anchor_stats.values()):
            if stats['tests'] > 0:
                stats['hit_rate'] = (stats['hits'] / stats['tests']) * 100
        
        # Find best/worst cycles
        tested_cycles = {c: s for c, s in cycle_stats.items() if s['tests'] > 0}
        best_cycle = max(tested_cycles, key=lambda c: tested_cycles[c]['hit_rate']) if tested_cycles else None
        worst_cycle = min(tested_cycles, key=lambda c: tested_cycles[c]['hit_rate']) if tested_cycles else None
        
        total_tests = sum(s['tests'] for s in cycle_stats.values())
        total_hits = sum(s['hits'] for s in cycle_stats.values())
        hit_rate = (total_hits / total_tests * 100) if total_tests > 0 else 0
        
        return {
            'total_cycles_tested': total_tests,
            'total_hits': total_hits,
            'hit_rate': hit_rate,
            'asset_hit_rate': hit_rate,
            'best_cycle': int(best_cycle) if best_cycle else None,
            'worst_cycle': int(worst_cycle) if worst_cycle else None,
            'cycle_stats': cycle_stats,
            'anchor_stats': anchor_stats,
            'detailed_results': detailed_results,
        }


class ConvergenceAnalyzer:
    """
    Detects convergence/confluence of cycles from multiple anchors.
    Identifies high-probability reversal zones where multiple cycles align.
    """
    
    def __init__(self, ohlcv_df: pd.DataFrame):
        self.ohlcv = ohlcv_df.sort_index()
        self.analyzer = CycleAnalyzer(ohlcv_df)
    
    def find_convergence(
        self,
        anchors: List[Dict],
        cycles: List[int],
        tolerance_days: int = 1,
        min_convergence_count: int = 2,
        cycle_reliability: Optional[Dict[str, float]] = None,
        indicator_boost: Optional[float] = None,
    ) -> List[Dict]:
        """
        Find confluence zones where raw calendar cycle dates overlap,
        then apply trading-day adjustment to the resulting zone.
        """
        events: List[Dict] = []
        trading_dates = self.analyzer.trading_dates

        for anchor in anchors:
            anchor_dt = pd.Timestamp(anchor['date']).normalize().to_pydatetime()
            for cycle in cycles:
                raw_date = project_raw_cycle_date(anchor_dt, cycle)
                events.append({
                    'raw_date': pd.Timestamp(raw_date).normalize(),
                    'anchor': anchor,
                    'cycle': cycle,
                    'projection': project_gann_cycle(
                        anchor_dt,
                        cycle,
                        trading_dates=trading_dates,
                    ),
                })

        if not events:
            return []

        events.sort(key=lambda e: e['raw_date'])
        clusters: List[List[Dict]] = []
        current: List[Dict] = [events[0]]

        for event in events[1:]:
            cluster_latest = max(e['raw_date'] for e in current)
            if raw_dates_within_tolerance(event['raw_date'], cluster_latest, tolerance_days):
                current.append(event)
            else:
                clusters.append(current)
                current = [event]
        clusters.append(current)

        confluence_zones = []
        for cluster in clusters:
            unique_anchors = {pd.Timestamp(a['anchor']['date']).strftime('%Y-%m-%d') for a in cluster}
            cycles_involved = sorted({e['cycle'] for e in cluster})
            if len(cluster) < min_convergence_count:
                continue

            raw_center = min(e['raw_date'] for e in cluster).to_pydatetime()
            trading_zone = build_trading_adjustment(raw_center, trading_dates)
            zone_start = trading_zone['zone_start']
            zone_end = trading_zone['zone_end']
            center = trading_zone['center']

            # Score: overlapping cycles + anchors + historical reliability (never indicators alone)
            cycle_overlap = min(40, len(cluster) * 8)
            anchor_overlap = min(35, len(unique_anchors) * 12)
            reliability = 0.0
            if cycle_reliability:
                rel_scores = [cycle_reliability.get(str(c), 0) for c in cycles_involved]
                reliability = min(25, (sum(rel_scores) / len(rel_scores)) * 0.25) if rel_scores else 0

            base_score = cycle_overlap + anchor_overlap + reliability
            indicator_bonus = min(10, indicator_boost or 0)  # optional, capped
            confluence_score = min(100, base_score + indicator_bonus)

            overlap_details = []
            for e in cluster:
                a = e["anchor"]
                overlap_details.append({
                    "anchor_date": _fmt_date(a.get("date")),
                    "anchor_type": a.get("anchor_type", "low"),
                    "cycle_length": e["cycle"],
                    "projected_date": _fmt_date(e["raw_date"]),
                    "raw_calendar_date": _fmt_date(e["raw_date"]),
                    "adjusted_trading_date": _fmt_date(e["projection"]["adjusted_date"]),
                })

            # Build human-readable overlap explanation
            explanations = []
            if len(overlap_details) >= 2:
                a1, a2 = overlap_details[0], overlap_details[1]
                explanations.append(
                    f"The {a1['cycle_length']}-day cycle from the {a1['anchor_date']} {a1['anchor_type']} "
                    f"coincided with the {a2['cycle_length']}-day cycle from the {a2['anchor_date']} {a2['anchor_type']}."
                )
            if len(unique_anchors) >= 2:
                explanations.append(
                    "A high-probability time cycle confluence zone formed where multiple anchors aligned."
                )

            confluence_zones.append({
                'zone_date': center,
                'zone_start': zone_start,
                'zone_end': zone_end,
                'anchor_count': len(unique_anchors),
                'cycle_count': len(cluster),
                'confluence_score': confluence_score,
                'cycles_involved': cycles_involved,
                'anchors_involved': list(unique_anchors),
                'overlapping_projections': len(cluster),
                'overlap_details': overlap_details,
                'explanation': " ".join(explanations),
            })

        return sorted(confluence_zones, key=lambda x: x['confluence_score'], reverse=True)
