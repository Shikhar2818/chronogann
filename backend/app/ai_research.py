"""
ChronoGann AI Research Analyst — narrative research from cycle analysis context.
Not a price predictor. Optional OpenAI enhancement when OPENAI_API_KEY is set.
"""
from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _fmt_human_date(d: Any) -> str:
    if not d:
        return "unknown date"
    try:
        ts = pd.Timestamp(d)
        return f"{MONTH_NAMES[ts.month]} {ts.day}, {ts.year}"
    except Exception:
        return str(d).split("T")[0]


def _fmt_short(d: Any) -> str:
    try:
        ts = pd.Timestamp(d)
        return ts.strftime("%d %b %Y")
    except Exception:
        return str(d).split("T")[0]


def _anchor_label(anchor: Dict) -> str:
    ad = _fmt_human_date(anchor.get("date"))
    at = anchor.get("anchor_type", "low")
    return f"{ad} {at}"


def build_analysis_context(
    symbol: str,
    projections: List[Dict],
    anchors: Optional[List[Dict]] = None,
    confluence_zones: Optional[List[Dict]] = None,
    backtest_results: Optional[Dict] = None,
    indicator_data: Optional[Dict] = None,
    ml_confidence: Optional[Dict] = None,
    analysis_mode: str = "single-anchor",
    per_anchor_projections: Optional[Dict[str, List[Dict]]] = None,
    tolerance_days: int = 2,
    cycles_used: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Structured context for all AI research features."""
    anchors = anchors or []
    zones = confluence_zones or []
    now = pd.Timestamp.now()

    future_projs = [
        p for p in projections
        if pd.Timestamp(p.get("adjusted_date") or p.get("projected_date")) >= now
    ]
    primary = future_projs[0] if future_projs else (projections[0] if projections else {})

    hist_rate = None
    if backtest_results:
        hist_rate = backtest_results.get("hit_rate")
    elif ml_confidence and ml_confidence.get("historical_reliability"):
        hist_rate = ml_confidence["historical_reliability"]

    top_zone = zones[0] if zones else None
    ind_conf = (indicator_data or {}).get("confirmation", "NEUTRAL")

    return {
        "symbol": symbol,
        "analysis_mode": analysis_mode,
        "tolerance_days": tolerance_days,
        "cycles_used": cycles_used or [p.get("cycle_length") for p in projections],
        "anchors": [
            {
                "date": _fmt_short(a.get("date")),
                "date_raw": str(a.get("date", "")).split("T")[0],
                "type": a.get("anchor_type", "low"),
                "price": a.get("price"),
            }
            for a in anchors
        ],
        "primary_cycle": primary.get("cycle_length"),
        "primary_date": _fmt_short(primary.get("projected_date") or primary.get("adjusted_date")),
        "primary_date_raw": str(primary.get("projected_date") or primary.get("adjusted_date", "")).split("T")[0],
        "projections": [
            {
                "cycle": p.get("cycle_length"),
                "raw_date": _fmt_short(p.get("projected_date")),
                "raw_date_raw": str(p.get("projected_date", "")).split("T")[0],
                "trading_window": _fmt_short(p.get("adjusted_date")),
                "year": pd.Timestamp(p.get("projected_date")).year if p.get("projected_date") else None,
            }
            for p in projections
        ],
        "confluence_zones": [
            {
                "start": _fmt_short(z.get("zone_start") or z.get("zone_date")),
                "end": _fmt_short(z.get("zone_end") or z.get("zone_date")),
                "score": z.get("confluence_score", 0),
                "anchors": z.get("anchor_count", 0),
                "cycles": z.get("cycles_involved", []),
                "explanation": z.get("explanation", ""),
                "overlap_details": z.get("overlap_details", []),
            }
            for z in zones
        ],
        "top_confluence_score": top_zone.get("confluence_score") if top_zone else None,
        "top_confluence_date": _fmt_short(top_zone.get("zone_start")) if top_zone else None,
        "historical_reliability": hist_rate,
        "indicator_confirmation": ind_conf,
        "ml_probability": ml_confidence.get("reaction_probability") if ml_confidence else None,
        "ml_label": ml_confidence.get("confidence_label") if ml_confidence else None,
        "ml_strong": (ml_confidence or {}).get("strong_contributors", []),
        "ml_weak": (ml_confidence or {}).get("weak_contributors", []),
        "backtest": backtest_results,
        "per_anchor_projections": per_anchor_projections or {},
    }


def generate_research_summary(ctx: Dict[str, Any]) -> str:
    """Narrative research summary — analyst style, not raw metrics."""
    lines: List[str] = []
    symbol = ctx.get("symbol", "Asset")
    lines.append("Research Summary")
    lines.append("")

    zones = ctx.get("confluence_zones") or []
    if zones and ctx.get("analysis_mode") == "convergence":
        zone = zones[0]
        expl = zone.get("explanation")
        if expl:
            lines.append(expl)
        else:
            overlaps = zone.get("overlap_details") or []
            if len(overlaps) >= 2:
                a1, a2 = overlaps[0], overlaps[1]
                lines.append(
                    f"The {a1.get('cycle_length')}-day cycle projected from the "
                    f"{_fmt_human_date(a1.get('anchor_date'))} {a1.get('anchor_type')} aligns with "
                    f"the {a2.get('cycle_length')}-day cycle projected from the "
                    f"{_fmt_human_date(a2.get('anchor_date'))} {a2.get('anchor_type')}."
                )
            else:
                lines.append(
                    f"Multiple Gann cycles converge near {zone.get('start')} "
                    f"(confluence score {zone.get('score', 0):.0f})."
                )
        lines.append("")
    elif ctx.get("anchors"):
        a = ctx["anchors"][0]
        cycle = ctx.get("primary_cycle", 90)
        date = ctx.get("primary_date", "")
        lines.append(
            f"From the {a['type']} anchor on {_fmt_human_date(a['date_raw'])}, "
            f"the {cycle}-day calendar cycle projects to {date}."
        )
        lines.append("")

    rel = ctx.get("historical_reliability")
    if rel is not None:
        lines.append(
            f"Historically, similar cycle structures on {symbol} have produced "
            f"meaningful reactions approximately {rel:.0f}% of the time."
        )
        lines.append("")

    ind = str(ctx.get("indicator_confirmation", "NEUTRAL")).upper()
    if ind in ("NEUTRAL", "WEAK"):
        lines.append("Current technical conditions remain neutral.")
    elif ind == "STRONG":
        lines.append("Current technical conditions show moderate confirmation of the cycle setup.")
    else:
        lines.append("Current technical conditions are mixed but not contradictory.")
    lines.append("")

    ml = ctx.get("ml_probability")
    if ml is not None:
        lines.append(
            f"The ML confidence engine estimates a {ml:.0f}% probability of a meaningful "
            f"time-cycle reaction ({ctx.get('ml_label', '')} confidence). "
            f"This scores historical pattern similarity — not a price forecast."
        )
        lines.append("")

    if zones or ctx.get("primary_cycle"):
        lines.append(
            "This area may represent a potential time-cycle reversal zone worth monitoring. "
            "ChronoGann identifies when cycles align in time; it does not predict direction or magnitude."
        )

    return "\n".join(lines).strip()


def explain_ml_model(ctx: Dict[str, Any]) -> str:
    """Plain-language ML explanation."""
    ml = ctx.get("ml_probability")
    if ml is None:
        return (
            "The ML confidence engine is not available for this analysis. "
            "Train the model from the ML Research Panel to enable scoring."
        )

    parts = [
        f"The confidence score is {'elevated' if ml >= 65 else 'moderate' if ml >= 45 else 'cautious'} "
        f"at {ml:.0f}% because:"
    ]
    strong = ctx.get("ml_strong") or []
    if strong:
        parts.append("• " + ", ".join(strong))
    else:
        cycle = ctx.get("primary_cycle")
        if cycle:
            parts.append(f"• A {cycle}-day calendar cycle is in focus")
        if ctx.get("top_confluence_score"):
            parts.append(f"• Confluence score of {ctx['top_confluence_score']:.0f} suggests overlapping cycles")

    weak = ctx.get("ml_weak") or []
    if weak:
        parts.append(f"Factors that temper confidence: {', '.join(weak)}.")

    parts.append(
        "The model learned from past cycle events whether price reacted meaningfully "
        "near projected windows. It does not predict tomorrow's close."
    )
    return "\n".join(parts)


def explain_beginner(ctx: Dict[str, Any], topic: str = "cycles") -> str:
    """Gann Teacher Mode — beginner-friendly explanations."""
    cycle = ctx.get("primary_cycle") or 360
    anchor = ctx["anchors"][0] if ctx.get("anchors") else {"type": "low", "date": "the anchor"}

    if "confluence" in topic.lower() or "converge" in topic.lower():
        return (
            "Confluence means two or more Gann cycle dates land near the same calendar window. "
            "Think of it like multiple timers ringing at once. Gann traders watched these overlaps "
            "because markets often paid attention when several time cycles aligned.\n\n"
            f"In your analysis, cycles from different anchor dates are compared. "
            f"When they cluster within ±{ctx.get('tolerance_days', 2)} trading days, "
            "ChronoGann highlights a confluence zone."
        )

    if "ml" in topic.lower() or "confidence" in topic.lower():
        return (
            "The ML confidence score answers one question: 'When setups looked like this in the past, "
            "did the market usually react near the cycle date?'\n\n"
            "It is not guessing tomorrow's price. It reads cycle length, confluence, indicators, "
            "and historical hit rates — then estimates reaction probability."
        )

    return (
        f"A {cycle}-day cycle means we measure exactly {cycle} calendar days forward from an "
        f"important {anchor.get('type', 'high or low')} on {_fmt_human_date(anchor.get('date_raw', anchor.get('date')))}.\n\n"
        "Many Gann traders believed that markets respect time — that highs and lows "
        "tend to echo at fixed calendar intervals such as 90, 180, and 360 days.\n\n"
        "ChronoGann projects those dates first. If a date falls on a weekend or holiday, "
        "we show the nearest trading days as the reaction window. "
        "Indicators and ML only help confirm — they never move the cycle date."
    )


def answer_question(question: str, ctx: Dict[str, Any]) -> str:
    """Ask ChronoGann — Q&A over analysis context."""
    q = question.lower().strip()

    if any(w in q for w in ("why", "important", "matter", "significant")) and "date" in q:
        cycle = ctx.get("primary_cycle")
        date = ctx.get("primary_date")
        anchor = ctx["anchors"][0] if ctx.get("anchors") else {}
        zones = ctx.get("confluence_zones") or []
        parts = [
            f"This date ({date}) matters because it is where a {cycle}-day Gann calendar cycle "
            f"lands from the {anchor.get('type', '')} anchor on {_fmt_human_date(anchor.get('date_raw'))}."
        ]
        if zones:
            parts.append(
                f"It also sits inside a confluence zone (score {zones[0].get('score', 0):.0f}) "
                "where multiple independent cycle projections overlap."
            )
        rel = ctx.get("historical_reliability")
        if rel:
            parts.append(f"Similar setups reacted about {rel:.0f}% of the time in backtesting.")
        return " ".join(parts)

    if "confluence" in q or "converge" in q or "overlap" in q:
        zones = ctx.get("confluence_zones") or []
        if not zones:
            return "No confluence zones were detected in the current analysis. Try convergence mode with two or more anchors."
        z = zones[0]
        return z.get("explanation") or (
            f"Cycles converge near {z.get('start')} with score {z.get('score', 0):.0f}. "
            f"{z.get('anchors', 0)} anchors and cycles {z.get('cycles', [])} are involved."
        )

    if "ml" in q or "machine learning" in q or "probability" in q:
        return explain_ml_model(ctx)

    if "anchor" in q:
        if not ctx.get("anchors"):
            return "No anchor is set in the current analysis."
        lines = ["Current anchors:"]
        for a in ctx["anchors"]:
            lines.append(f"• {_fmt_human_date(a['date_raw'])} ({a['type']})")
        return "\n".join(lines)

    if "360" in q or "cycle" in q:
        return explain_beginner(ctx, "cycles")

    if "reliable" in q or "history" in q or "backtest" in q:
        rel = ctx.get("historical_reliability")
        if rel is None:
            return "Run historical backtest mode to measure how often these cycles reacted in the past."
        return f"Historical reliability for similar cycle setups on {ctx.get('symbol')}: approximately {rel:.0f}%."

    # Default: summarize context
    return generate_research_summary(ctx)


def parse_nl_search(query: str, symbol: Optional[str] = None) -> Dict[str, Any]:
    """Convert natural language to structured search filters."""
    q = query.lower()
    filters: Dict[str, Any] = {"symbol": symbol}

    year_match = re.search(r"\b(20\d{2})\b", q)
    if year_match:
        filters["year"] = int(year_match.group(1))

    sym_match = re.search(r"\b(nifty|sensex|aapl|msft|btc|eth|\^[a-z0-9]+)\b", q, re.I)
    if sym_match:
        token = sym_match.group(1).upper()
        filters["symbol"] = "^NSEI" if token == "NIFTY" else token

    if any(w in q for w in ("strong", "high", "best", "powerful")):
        filters["min_confluence_score"] = 60
        filters["min_reliability"] = 55
    if "confluence" in q:
        filters["require_confluence"] = True

    filters["sort"] = "date"
    return filters


def execute_nl_search(ctx: Dict[str, Any], filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Apply NL filters to current analysis projections."""
    results = []
    year = filters.get("year")
    min_score = filters.get("min_confluence_score", 0)

    for p in ctx.get("projections", []):
        if year and p.get("year") != year:
            continue
        results.append({
            "cycle": p.get("cycle"),
            "date": p.get("raw_date"),
            "date_raw": p.get("raw_date_raw"),
            "type": "cycle_projection",
        })

    if filters.get("require_confluence") or min_score > 0:
        zone_results = []
        for z in ctx.get("confluence_zones", []):
            if z.get("score", 0) < min_score:
                continue
            zyear = pd.Timestamp(z.get("start", "2000")).year if z.get("start") else None
            if year and zyear != year:
                continue
            zone_results.append({
                "date": z.get("start"),
                "confluence_score": z.get("score"),
                "cycles": z.get("cycles"),
                "type": "confluence_zone",
            })
        if filters.get("require_confluence"):
            return zone_results
        results.extend(zone_results)

    return sorted(results, key=lambda x: x.get("date_raw") or x.get("date", ""))


def build_strategy_from_query(query: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Strategy builder — filter cycles by historical hit rate."""
    q = query.lower()
    threshold = 70.0
    pct_match = re.search(r"(\d+)\s*%", q)
    if pct_match:
        threshold = float(pct_match.group(1))

    bt = ctx.get("backtest") or {}
    stats = bt.get("cycle_stats") or {}
    matching = []
    for cycle_str, s in stats.items():
        hr = s.get("hit_rate", 0)
        if hr >= threshold:
            matching.append({
                "cycle_length": int(cycle_str),
                "hit_rate": hr,
                "tests": s.get("tests", 0),
                "hits": s.get("hits", 0),
            })

    matching.sort(key=lambda x: -x["hit_rate"])

    if not matching and not stats:
        return {
            "message": "Enable historical backtest when analyzing to filter cycles by hit rate.",
            "threshold_pct": threshold,
            "matching_cycles": [],
        }

    return {
        "threshold_pct": threshold,
        "matching_cycles": matching,
        "summary": (
            f"Cycles on {ctx.get('symbol')} with ≥{threshold:.0f}% historical reaction rate: "
            + ", ".join(f"{m['cycle_length']}d ({m['hit_rate']:.0f}%)" for m in matching[:8])
            if matching else f"No cycles met the {threshold:.0f}% threshold in this backtest."
        ),
    }


def generate_full_report(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Structured ChronoGann Market Report."""
    symbol = ctx.get("symbol", "—")
    anchor = ctx["anchors"][0] if ctx.get("anchors") else {}
    zones = ctx.get("confluence_zones") or []
    top_zone = zones[0] if zones else None
    cycles = ctx.get("cycles_used") or []

    risk_factors = []
    if ctx.get("indicator_confirmation", "").upper() in ("NEUTRAL", "WEAK"):
        risk_factors.append("Technical indicators are neutral — limited confirmation")
    if not zones and ctx.get("analysis_mode") == "convergence":
        risk_factors.append("No confluence zones detected within tolerance")
    if ctx.get("ml_probability") and ctx["ml_probability"] < 50:
        risk_factors.append("ML confidence below 50%")
    weak = ctx.get("ml_weak") or []
    risk_factors.extend(weak[:3])
    if not risk_factors:
        risk_factors.append("Cycle dates are forward projections — past performance does not guarantee future reactions")

    report = {
        "title": "ChronoGann Market Report",
        "generated_at": datetime.now().isoformat(),
        "asset": symbol,
        "anchor": {
            "date": anchor.get("date", "—"),
            "type": anchor.get("type", "—"),
        },
        "analysis_mode": ctx.get("analysis_mode"),
        "key_cycles": cycles,
        "strongest_confluence": {
            "date": top_zone.get("start") if top_zone else ctx.get("primary_date"),
            "score": top_zone.get("score") if top_zone else None,
            "explanation": top_zone.get("explanation") if top_zone else None,
        },
        "historical_reliability_pct": ctx.get("historical_reliability"),
        "ml_confidence_pct": ctx.get("ml_probability"),
        "ml_label": ctx.get("ml_label"),
        "indicator_confirmation": ctx.get("indicator_confirmation"),
        "risk_factors": risk_factors,
        "research_summary": generate_research_summary(ctx),
        "projections": ctx.get("projections", []),
        "disclaimer": (
            "This report is for Gann time-cycle research only. "
            "It does not constitute financial advice or a price prediction."
        ),
    }
    return report


def report_to_markdown(report: Dict[str, Any]) -> str:
    """Markdown report for PDF export."""
    lines = [
        f"# {report['title']}",
        "",
        f"**Asset:** {report['asset']}",
        f"**Anchor:** {report['anchor']['date']} ({report['anchor']['type']})",
        f"**Generated:** {report['generated_at'][:10]}",
        "",
        "## Key Cycles",
        ", ".join(str(c) for c in report.get("key_cycles", [])),
        "",
        "## Strongest Confluence",
    ]
    sc = report.get("strongest_confluence") or {}
    lines.append(f"**Date:** {sc.get('date', '—')}")
    if sc.get("score"):
        lines.append(f"**Score:** {sc['score']:.0f}")
    lines.append("")
    lines.append("## Historical Reliability")
    lines.append(f"{report.get('historical_reliability_pct') or '—'}%")
    lines.append("")
    lines.append("## ML Confidence")
    lines.append(f"{report.get('ml_confidence_pct') or '—'}% ({report.get('ml_label') or 'N/A'})")
    lines.append("")
    lines.append("## Risk Factors")
    for r in report.get("risk_factors", []):
        lines.append(f"- {r}")
    lines.append("")
    lines.append("## Research Summary")
    lines.append(report.get("research_summary", ""))
    lines.append("")
    lines.append(f"*{report.get('disclaimer', '')}*")
    return "\n".join(lines)


async def maybe_enhance_with_llm(prompt: str, system: str = "") -> Optional[str]:
    """Optional OpenAI enhancement when API key is configured."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    "messages": [
                        {"role": "system", "content": system or "You are ChronoGann, a Gann time-cycle research analyst. Never predict prices."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 800,
                    "temperature": 0.4,
                },
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        pass
    return None
