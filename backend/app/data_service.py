"""
Data fetching service for ChronoGann
Retrieves OHLCV data from multiple sources
"""
import pandas as pd
import yfinance as yf
from typing import Tuple, Optional
from datetime import datetime, timedelta
import asyncio

class DataFetchError(Exception):
    """Raised when data cannot be fetched"""
    pass

# Indian NSE symbols that need .NS suffix for yfinance
NSE_SYMBOLS = {
    "RELIANCE", "INFY", "TCS", "HDFCBANK", "ICICIBANK", "HINDUNILVR",
    "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK",
}


class DataService:
    """
    Fetches market data from free sources:
    - yfinance (stocks, indices, forex, crypto)
    - NSEPython (Indian equities)
    - Optional: MT5 for forex/commodities
    """
    
    @staticmethod
    def resolve_symbol(symbol: str) -> str:
        """Normalize symbol for yfinance lookup."""
        symbol = symbol.strip().upper()
        if symbol in NSE_SYMBOLS and not symbol.endswith(".NS"):
            return f"{symbol}.NS"
        if symbol == "NIFTY50":
            return "^NSEI"
        if symbol == "BTC":
            return "BTC-USD"
        if symbol == "ETH":
            return "ETH-USD"
        if symbol == "EURUSD":
            return "EURUSD=X"
        if symbol == "GBPUSD":
            return "GBPUSD=X"
        return symbol

    @staticmethod
    def fetch_yfinance(
        symbol: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetch data from yfinance.
        
        Args:
            symbol: Ticker symbol (e.g., 'AAPL', 'RELIANCE.NS', 'EURUSD=X')
            start_date: Start date (default: 5 years ago)
            end_date: End date (default: today)
            interval: '1d', '1wk', '1mo', '1h', etc.
        
        Returns:
            DataFrame with OHLCV data, index is datetime
        """
        if start_date is None:
            start_date = datetime.now() - timedelta(days=5*365)
        if end_date is None:
            end_date = datetime.now()
        
        resolved = DataService.resolve_symbol(symbol)
        try:
            data = yf.download(
                resolved,
                start=start_date,
                end=end_date,
                interval=interval,
                progress=False
            )
            
            if data.empty:
                raise DataFetchError(f"No data returned for symbol: {symbol}")

            # Flatten MultiIndex columns from yfinance (e.g. ('Close', 'AAPL'))
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = [
                    str(col[0]).lower() if isinstance(col, tuple) else str(col).lower()
                    for col in data.columns
                ]
            else:
                data.columns = [str(col).lower() for col in data.columns]
            
            # Ensure required columns exist
            required_cols = ['open', 'high', 'low', 'close', 'volume']
            for col in required_cols:
                if col not in data.columns:
                    raise DataFetchError(f"Missing column: {col}")
            
            return data
        
        except Exception as e:
            raise DataFetchError(f"Failed to fetch {symbol} from yfinance: {str(e)}")
    
    @staticmethod
    def fetch_nse(symbol: str, start_date: Optional[datetime] = None) -> pd.DataFrame:
        """
        Fetch NSE (National Stock Exchange) data for Indian stocks/indices.
        Requires NSEPython package.
        
        Args:
            symbol: NSE symbol (e.g., 'RELIANCE', 'INFY')
            start_date: Start date for historical data
        
        Returns:
            DataFrame with OHLCV data
        """
        try:
            # This is a placeholder - NSEPython API integration would go here
            # For now, fall back to yfinance with .NS suffix
            ns_symbol = symbol if symbol.endswith('.NS') else f"{symbol}.NS"
            return DataService.fetch_yfinance(ns_symbol, start_date)
        
        except Exception as e:
            raise DataFetchError(f"Failed to fetch NSE data for {symbol}: {str(e)}")
    
    @staticmethod
    def validate_data(df: pd.DataFrame) -> bool:
        """
        Validate OHLCV data integrity.
        
        Returns:
            True if data is valid, False otherwise
        """
        if df is None or df.empty:
            return False
        
        required_cols = ['open', 'high', 'low', 'close', 'volume']
        if not all(col in df.columns for col in required_cols):
            return False
        
        # Check for null values
        if df[required_cols].isnull().any().any():
            return False
        
        # Check logic: high >= low, high >= open, high >= close, low <= open, low <= close
        if (df['high'] < df['low']).any():
            return False
        
        return True
    
    @staticmethod
    def get_trading_dates(df: pd.DataFrame) -> set:
        """
        Extract set of trading dates from OHLCV DataFrame.
        
        Returns:
            Set of datetime.date objects
        """
        return set(df.index.date)


# Asset categories and examples
ASSET_CATALOG = {
    "stocks": {
        "market": "NSE/NYSE/NASDAQ",
        "symbols": {
            "RELIANCE": "Reliance Industries (NSE)",
            "INFY": "Infosys (NSE)",
            "TCS": "Tata Consultancy Services (NSE)",
            "AAPL": "Apple Inc. (NASDAQ)",
            "MSFT": "Microsoft Corp. (NASDAQ)",
            "GOOGL": "Alphabet Inc. (NASDAQ)",
        }
    },
    "indices": {
        "market": "Indices",
        "symbols": {
            "^NSEI": "NIFTY 50 (NSE Index)",
            "^BSESN": "Sensex (BSE Index)",
            "^GSPC": "S&P 500 (US Index)",
            "^DJI": "Dow Jones (US Index)",
        }
    },
    "forex": {
        "market": "Forex",
        "symbols": {
            "EURUSD=X": "EUR/USD",
            "GBPUSD=X": "GBP/USD",
            "JPYUSD=X": "JPY/USD",
            "INRUSD=X": "INR/USD",
        }
    },
    "crypto": {
        "market": "Crypto",
        "symbols": {
            "BTC-USD": "Bitcoin",
            "ETH-USD": "Ethereum",
            "BNB-USD": "Binance Coin",
        }
    },
    "commodities": {
        "market": "Commodities",
        "symbols": {
            "GC=F": "Gold Futures",
            "CL=F": "Crude Oil Futures",
            "NG=F": "Natural Gas Futures",
        }
    }
}
