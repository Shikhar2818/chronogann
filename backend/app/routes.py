"""
FastAPI routes for analysis, data, and saved results
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import pandas as pd
import math
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.data_service import DataService, DataFetchError, ASSET_CATALOG
from app.cycle_engine import (
    CycleAnalyzer, BacktestEngine, ConvergenceAnalyzer,
    CYCLE_PRESETS, resolve_cycle_preset, detect_anchors, anchor_from_date,
    generate_ai_summary, attach_anchor_metadata,
)
from app.indicators import TechnicalIndicators
from app.ml_confidence import score_analysis
from app.training_pipeline import (
    generate_training_dataset,
    train_models,
    load_metrics,
    load_model_artifact,
)
from app.db import get_db
from app.ai_research import (
    build_analysis_context,
    generate_research_summary,
    answer_question,
    explain_beginner,
    explain_ml_model,
    generate_full_report,
    report_to_markdown,
    parse_nl_search,
    execute_nl_search,
    build_strategy_from_query,
    maybe_enhance_with_llm,
)
from app.cycle_projector import project_multi_anchor, default_cycles
from app.market_calendar import MARKET_LABELS, CORE_CYCLES, EXTENDED_CYCLES

router = APIRouter(prefix="/api", tags=["analysis"])

# Pydantic request/response models

class AnchorPoint(BaseModel):
    """Historical anchor point (high/low)"""
    date: datetime
    price: float
    anchor_type: str = Field(..., description="high or low")

class AnalyzeRequest(BaseModel):
    """Single-anchor analysis request"""
    symbol: str
    anchor: AnchorPoint
    cycle_preset: str = "Core"
    custom_cycles: Optional[List[int]] = None
    tolerance_days: int = 1
    include_indicators: bool = True
    forward_days: int = 365

class ConvergenceRequest(BaseModel):
    """Multi-anchor convergence analysis request"""
    symbol: str
    anchors: List[AnchorPoint]
    cycle_preset: str = "Core"
    custom_cycles: Optional[List[int]] = None
    tolerance_days: int = 1
    include_indicators: bool = True
    forward_days: int = 365

class BacktestRequest(BaseModel):
    """Backtest request"""
    symbol: str
    anchors: List[AnchorPoint]
    cycle_preset: str = "Core"
    custom_cycles: Optional[List[int]] = None
    tolerance_days: int = 1
    include_indicators: bool = True

class FullAnalyzeRequest(BaseModel):
    """Date-driven analysis workflow request"""
    symbol: str
    anchor_mode: str = "manual-date"  # manual-date | auto-anchor
    anchor_date: Optional[str] = None  # YYYY-MM-DD primary anchor
    anchor_dates: Optional[List[str]] = None  # multiple dates for convergence
    auto_anchor_dates: Optional[List[str]] = None  # selected from detected list
    cycle_preset: str = "Core"
    custom_cycles: Optional[List[int]] = None
    analysis_mode: str = "single-anchor"  # single-anchor | convergence
    tolerance_days: int = 1
    include_indicators: bool = False  # confirmation only, after cycles
    run_backtest: bool = False  # optional research mode
    include_ml: bool = True  # ML confidence after cycles — never overrides dates
    forward_days: int = 730

class SummaryRequest(BaseModel):
    """AI summary generation request"""
    symbol: str
    projections: List[Dict[str, Any]] = []
    backtest_results: Optional[Dict[str, Any]] = None
    confluence_zones: Optional[List[Dict[str, Any]]] = None
    indicator_confirmation: Optional[Dict[str, Any]] = None
    anchors: Optional[List[Dict[str, Any]]] = None
    analysis_mode: str = "single-anchor"


class AIContextRequest(BaseModel):
    """Analysis snapshot for AI research features."""
    symbol: str
    projections: List[Dict[str, Any]] = []
    anchors: Optional[List[Dict[str, Any]]] = None
    confluence_zones: Optional[List[Dict[str, Any]]] = None
    backtest_results: Optional[Dict[str, Any]] = None
    indicator_confirmation: Optional[Dict[str, Any]] = None
    ml_confidence: Optional[Dict[str, Any]] = None
    analysis_mode: str = "single-anchor"
    per_anchor_projections: Optional[Dict[str, List[Dict[str, Any]]]] = None
    tolerance_days: int = 2
    cycles_used: Optional[List[int]] = None


class AIAskRequest(AIContextRequest):
    question: str
    use_llm: bool = False


class AISearchRequest(AIContextRequest):
    query: str


class AIStrategyRequest(AIContextRequest):
    query: str = "Show cycles with more than 70% hit rate"


def _ctx_from_request(req: AIContextRequest) -> Dict[str, Any]:
    return build_analysis_context(
        req.symbol,
        req.projections,
        req.anchors,
        req.confluence_zones,
        req.backtest_results,
        req.indicator_confirmation,
        req.ml_confidence,
        req.analysis_mode,
        req.per_anchor_projections,
        req.tolerance_days,
        req.cycles_used,
    )

class AnalysisResponse(BaseModel):
    """Single-anchor analysis response"""
    symbol: str
    anchor: Dict[str, Any]
    projections: List[Dict[str, Any]]
    hit_rate: Optional[float] = None
    indicator_confirmation: Optional[Dict[str, Any]] = None
    ai_summary: Optional[str] = None

# Data endpoints

@router.get("/assets")
async def list_assets():
    """List all available assets across markets"""
    return ASSET_CATALOG

@router.get("/data/{symbol}")
async def get_data(
    symbol: str,
    period: str = Query("1y", description="1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max"),
    interval: str = Query("1d", description="1d, 1wk, 1mo")
):
    """Fetch OHLCV data for a symbol"""
    try:
        # Parse period to datetime
        period_map = {
            "1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180,
            "1y": 365, "2y": 730, "5y": 1825, "10y": 3650, "max": 10000
        }
        days = period_map.get(period, 365)
        
        data = DataService.fetch_yfinance(
            symbol,
            end_date=datetime.now(),
            start_date=datetime.now() - pd.Timedelta(days=days),
            interval=interval
        )
        
        if not DataService.validate_data(data):
            raise HTTPException(status_code=400, detail="Data validation failed")
        
        records = data.reset_index()
        date_col = records.columns[0]
        records = records.rename(columns={date_col: "date"})
        records["date"] = pd.to_datetime(records["date"]).dt.strftime("%Y-%m-%d")
        return {
            "symbol": symbol,
            "data": _to_json_safe(records.to_dict(orient="records")),
            "rows": len(data)
        }
    except DataFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/search")
async def search_symbol(q: str = Query(..., min_length=1)):
    """Search for symbol across all markets"""
    results = []
    for market_type, market_data in ASSET_CATALOG.items():
        for symbol, name in market_data["symbols"].items():
            if q.lower() in symbol.lower() or q.lower() in name.lower():
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "market_type": market_type
                })
    return {"results": results[:20]}

def _to_json_safe(obj: Any) -> Any:
    """Recursively convert numpy/pandas types to JSON-serializable Python types."""
    if obj is None:
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        val = float(obj)
        return None if (math.isnan(val) or math.isinf(val)) else val
    if isinstance(obj, (str, int, bool)):
        return obj
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_json_safe(v) for v in obj]
    if hasattr(obj, "value"):  # Enum
        return obj.value
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj


def _serialize_projection(proj: Dict) -> Dict:
    """Convert datetime fields in projections to ISO strings."""
    result = dict(proj)
    for key in ("projected_date", "adjusted_date"):
        if key in result and hasattr(result[key], "isoformat"):
            result[key] = result[key].isoformat()
    if "reaction" in result and isinstance(result["reaction"], dict):
        reaction = dict(result["reaction"])
        if "reaction_type" in reaction and hasattr(reaction["reaction_type"], "value"):
            reaction["reaction_type"] = reaction["reaction_type"].value
        result["reaction"] = reaction
    if "dates_to_check" in result:
        result["dates_to_check"] = [
            d.isoformat() if hasattr(d, "isoformat") else str(d)
            for d in result["dates_to_check"]
        ]
    if "reaction_zone" in result and isinstance(result["reaction_zone"], dict):
        zone = dict(result["reaction_zone"])
        for zk in ("center", "previous_trading_day", "next_trading_day", "zone_start", "zone_end"):
            if zk in zone and zone[zk] is not None and hasattr(zone[zk], "isoformat"):
                zone[zk] = zone[zk].isoformat()
        result["reaction_zone"] = zone
    return result


def _resolve_anchors(
    data: pd.DataFrame,
    req: FullAnalyzeRequest,
) -> List[Dict]:
    """Resolve anchor list from manual date or auto-detected selection."""
    if req.anchor_mode == "manual-date":
        dates = []
        if req.analysis_mode == "convergence" and req.anchor_dates:
            dates = req.anchor_dates
        elif req.anchor_date:
            dates = [req.anchor_date]
        if not dates:
            raise HTTPException(status_code=400, detail="Anchor date is required in manual date mode.")
        return [anchor_from_date(data, pd.Timestamp(d).to_pydatetime()) for d in dates]

    # auto-anchor mode
    detected = detect_anchors(data)
    if not detected:
        raise HTTPException(status_code=400, detail="No swing anchors detected for this symbol.")

    if req.auto_anchor_dates:
        selected = set(req.auto_anchor_dates)
        anchors = [
            a for a in detected
            if pd.Timestamp(a["date"]).strftime("%Y-%m-%d") in selected
        ]
        if not anchors:
            raise HTTPException(status_code=400, detail="Selected auto anchors not found.")
        return anchors

    if req.analysis_mode == "convergence":
        return detected[-5:]
    return [detected[-1]]


def _serialize_anchor(anchor: Dict) -> Dict:
    result = dict(anchor)
    if "date" in result and hasattr(result["date"], "isoformat"):
        result["date"] = result["date"].isoformat()
    return result


# Cycle presets endpoint

@router.get("/cycles")
async def list_cycles():
    """List available Gann cycle presets and their day lengths."""
    return {
        "presets": {
            name: {"label": name, "cycles": cycles}
            for name, cycles in CYCLE_PRESETS.items()
        },
        "custom_supported": True,
    }

# Analysis endpoints

@router.get("/anchors/{symbol}")
async def list_detected_anchors(symbol: str):
    """Return auto-detected swing high/low anchors for user selection."""
    try:
        data = DataService.fetch_yfinance(symbol, end_date=datetime.now())
        if not DataService.validate_data(data):
            raise HTTPException(status_code=400, detail="Invalid market data")
        anchors = detect_anchors(data)
        return _to_json_safe({
            "symbol": symbol,
            "anchors": [_serialize_anchor(a) for a in anchors],
            "count": len(anchors),
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anchor detection failed: {str(e)}")


@router.post("/analyze")
async def analyze_full(req: FullAnalyzeRequest):
    """
    Date-driven workflow:
    Anchor → Cycles → Convergence → Backtest → Indicators → ML Confidence → AI Summary
    """
    try:
        data = DataService.fetch_yfinance(req.symbol, end_date=datetime.now())
        if not DataService.validate_data(data):
            raise HTTPException(status_code=400, detail="Invalid market data")

        cycles = resolve_cycle_preset(req.cycle_preset, req.custom_cycles)
        anchors = _resolve_anchors(data, req)

        # Enforce strict mode separation
        if req.analysis_mode == "single-anchor":
            if len(anchors) != 1:
                anchors = [anchors[0]]
        elif req.analysis_mode == "convergence":
            if len(anchors) < 2:
                raise HTTPException(
                    status_code=400,
                    detail="Convergence mode requires at least 2 anchor dates.",
                )

        analyzer = CycleAnalyzer(data)
        all_projections: Dict[str, List[Dict]] = {}

        # STEP 1: Cycle projection first — no indicators
        for anchor in anchors:
            key = pd.Timestamp(anchor["date"]).strftime("%Y-%m-%d")
            projs = analyzer.project_cycles(
                anchor["date"], cycles,
                forward_days=req.forward_days,
                tolerance_days=req.tolerance_days,
            )
            attach_anchor_metadata(projs, anchor)
            for proj in projs:
                if pd.Timestamp(proj["adjusted_date"]) <= pd.Timestamp.now():
                    proj["reaction"] = analyzer.classify_reaction(
                        proj["dates_to_check"],
                        anchor["price"],
                        anchor.get("anchor_type", "low"),
                    )
                else:
                    proj["reaction"] = {"reaction_type": "Pending", "confidence": 0}
            all_projections[key] = projs

        primary_anchor = anchors[0]
        projections = all_projections[pd.Timestamp(primary_anchor["date"]).strftime("%Y-%m-%d")]

        # STEP 2: Convergence only in convergence mode — never mixed with single
        confluence_zones: List[Dict] = []
        if req.analysis_mode == "convergence":
            conv_analyzer = ConvergenceAnalyzer(data)
            confluence_zones = conv_analyzer.find_convergence(
                anchors, cycles,
                tolerance_days=req.tolerance_days,
                min_convergence_count=2,
            )

        # STEP 3: Backtest — optional research only
        backtest_results = None
        cycle_reliability: Dict[str, float] = {}
        if req.run_backtest:
            bt_anchors = detect_anchors(data) if req.analysis_mode == "single-anchor" else anchors
            engine = BacktestEngine(data)
            backtest_results = engine.backtest_cycles(bt_anchors, cycles, req.tolerance_days)
            cycle_reliability = {
                k: v.get("hit_rate", 0)
                for k, v in backtest_results.get("cycle_stats", {}).items()
            }
            if req.analysis_mode == "convergence":
                conv_analyzer = ConvergenceAnalyzer(data)
                boost = None
                confluence_zones = conv_analyzer.find_convergence(
                    anchors, cycles,
                    tolerance_days=req.tolerance_days,
                    min_convergence_count=2,
                    cycle_reliability=cycle_reliability,
                    indicator_boost=boost,
                )
            confluence_zone_stats: Dict[str, Dict] = {}
            for zone in confluence_zones:
                zone_key = pd.Timestamp(zone["zone_date"]).strftime("%Y-%m-%d")
                avg_rel = 0.0
                if zone.get("cycles_involved"):
                    avg_rel = sum(cycle_reliability.get(str(c), 0) for c in zone["cycles_involved"]) / len(zone["cycles_involved"])
                confluence_zone_stats[zone_key] = {
                    "zone_date": zone_key,
                    "hit_rate": avg_rel,
                    "overlapping_projections": zone.get("overlapping_projections", 0),
                }
            if confluence_zone_stats:
                backtest_results["confluence_zone_stats"] = confluence_zone_stats

            for item in backtest_results.get("detailed_results", []):
                for dk in ("anchor_date", "projected_date", "adjusted_date"):
                    if dk in item and hasattr(item[dk], "isoformat"):
                        item[dk] = item[dk].isoformat()
                if "reaction_type" in item and hasattr(item["reaction_type"], "value"):
                    item["reaction_type"] = item["reaction_type"].value

        # STEP 4: Technical confirmation — after cycles, never overrides dates
        indicator_data = None
        if req.include_indicators:
            target_date = pd.Timestamp.now()
            if req.analysis_mode == "convergence" and confluence_zones:
                target_date = pd.Timestamp(confluence_zones[0]["zone_date"])
            elif projections:
                future = [p for p in projections if p["adjusted_date"] > datetime.now()]
                target_date = pd.Timestamp((future[0] if future else projections[0])["adjusted_date"])
            indicator_data = TechnicalIndicators.analyze_indicators_at_date(data, target_date)
            if req.analysis_mode == "convergence" and confluence_zones and cycle_reliability:
                boost = min(10, (indicator_data.get("confirmation_score", 0) or 0) / 10)
                conv_analyzer = ConvergenceAnalyzer(data)
                confluence_zones = conv_analyzer.find_convergence(
                    anchors, cycles,
                    tolerance_days=req.tolerance_days,
                    min_convergence_count=2,
                    cycle_reliability=cycle_reliability,
                    indicator_boost=boost,
                )

        # STEP 5: ML Confidence — after cycles/convergence/indicators; never overrides dates
        ml_confidence = None
        if req.include_ml:
            try:
                ml_confidence = score_analysis(
                    data,
                    req.symbol,
                    projections,
                    anchors,
                    tolerance_days=req.tolerance_days,
                    confluence_zones=confluence_zones if req.analysis_mode == "convergence" else None,
                    cycle_reliability=cycle_reliability or None,
                    indicator_snapshot=indicator_data,
                )
            except Exception:
                ml_confidence = {"available": False, "message": "ML scoring unavailable."}

        ai_summary = generate_ai_summary(
            req.symbol, projections, backtest_results,
            confluence_zones if req.analysis_mode == "convergence" else None,
            indicator_data, anchors, req.analysis_mode,
            per_anchor_projections=all_projections,
            ml_confidence=ml_confidence,
        )

        analysis_ctx = build_analysis_context(
            req.symbol, projections, anchors,
            confluence_zones if req.analysis_mode == "convergence" else None,
            backtest_results, indicator_data, ml_confidence,
            req.analysis_mode, all_projections, req.tolerance_days, cycles,
        )
        research_summary = generate_research_summary(analysis_ctx)

        serialized_projections = [_serialize_projection(p) for p in projections]
        serialized_anchors = [_serialize_anchor(a) for a in anchors]
        serialized_all = {
            k: [_serialize_projection(p) for p in v]
            for k, v in all_projections.items()
        }

        for zone in confluence_zones:
            for zk in ("zone_date", "zone_start", "zone_end"):
                if zk in zone and hasattr(zone[zk], "isoformat"):
                    zone[zk] = zone[zk].isoformat()

        return _to_json_safe({
            "symbol": req.symbol,
            "anchor_mode": req.anchor_mode,
            "analysis_mode": req.analysis_mode,
            "mode_label": "Single (Without Convergence)" if req.analysis_mode == "single-anchor" else "With Convergence",
            "cycle_preset": req.cycle_preset,
            "cycles_used": cycles,
            "tolerance_days": req.tolerance_days,
            "anchors": serialized_anchors,
            "primary_anchor": _serialize_anchor(primary_anchor),
            "projections": serialized_projections,
            "per_anchor_projections": serialized_all,
            "confluence_zones": confluence_zones[:15] if req.analysis_mode == "convergence" else [],
            "backtest_results": backtest_results,
            "indicator_confirmation": indicator_data,
            "ml_confidence": ml_confidence,
            "ai_summary": ai_summary,
            "research_summary": research_summary,
            "analysis_context": analysis_ctx,
            "data_points": len(data),
            "trading_dates_used": len(DataService.get_trading_dates(data)),
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# --- AI Research Analyst endpoints ---

@router.post("/ai/ask")
async def ai_ask(req: AIAskRequest):
    """Ask ChronoGann — explain analysis using structured context."""
    ctx = _ctx_from_request(req)
    answer = answer_question(req.question, ctx)
    if req.use_llm:
        enhanced = await maybe_enhance_with_llm(
            f"Context: {ctx}\n\nQuestion: {req.question}\n\nDraft answer: {answer}",
            "You are ChronoGann research analyst. Refine the answer. Never predict prices.",
        )
        if enhanced:
            answer = enhanced
    return {"question": req.question, "answer": answer}


@router.post("/ai/beginner")
async def ai_beginner(req: AIContextRequest, topic: str = "cycles"):
    """Gann Teacher Mode — explain like a beginner."""
    ctx = _ctx_from_request(req)
    return {"topic": topic, "explanation": explain_beginner(ctx, topic)}


@router.post("/ai/explain-ml")
async def ai_explain_ml(req: AIContextRequest):
    """Plain-language ML confidence explanation."""
    ctx = _ctx_from_request(req)
    return {"explanation": explain_ml_model(ctx)}


@router.post("/ai/report")
async def ai_generate_report(req: AIContextRequest):
    """Generate full ChronoGann market research report."""
    ctx = _ctx_from_request(req)
    report = generate_full_report(ctx)
    report["markdown"] = report_to_markdown(report)
    return report


@router.post("/ai/nl-search")
async def ai_nl_search(req: AISearchRequest):
    """Natural language search over current analysis."""
    ctx = _ctx_from_request(req)
    filters = parse_nl_search(req.query, req.symbol)
    results = execute_nl_search(ctx, filters)
    return {
        "query": req.query,
        "filters": filters,
        "results": results,
        "count": len(results),
        "summary": (
            f"Found {len(results)} matching cycle date(s) for your query."
            if results else "No dates matched. Try running convergence mode or adjusting the year."
        ),
    }


@router.post("/ai/strategy")
async def ai_strategy(req: AIStrategyRequest):
    """Strategy builder — filter cycles by historical performance."""
    ctx = _ctx_from_request(req)
    return build_strategy_from_query(req.query, ctx)


@router.post("/ml/train")
async def train_ml_model(
    cycle_preset: str = "Core",
    tolerance_days: int = 2,
):
    """
    Research endpoint: generate dataset from historical cycle backtests and train ML model.
  """
    try:
        df = generate_training_dataset(cycle_preset=cycle_preset, tolerance_days=tolerance_days)
        metrics = train_models(df)
        return {
            "status": "trained",
            "samples": len(df),
            "metrics": metrics,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML training failed: {str(e)}")


@router.get("/ml/metrics")
async def get_ml_metrics():
    """Return stored ML model evaluation metrics and model availability."""
    metrics = load_metrics()
    artifact = load_model_artifact()
    return {
        "model_available": artifact is not None,
        "model_type": artifact.get("model_type") if artifact else None,
        "metrics": metrics,
    }


@router.post("/summary")
async def generate_summary(req: SummaryRequest):
    """Generate AI-style natural language summary from analysis results."""
    try:
        summary = generate_ai_summary(
            req.symbol,
            req.projections,
            req.backtest_results,
            req.confluence_zones,
            req.indicator_confirmation,
            req.anchors,
            req.analysis_mode,
        )
        return {"symbol": req.symbol, "ai_summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")

@router.post("/analyze/single-anchor")
async def analyze_single_anchor(req: AnalyzeRequest):
    """
    Analyze market cycles from a single historical anchor point.
    Returns projected cycle dates, reactions, and optional indicator confirmation.
    """
    try:
        # Fetch market data
        data = DataService.fetch_yfinance(req.symbol, end_date=datetime.now())
        if not DataService.validate_data(data):
            raise HTTPException(status_code=400, detail="Invalid data")
        
        cycles = resolve_cycle_preset(req.cycle_preset, req.custom_cycles)

        analyzer = CycleAnalyzer(data)
        projections = analyzer.project_cycles(
            req.anchor.date,
            cycles,
            forward_days=req.forward_days,
            tolerance_days=req.tolerance_days
        )

        for proj in projections:
            reaction = analyzer.classify_reaction(
                proj['dates_to_check'],
                req.anchor.price,
                req.anchor.anchor_type
            )
            proj['reaction'] = reaction

        indicator_data = None
        if req.include_indicators and projections:
            adjusted_date = pd.Timestamp(projections[0]['adjusted_date'])
            indicator_data = TechnicalIndicators.analyze_indicators_at_date(data, adjusted_date)

        serialized = [_serialize_projection(p) for p in projections]
        ai_summary = generate_ai_summary(
            req.symbol, projections, None, None, indicator_data,
            [req.anchor.dict()], "single-anchor"
        )

        return {
            "symbol": req.symbol,
            "anchor": req.anchor.dict(),
            "cycle_preset": req.cycle_preset,
            "projections": serialized,
            "indicator_confirmation": indicator_data,
            "ai_summary": ai_summary,
            "trading_dates_used": len(DataService.get_trading_dates(data))
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/analyze/convergence")
async def analyze_convergence(req: ConvergenceRequest):
    """
    Analyze convergence/confluence of cycles from multiple anchor points.
    Identifies high-probability reversal zones where multiple cycles align.
    """
    try:
        # Fetch market data
        data = DataService.fetch_yfinance(req.symbol)
        if not DataService.validate_data(data):
            raise HTTPException(status_code=400, detail="Invalid data")
        
        cycles = resolve_cycle_preset(req.cycle_preset, req.custom_cycles)

        analyzer = ConvergenceAnalyzer(data)
        anchors = [a.dict() for a in req.anchors]
        confluence_zones = analyzer.find_convergence(
            anchors,
            cycles,
            tolerance_days=req.tolerance_days,
            min_convergence_count=2
        )

        for zone in confluence_zones:
            zone['zone_date'] = zone['zone_date'].isoformat()

        ai_summary = generate_ai_summary(
            req.symbol, [], None, confluence_zones, None, anchors, "convergence"
        )

        return {
            "symbol": req.symbol,
            "anchors_count": len(req.anchors),
            "convergence_zones": confluence_zones[:10],
            "total_convergence_found": len(confluence_zones),
            "ai_summary": ai_summary,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Convergence analysis failed: {str(e)}")

@router.post("/backtest")
async def run_backtest(req: BacktestRequest):
    """
    Backtest cycle effectiveness against historical anchors.
    Tests each anchor and cycle combination, calculates hit rates.
    """
    try:
        # Fetch market data
        data = DataService.fetch_yfinance(req.symbol)
        if not DataService.validate_data(data):
            raise HTTPException(status_code=400, detail="Invalid data")
        
        cycles = resolve_cycle_preset(req.cycle_preset, req.custom_cycles)

        engine = BacktestEngine(data)
        anchors = [a.dict() for a in req.anchors]
        results = engine.backtest_cycles(anchors, cycles, req.tolerance_days)

        for item in results.get("detailed_results", []):
            for dk in ("anchor_date", "projected_date", "adjusted_date"):
                if dk in item and hasattr(item[dk], "isoformat"):
                    item[dk] = item[dk].isoformat()
            if "reaction_type" in item and hasattr(item["reaction_type"], "value"):
                item["reaction_type"] = item["reaction_type"].value

        return {
            "symbol": req.symbol,
            "backtest_results": results,
            "anchors_tested": len(req.anchors),
            "cycle_preset": req.cycle_preset,
            "tolerance_days": req.tolerance_days
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")

class ProjectorRequest(BaseModel):
    """Cycle date projector — calendar-day projection and convergence."""
    symbol: str = ""
    anchor_date: Optional[str] = Field(None, description="YYYY-MM-DD single anchor (legacy)")
    anchor_dates: Optional[List[str]] = Field(None, description="1–3 anchor dates YYYY-MM-DD")
    market_type: str = "india"
    cycle_preset: str = "core"
    selected_cycles: Optional[List[int]] = None
    custom_cycles: Optional[List[int]] = None
    tolerance_days: int = Field(0, ge=0, le=3, description="0=exact, 1–3=near match window")
    future_only: bool = False


@router.get("/projector/calendars")
async def projector_calendars():
    """Market calendars and cycle presets for the date projector."""
    return {
        "markets": MARKET_LABELS,
        "core_cycles": CORE_CYCLES,
        "extended_cycles": EXTENDED_CYCLES,
    }


@router.post("/projector")
async def project_cycle_dates_endpoint(req: ProjectorRequest):
    """
    Project Gann cycle dates from 1–3 anchors using calendar-day math.
    Detects convergence when multiple anchors are supplied.
    """
    raw_dates: List[str] = []
    if req.anchor_dates:
        raw_dates = [d.strip() for d in req.anchor_dates if d and d.strip()]
    elif req.anchor_date:
        raw_dates = [req.anchor_date.strip()]

    if not raw_dates:
        raise HTTPException(status_code=400, detail="Provide at least one anchor date")
    if len(raw_dates) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 anchor dates supported")

    parsed_anchors: List[datetime] = []
    for ds in raw_dates:
        try:
            parsed_anchors.append(datetime.strptime(ds, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {ds} (use YYYY-MM-DD)")

    market = req.market_type.lower().strip()
    if market not in MARKET_LABELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid market_type. Choose from: {', '.join(MARKET_LABELS.keys())}",
        )

    if req.selected_cycles:
        cycles = sorted(set(int(c) for c in req.selected_cycles if c > 0))
    else:
        cycles = default_cycles(req.cycle_preset, req.custom_cycles)

    if not cycles:
        raise HTTPException(status_code=400, detail="Select at least one cycle length")

    result = project_multi_anchor(
        anchor_dates=parsed_anchors,
        cycles=cycles,
        market_type=market,
        symbol=req.symbol.strip() or None,
        tolerance_days=req.tolerance_days,
        future_only=req.future_only,
    )
    return _to_json_safe(result)


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "ChronoGann API", "version": "1.0.0"}
