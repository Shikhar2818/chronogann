"""
SQLAlchemy models for ChronoGann database schema
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db import Base

# Association tables for many-to-many relationships

class Asset(Base):
    """Market assets: stocks, indices, forex pairs, commodities, crypto"""
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    asset_type = Column(String(50), nullable=False)  # stock, index, forex, commodity, crypto
    market = Column(String(50), nullable=False)  # NSE, BSE, NYSE, FOREX, CRYPTO, etc.
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    anchors = relationship("Anchor", back_populates="asset", cascade="all, delete-orphan")
    backtests = relationship("BacktestRun", back_populates="asset", cascade="all, delete-orphan")

class Anchor(Base):
    """Historical highs/lows marked as cycle anchors"""
    __tablename__ = "anchors"
    
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    anchor_date = Column(DateTime, nullable=False)
    anchor_price = Column(Float, nullable=False)
    anchor_type = Column(String(20), nullable=False)  # high, low
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    asset = relationship("Asset", back_populates="anchors")
    projections = relationship("CycleProjection", back_populates="anchor", cascade="all, delete-orphan")

class CycleProjection(Base):
    """Projected cycle dates from an anchor point"""
    __tablename__ = "cycle_projections"
    
    id = Column(Integer, primary_key=True)
    anchor_id = Column(Integer, ForeignKey("anchors.id"), nullable=False)
    cycle_length = Column(Integer, nullable=False)  # 30, 60, 90, 120, 180, 240, 270, 360, etc.
    cycle_preset = Column(String(50), nullable=False)  # Core, Extended, Advanced, Custom
    projected_date = Column(DateTime, nullable=False)
    adjusted_date = Column(DateTime)  # Nearest trading day if weekend/holiday
    adjustment_type = Column(String(50))  # exact, previous_trading_day, next_trading_day, zone
    tolerance_days = Column(Integer, default=1)  # ±1, ±2, ±3 trading days
    created_at = Column(DateTime, default=datetime.utcnow)
    
    anchor = relationship("Anchor", back_populates="projections")
    backtest_results = relationship("BacktestResult", back_populates="projection", cascade="all, delete-orphan")

class BacktestRun(Base):
    """Stored backtest sessions"""
    __tablename__ = "backtest_runs"
    
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    backtest_name = Column(String(200))
    cycle_preset = Column(String(50), nullable=False)  # Core, Extended, Advanced, Custom
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    total_cycles_tested = Column(Integer)
    total_hits = Column(Integer)
    hit_rate = Column(Float)  # percentage
    best_cycle = Column(Integer)
    worst_cycle = Column(Integer)
    convergence_used = Column(Boolean, default=False)
    tolerance_days = Column(Integer, default=1)
    summary = Column(Text)
    metadata = Column(JSON)  # Store additional backtest parameters
    created_at = Column(DateTime, default=datetime.utcnow)
    
    asset = relationship("Asset", back_populates="backtests")
    results = relationship("BacktestResult", back_populates="backtest", cascade="all, delete-orphan")

class BacktestResult(Base):
    """Individual cycle test result"""
    __tablename__ = "backtest_results"
    
    id = Column(Integer, primary_key=True)
    backtest_id = Column(Integer, ForeignKey("backtest_runs.id"), nullable=False)
    projection_id = Column(Integer, ForeignKey("cycle_projections.id"))
    cycle_length = Column(Integer, nullable=False)
    tested_date = Column(DateTime, nullable=False)
    actual_high = Column(Float)
    actual_low = Column(Float)
    actual_close = Column(Float)
    reaction_type = Column(String(50), nullable=False)  # Major Top, Major Bottom, Higher Low, Lower High, Pullback, No Reaction
    confidence_score = Column(Float)  # 0-100
    hit = Column(Boolean)  # True if reaction occurred near projected date
    
    backtest = relationship("BacktestRun", back_populates="results")
    projection = relationship("CycleProjection", back_populates="backtest_results")

class ConfluenceZone(Base):
    """Convergence/confluence results from multiple anchors"""
    __tablename__ = "confluence_zones"
    
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    zone_date = Column(DateTime, nullable=False)
    anchor_count = Column(Integer)  # How many anchors converge at this date
    confluence_score = Column(Float)  # 0-100, higher = stronger confluence
    cycle_lengths_involved = Column(JSON)  # List of cycles that converge
    historical_reaction = Column(String(100))  # What actually happened at this zone
    historical_confirmed = Column(Boolean)  # Did the zone produce a reaction?
    created_at = Column(DateTime, default=datetime.utcnow)

class IndicatorSnapshot(Base):
    """Technical indicator values at key dates"""
    __tablename__ = "indicator_snapshots"
    
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    snapshot_date = Column(DateTime, nullable=False)
    rsi = Column(Float)  # Relative Strength Index
    macd = Column(Float)  # MACD line
    macd_signal = Column(Float)
    sma_20 = Column(Float)  # Simple Moving Average
    sma_50 = Column(Float)
    atr = Column(Float)  # Average True Range
    volume_sma = Column(Float)
    metadata = Column(JSON)  # Store other indicator values
    created_at = Column(DateTime, default=datetime.utcnow)

class SavedAnalysis(Base):
    """Full analysis session saved by user"""
    __tablename__ = "saved_analyses"
    
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    analysis_name = Column(String(200), nullable=False)
    analysis_type = Column(String(50), nullable=False)  # single-anchor, convergence
    anchor_ids = Column(JSON)  # List of anchor IDs used
    cycle_preset = Column(String(50))
    custom_cycles = Column(JSON)
    analysis_results = Column(JSON)  # Store the full analysis output
    ai_summary = Column(Text)  # AI-generated explanation
    indicators_used = Column(JSON)  # Which indicators were included
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
