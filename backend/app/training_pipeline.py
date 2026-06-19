"""
ML training pipeline for ChronoGann reaction confidence.
Generates datasets from historical cycle backtests — NOT price prediction.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from app.cycle_engine import (
    CycleAnalyzer,
    BacktestEngine,
    detect_anchors,
    resolve_cycle_preset,
    ReactionType,
)
from app.data_service import DataService, ASSET_CATALOG
from app.ml_features import (
    FEATURE_COLUMNS,
    build_feature_row,
    reaction_to_binary,
    infer_asset_type,
    indicators_at_date,
    row_to_vector,
)

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "ml_artifacts"
DATASET_PATH = ARTIFACTS_DIR / "ml_training_dataset.csv"
MODEL_PATH = ARTIFACTS_DIR / "reaction_model.pkl"
METRICS_PATH = ARTIFACTS_DIR / "ml_metrics.json"


def _ensure_dirs() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def _walk_forward_reliability(
    past_results: List[Dict],
    cycle_length: int,
) -> float:
    """Hit rate for cycle_length using only prior anchor tests."""
    hits = tests = 0
    for r in past_results:
        if r.get("cycle_length") != cycle_length:
            continue
        tests += 1
        if r.get("hit"):
            hits += 1
    return (hits / tests * 100) if tests else 50.0


def generate_dataset_from_ohlcv(
    ohlcv_df: pd.DataFrame,
    symbol: str,
    cycles: List[int],
    tolerance_days: int = 2,
    max_anchors: int = 12,
) -> List[Dict[str, Any]]:
    """Build labeled training rows from one symbol's history."""
    rows: List[Dict[str, Any]] = []
    analyzer = CycleAnalyzer(ohlcv_df)
    engine = BacktestEngine(ohlcv_df)
    anchors = detect_anchors(ohlcv_df, max_anchors=max_anchors)
    asset_type = infer_asset_type(symbol)
    accumulated: List[Dict] = []

    for anchor in anchors:
        anchor_date = pd.Timestamp(anchor["date"]).normalize()
        if anchor_date >= pd.Timestamp.now().normalize():
            continue

        projections = analyzer.project_cycles(
            anchor["date"], cycles, forward_days=5000, tolerance_days=tolerance_days
        )

        for proj in projections:
            adj = pd.Timestamp(proj["adjusted_date"]).normalize()
            if adj >= pd.Timestamp.now().normalize():
                continue
            if adj not in ohlcv_df.index and adj not in pd.to_datetime(ohlcv_df.index).normalize():
                # skip if no market data near landing
                pass

            reaction = analyzer.classify_reaction(
                proj["dates_to_check"],
                anchor["price"],
                anchor.get("anchor_type", "low"),
            )
            rt = reaction["reaction_type"]
            rt_label = rt.value if hasattr(rt, "value") else str(rt)

            snap = indicators_at_date(ohlcv_df, adj)
            if snap.get("error"):
                continue

            rel = _walk_forward_reliability(accumulated, proj["cycle_length"])

            feat = build_feature_row(
                cycle_length=proj["cycle_length"],
                anchor_type=anchor.get("anchor_type", "low"),
                confluence_count=1,
                tolerance_days=tolerance_days,
                indicator_snapshot=snap,
                historical_reliability=rel,
                asset_type=asset_type,
            )
            feat["reaction"] = reaction_to_binary(rt_label)
            feat["reaction_type"] = rt_label
            feat["symbol"] = symbol
            feat["anchor_date"] = anchor_date.strftime("%Y-%m-%d")
            feat["landing_date"] = adj.strftime("%Y-%m-%d")
            rows.append(feat)

            accumulated.append({
                "cycle_length": proj["cycle_length"],
                "hit": reaction_to_binary(rt_label) == 1,
            })

    return rows


def generate_training_dataset(
    symbols: Optional[List[str]] = None,
    cycle_preset: str = "Core",
    custom_cycles: Optional[List[int]] = None,
    tolerance_days: int = 2,
) -> pd.DataFrame:
    """Generate and persist ML training dataset from multiple symbols."""
    _ensure_dirs()
    cycles = resolve_cycle_preset(cycle_preset, custom_cycles)

    if symbols is None:
        symbols = []
        for cat in ASSET_CATALOG.values():
            symbols.extend(cat["symbols"].keys())
        symbols = symbols[:10]

    all_rows: List[Dict] = []
    for sym in symbols:
        try:
            data = DataService.fetch_yfinance(sym)
            if not DataService.validate_data(data):
                continue
            all_rows.extend(
                generate_dataset_from_ohlcv(data, sym, cycles, tolerance_days)
            )
        except Exception:
            continue

    if not all_rows:
        raise ValueError("No training rows generated. Check data availability.")

    df = pd.DataFrame(all_rows)
    df.to_csv(DATASET_PATH, index=False)
    return df


def preprocess_dataset(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    X = np.vstack([row_to_vector(r) for r in df[FEATURE_COLUMNS].to_dict("records")])
    y = df["reaction"].astype(int).values
    return X, y


def _evaluate_model(model, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, float]:
    y_pred = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else y_pred.astype(float)
    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
    }
    try:
        metrics["roc_auc"] = float(roc_auc_score(y_test, proba))
    except ValueError:
        metrics["roc_auc"] = 0.0
    return metrics


def train_models(
    df: Optional[pd.DataFrame] = None,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Train Random Forest and XGBoost, compare, persist the better model.
    """
    _ensure_dirs()
    if df is None:
        if not DATASET_PATH.exists():
            df = generate_training_dataset()
        else:
            df = pd.read_csv(DATASET_PATH)

    if len(df) < 20:
        raise ValueError(f"Insufficient training data ({len(df)} rows). Need at least 20.")

    X, y = preprocess_dataset(df)
    stratify = y if len(np.unique(y)) > 1 and len(y) >= 10 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=stratify
    )

    candidates: Dict[str, Any] = {}

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=random_state,
    )
    rf.fit(X_train, y_train)
    rf_metrics = _evaluate_model(rf, X_test, y_test)
    candidates["random_forest"] = {"model": rf, "metrics": rf_metrics}

    if HAS_XGBOOST:
        xgb = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=random_state,
        )
        xgb.fit(X_train, y_train)
        xgb_metrics = _evaluate_model(xgb, X_test, y_test)
        candidates["xgboost"] = {"model": xgb, "metrics": xgb_metrics}

    # Select by F1 (balanced for imbalanced reaction detection)
    best_name = max(candidates, key=lambda k: candidates[k]["metrics"]["f1"])
    best = candidates[best_name]

    artifact = {
        "model": best["model"],
        "model_type": best_name,
        "feature_columns": FEATURE_COLUMNS,
        "metrics": best["metrics"],
        "all_metrics": {k: v["metrics"] for k, v in candidates.items()},
        "training_samples": len(df),
        "positive_rate": float(df["reaction"].mean()),
    }

    joblib.dump(artifact, MODEL_PATH)

    metrics_doc = {
        "selected_model": best_name,
        "metrics": best["metrics"],
        "comparison": artifact["all_metrics"],
        "training_samples": len(df),
        "positive_rate": artifact["positive_rate"],
    }
    METRICS_PATH.write_text(json.dumps(metrics_doc, indent=2))

    return metrics_doc


def load_model_artifact() -> Optional[Dict[str, Any]]:
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)


def load_metrics() -> Optional[Dict[str, Any]]:
    if not METRICS_PATH.exists():
        return None
    return json.loads(METRICS_PATH.read_text())
