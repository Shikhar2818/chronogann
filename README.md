# ChronoGann - Time-Cycle Market Intelligence Platform

A production-grade, recruiter-worthy platform for analyzing market cycles using Gann-style time-cycle analysis, backtesting, and technical confirmation.

## Overview

**ChronoGann** is a premium fintech market research platform that helps traders, analysts, and researchers study market cycles, project high-probability reversal dates, and backtest cycle effectiveness.

### Key Features

- **Single & Convergence Analysis**: Project cycles from one anchor or detect confluence from 4-5 historical highs/lows
- **Comprehensive Backtesting**: Test cycle effectiveness against historical data, calculate hit rates by cycle length
- **Technical Confirmation**: RSI, MACD, Moving Averages, ATR overlay to confirm/reject signals
- **Holiday-Aware Trading-Day Adjustment**: Handle weekends/holidays with configurable tolerance windows
- **Export Functionality**: Export analysis as PNG images or branded PDFs
- **Multi-Market Support**: Stocks, Indices, Forex, Commodities, Crypto
- **Zero-Setup UI**: No login required, public access, instant analysis

## Architecture

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + Framer Motion |
| Charting | TradingView Lightweight Charts (or Recharts) |
| UI Components | Lucide React Icons, cmdk Palette |
| State Management | Zustand |
| Backend | FastAPI + Python |
| Data Processing | Pandas, NumPy, SciPy |
| Database | PostgreSQL on Neon |
| Serverless | AWS Lambda + API Gateway (Mangum adapter) |
| Deployment | Vercel (Frontend), AWS Lambda (Backend) |

### Data Sources

- **yfinance**: Stocks, Indices, Forex, Crypto
- **NSEPython**: Indian equities (NSE)
- **MT5 Demo**: Forex, Commodities (optional)
- **Free EOD data only** - no tick-by-tick or expensive feeds

### System Architecture

```
┌─────────────┐         ┌──────────────────┐
│  Frontend   │◄──────► │  API Gateway +   │
│  (Vercel)   │         │  Lambda (Backend)│
└─────────────┘         └──────────────────┘
       ▲                         │
       │                         ▼
       │                  ┌──────────────┐
       │                  │ PostgreSQL   │
       │                  │ (Neon)       │
       │                  └──────────────┘
       │
    (FastAPI Routes)
    /api/analyze/single-anchor
    /api/analyze/convergence
    /api/backtest
    /api/data/{symbol}
    /api/assets
```

## Installation & Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- Git
- AWS Account (for Lambda deployment)
- Neon PostgreSQL Account (free tier available)

### Local Development

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

#### Backend Setup

```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python main.py
# API runs at http://localhost:8000
# Docs at http://localhost:8000/docs
```

#### Environment Variables

**Frontend (.env.local)**:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=ChronoGann
```

**Backend (.env)**:
```
DATABASE_URL=postgresql://user:password@host/dbname
FRONTEND_URL=http://localhost:3000
```

### Database Setup

The database schema is created automatically on first API call. If you need to reset:

```bash
cd backend
python
>>> from app.models import Base
>>> from app.db import engine
>>> import asyncio
>>> asyncio.run(Base.metadata.create_all(engine))
```

## Core Modules

### Backend

#### `app/cycle_engine.py`
- **CycleAnalyzer**: Projects future cycle dates from one anchor
- **BacktestEngine**: Tests cycle effectiveness against historical data
- **ConvergenceAnalyzer**: Detects confluence zones from multiple anchors
- **ReactionClassification**: Major Top/Bottom, Higher Low, Lower High, Pullback, No Reaction

#### `app/data_service.py`
- Fetches OHLCV data from yfinance, NSEPython, MT5
- Validates data integrity
- Extracts trading dates (handles holidays/weekends)
- Asset catalog with 50+ symbols

#### `app/indicators.py`
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- SMA (Simple Moving Average) - 20, 50, 200 periods
- ATR (Average True Range)
- Volume SMA
- Indicator confirmation scoring

### Frontend

#### Pages
- **`/`** - Landing page with animated hero
- **`/analyzer`** - Core analysis tool
- **`/backtest-results`** - Historical performance
- **`/saved-analyses`** - Saved analysis sessions
- **`/about-gann`** - W.D. Gann educational content
- **`/about-project`** - Project methodology
- **`/methodology`** - Detailed explanation of cycle logic

#### Components (to be created)
- `ChartComponent` - TradingView integration
- `AnchorSelector` - Click on chart to place anchor
- `CyclePresetSelector` - Core/Extended/Advanced/Custom
- `ConfluenceCard` - Display confluence zones
- `BacktestResults` - Hit rate tables & charts
- `IndicatorPanel` - Technical indicator display
- `ExportButton` - HTML2Canvas & jsPDF export
- `CommandPalette` - Cmd+K navigation
- `LoadingSkeletons` - Animated loaders

## API Reference

### `/api/data/{symbol}`
Fetch OHLCV data.

**Query Parameters**:
- `period`: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max
- `interval`: 1d, 1wk, 1mo, 1h

**Response**:
```json
{
  "symbol": "AAPL",
  "data": [...],
  "rows": 1000
}
```

### `/api/analyze/single-anchor`
Analyze cycles from one anchor.

**Request**:
```json
{
  "symbol": "AAPL",
  "anchor": {"date": "2023-01-01T00:00:00Z", "price": 150.5, "anchor_type": "low"},
  "cycle_preset": "Core",
  "custom_cycles": null,
  "tolerance_days": 1,
  "include_indicators": true,
  "forward_days": 365
}
```

**Response**:
```json
{
  "symbol": "AAPL",
  "anchor": {...},
  "projections": [
    {
      "cycle_length": 30,
      "projected_date": "2023-01-31T00:00:00Z",
      "adjusted_date": "2023-01-31T00:00:00Z",
      "reaction": {"reaction_type": "Pullback", "confidence": 60}
    }
  ],
  "indicator_confirmation": {...}
}
```

### `/api/analyze/convergence`
Analyze confluence of multiple anchors.

**Request**:
```json
{
  "symbol": "AAPL",
  "anchors": [
    {"date": "2023-01-01T00:00:00Z", "price": 150.5, "anchor_type": "low"},
    {"date": "2023-03-15T00:00:00Z", "price": 160.0, "anchor_type": "high"},
    ...
  ],
  "cycle_preset": "Core"
}
```

**Response**:
```json
{
  "symbol": "AAPL",
  "convergence_zones": [
    {
      "zone_date": "2023-05-15",
      "anchor_count": 3,
      "confluence_score": 85.5,
      "cycles_involved": [30, 90, 180]
    }
  ]
}
```

### `/api/backtest`
Run backtest on historical anchors.

**Response**:
```json
{
  "symbol": "AAPL",
  "backtest_results": {
    "total_cycles_tested": 80,
    "total_hits": 52,
    "hit_rate": 65.0,
    "best_cycle": 90,
    "worst_cycle": 45,
    "cycle_stats": {...}
  }
}
```

## Cycle Presets

### Core (8 cycles)
30, 60, 90, 120, 180, 240, 270, 360

### Extended (4 cycles)
45, 135, 225, 315

### Advanced (4 cycles)
72, 144, 365, 720

### Custom
User-defined cycle lengths

## Response Classifications

| Type | Meaning |
|------|---------|
| Major Top | New high above anchor with reversal |
| Major Bottom | New low below anchor with reversal |
| Higher Low | Low above previous low; upside potential |
| Lower High | High below previous high; downside signal |
| Pullback | Minor move from anchor within 2% range |
| No Reaction | Price unresponsive to cycle date |

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Connect GitHub repo in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

```bash
npm run build
```

### Backend (AWS Lambda)

1. Package FastAPI app:
```bash
cd backend
zip -r lambda-deployment.zip . -x "venv/*" ".git/*"
```

2. Create Lambda function in AWS Console
3. Upload ZIP file
4. Set environment variables (DATABASE_URL, etc.)
5. Create API Gateway endpoint
6. Test with: `curl https://your-api-gateway-url/health`

Alternatively, use AWS SAM or Serverless Framework for infrastructure-as-code.

### Database (Neon)

1. Create free account at https://neon.tech
2. Create database project
3. Copy connection string
4. Set `DATABASE_URL` in backend environment

## Development Workflow

### Adding a New Feature

1. **Backend**:
   - Add route in `app/routes.py`
   - Implement logic in appropriate service
   - Update API models in Pydantic
   - Test locally at `http://localhost:8000/docs`

2. **Frontend**:
   - Create component in `components/`
   - Create page in `app/[page]/`
   - Wire up API calls with axios
   - Test with `npm run dev`

3. **Deploy**:
   - Commit to GitHub
   - Vercel auto-deploys frontend
   - Lambda update for backend (manual or CI/CD)

## Performance Optimization

- **Frontend**: Next.js automatic code splitting, image optimization, dynamic imports
- **Backend**: Async FastAPI, connection pooling, data caching
- **Database**: Indexed columns, efficient queries, read replicas on Neon
- **Charting**: Lazy-load TradingView charts, canvas optimization
- **Data**: Cache OHLCV responses, avoid re-fetching within 24hrs

## Limitations & Future Enhancements

### Current Limitations
- No real-time data (EOD only)
- No live trading execution
- No user authentication (future phase)
- Single timezone (UTC)
- Limited to 5 years historical data (yfinance)

### Future Enhancements
- Real-time charting (websocket integration)
- User accounts & portfolio tracking
- Advanced cycle patterns (geometric square, fibonacci)
- Machine learning cycle prediction
- Mobile app (React Native)
- Community forum & strategy sharing
- Premium tier with advanced indicators

## Testing

### Backend Unit Tests

```bash
pytest app/tests/test_cycle_engine.py
pytest app/tests/test_backtest.py
pytest app/tests/test_convergence.py
```

### Frontend Component Tests

```bash
npm run test
```

## Documentation

- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **RedDoc**: http://localhost:8000/redoc
- **Code Comments**: See `#` comments throughout codebase
- **Methodology**: `/methodology` page in app

## Contributing

This is a demonstration/portfolio project. Contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Disclaimer

ChronoGann is for educational and research purposes only. It is not financial advice, and past performance does not guarantee future results. Users assume all risk. Always consult a qualified financial advisor before making investment decisions.

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check the `/methodology` page for detailed explanations
- Review API docs at `/docs` endpoint

---

**ChronoGann** © 2026 - Time-Cycle Market Intelligence
