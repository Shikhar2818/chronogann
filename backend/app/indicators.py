"""
Technical indicators for confirming cycle signals
RSI, MACD, Moving Averages, ATR, Volume analysis
"""
import pandas as pd
import numpy as np
from typing import Dict, Optional

class TechnicalIndicators:
    """
    Calculates technical indicators to confirm or reject cycle signals.
    These are supplementary to cycle analysis, not replacements.
    """
    
    @staticmethod
    def calculate_rsi(data: pd.Series, period: int = 14) -> pd.Series:
        """
        Calculate Relative Strength Index.
        
        Args:
            data: Close prices (Series)
            period: RSI period (default 14)
        
        Returns:
            RSI values (0-100)
        """
        delta = data.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    @staticmethod
    def calculate_macd(
        data: pd.Series,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9
    ) -> Dict[str, pd.Series]:
        """
        Calculate MACD (Moving Average Convergence Divergence).
        
        Args:
            data: Close prices (Series)
            fast: Fast EMA period (default 12)
            slow: Slow EMA period (default 26)
            signal: Signal line EMA period (default 9)
        
        Returns:
            Dict with 'macd', 'signal', 'histogram'
        """
        ema_fast = data.ewm(span=fast).mean()
        ema_slow = data.ewm(span=slow).mean()
        
        macd = ema_fast - ema_slow
        macd_signal = macd.ewm(span=signal).mean()
        histogram = macd - macd_signal
        
        return {
            'macd': macd,
            'signal': macd_signal,
            'histogram': histogram
        }
    
    @staticmethod
    def calculate_moving_averages(
        data: pd.Series,
        periods: list = None
    ) -> Dict[str, pd.Series]:
        """
        Calculate Simple Moving Averages.
        
        Args:
            data: Close prices (Series)
            periods: List of periods (default [20, 50, 200])
        
        Returns:
            Dict with SMA values keyed by period
        """
        if periods is None:
            periods = [20, 50, 200]
        
        result = {}
        for period in periods:
            result[f'sma_{period}'] = data.rolling(window=period).mean()
        
        return result
    
    @staticmethod
    def calculate_atr(
        high: pd.Series,
        low: pd.Series,
        close: pd.Series,
        period: int = 14
    ) -> pd.Series:
        """
        Calculate Average True Range.
        
        Args:
            high: High prices (Series)
            low: Low prices (Series)
            close: Close prices (Series)
            period: ATR period (default 14)
        
        Returns:
            ATR values
        """
        tr1 = high - low
        tr2 = (high - close.shift()).abs()
        tr3 = (low - close.shift()).abs()
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(window=period).mean()
        
        return atr
    
    @staticmethod
    def calculate_volume_sma(volume: pd.Series, period: int = 20) -> pd.Series:
        """
        Calculate Volume Simple Moving Average.
        
        Args:
            volume: Volume data (Series)
            period: SMA period (default 20)
        
        Returns:
            Volume SMA values
        """
        return volume.rolling(window=period).mean()
    
    @staticmethod
    def analyze_indicators_at_date(
        ohlcv_df: pd.DataFrame,
        date: pd.Timestamp,
        lookback_periods: int = 100
    ) -> Dict:
        """
        Analyze all indicators at a specific date for signal confirmation.
        
        Args:
            ohlcv_df: OHLCV DataFrame
            date: Date to analyze
            lookback_periods: Periods to use for calculation
        
        Returns:
            Dict with indicator readings and confirmation signal
        """
        # Get data up to and including the target date
        cutoff_data = ohlcv_df.loc[:date].tail(lookback_periods)
        
        if len(cutoff_data) < 20:  # Need minimum data
            return {'error': 'Insufficient data', 'confirmation': 'UNKNOWN'}
        
        close = cutoff_data['close']
        high = cutoff_data['high']
        low = cutoff_data['low']
        volume = cutoff_data['volume']
        
        # Calculate indicators
        rsi = TechnicalIndicators.calculate_rsi(close)
        macd_data = TechnicalIndicators.calculate_macd(close)
        mas = TechnicalIndicators.calculate_moving_averages(close)
        atr = TechnicalIndicators.calculate_atr(high, low, close)
        vol_sma = TechnicalIndicators.calculate_volume_sma(volume)
        
        # Get latest values
        latest_rsi = rsi.iloc[-1]
        latest_macd = macd_data['macd'].iloc[-1]
        latest_signal = macd_data['signal'].iloc[-1]
        latest_histogram = macd_data['histogram'].iloc[-1]
        latest_close = close.iloc[-1]
        latest_sma20 = mas['sma_20'].iloc[-1]
        latest_sma50 = mas['sma_50'].iloc[-1]
        latest_atr = atr.iloc[-1]
        latest_vol = volume.iloc[-1]
        latest_vol_sma = vol_sma.iloc[-1]
        
        # Score confirmation (0-100, higher = stronger confirmation)
        confirmation_score = 0
        details = []
        
        # RSI analysis
        if 30 < latest_rsi < 70:
            confirmation_score += 10
            details.append(f"RSI {latest_rsi:.1f} in neutral zone")
        elif latest_rsi < 30:
            confirmation_score += 15
            details.append(f"RSI {latest_rsi:.1f} - oversold potential reversal")
        elif latest_rsi > 70:
            confirmation_score += 15
            details.append(f"RSI {latest_rsi:.1f} - overbought potential reversal")
        
        # MACD analysis
        if latest_histogram > 0 and latest_macd > latest_signal:
            confirmation_score += 15
            details.append("MACD bullish crossover")
        elif latest_histogram < 0 and latest_macd < latest_signal:
            confirmation_score += 15
            details.append("MACD bearish crossover")
        else:
            confirmation_score += 5
            details.append("MACD neutral")
        
        # Moving average analysis
        if latest_close > latest_sma20 > latest_sma50:
            confirmation_score += 15
            details.append("Price above MA20 > MA50 (uptrend)")
        elif latest_close < latest_sma20 < latest_sma50:
            confirmation_score += 15
            details.append("Price below MA20 < MA50 (downtrend)")
        else:
            confirmation_score += 5
            details.append("Moving averages neutral")
        
        # Volume analysis
        if latest_vol > latest_vol_sma * 1.2:
            confirmation_score += 10
            details.append("Volume above average")
        else:
            confirmation_score += 3
            details.append("Volume below average")

        # Support / resistance (recent swing levels — confirmation only)
        recent_high = high.tail(20).max()
        recent_low = low.tail(20).min()
        if latest_close >= recent_high * 0.98:
            confirmation_score += 8
            details.append(f"Price near resistance {recent_high:.2f}")
        elif latest_close <= recent_low * 1.02:
            confirmation_score += 8
            details.append(f"Price near support {recent_low:.2f}")

        # Determine overall confirmation level
        if confirmation_score > 70:
            confirmation = "STRONG"
        elif confirmation_score > 50:
            confirmation = "MODERATE"
        elif confirmation_score > 30:
            confirmation = "WEAK"
        else:
            confirmation = "NEUTRAL"
        
        return {
            'close': float(latest_close),
            'rsi': latest_rsi,
            'macd': latest_macd,
            'macd_signal': latest_signal,
            'macd_histogram': latest_histogram,
            'sma_20': latest_sma20,
            'sma_50': latest_sma50,
            'sma_200': mas['sma_200'].iloc[-1] if 'sma_200' in mas else None,
            'atr': latest_atr,
            'volume': latest_vol,
            'volume_sma': latest_vol_sma,
            'support': float(recent_low),
            'resistance': float(recent_high),
            'confirmation_score': confirmation_score,
            'confirmation': confirmation,
            'details': details
        }
