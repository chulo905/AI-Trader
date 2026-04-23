# AI Trader — Bloomberg-Style AI Paper Trading Terminal

A beginner-friendly, Bloomberg-style trading terminal powered by AI. The AI Autopilot analyzes real market data and decides BUY / SELL / HOLD in plain English — then executes paper trades automatically. No real money is ever used.

---

## Screenshots

**Dashboard** — portfolio snapshot, market movers, and open positions at a glance:

![Dashboard](screenshots/dashboard.jpg)

**AI Pilot** — enter any ticker and the AI returns a BUY/SELL/HOLD with confidence score, stop-loss, take-profit, and a complete trade plan:

![AI Pilot](screenshots/ai-pilot.jpg)

---

## Features

| Page | What it does |
|------|-------------|
| **Dashboard** | Portfolio overview, market movers, open positions, quick AI scan for 8 popular symbols |
| **AI Pilot** | Enter any stock/crypto ticker — the AI analyzes technicals, fundamentals, and sentiment, then gives a plain-English BUY/SELL/HOLD decision with a full trade plan |
| **Chart** | Interactive candlestick chart with SMA, EMA, RSI, MACD, Bollinger Bands, and volume overlays |
| **Portfolio** | Full position manager with live P&L, trade history, and performance stats |
| **Paper Trading** | Manual order ticket — market/limit orders, partial close, real-time price flash |
| **MiroFish Swarm AI** | 10 AI investor personas (Value, Momentum, Contrarian, etc.) vote and debate then synthesize a consensus recommendation |
| **Analysis** | Deep technical breakdown — chart patterns, support/resistance, pivot points, directional bias, and Chronos AI price forecast |
| **Sentiment** | GPT-powered news sentiment analysis with headline scoring and social/analyst consensus |
| **Discover** | Market movers (gainers, losers, most active) and a personal watchlist |
| **Backtest** | Simulate the AI's strategy on 1M / 3M / 6M / 1Y of historical data — equity curve, win rate, Sharpe ratio |
| **Autonomous** | Set a watch schedule — the AI checks each symbol at your chosen interval and trades automatically |
| **Risk** | Configurable guardrails: max daily loss, drawdown circuit breaker, position size cap, master kill switch |
| **Alerts** | Price alerts that trigger when a stock crosses a target level |
| **Brokerage** | Connection hub — paper trading by default, Alpaca API supported when keys are provided |
| **Settings** | Default symbol, cache duration, account info, and disclaimer |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, TanStack React Query, Framer Motion, Lucide icons, Tailwind CSS |
| Backend | Express 5 (TypeScript), OpenAI `gpt-4o-mini` |
| Database | PostgreSQL + Drizzle ORM |
| Monorepo | pnpm workspaces |
| Market Data | Yahoo Finance (via `yahoo-finance2`) with live WebSocket price streaming |

---

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- A PostgreSQL database (connection string in `DATABASE_URL`)
- An OpenAI API key (`OPENAI_API_KEY`)

### Installation

```bash
# Clone the repo
git clone https://github.com/chulo905/AI-Trader.git
cd AI-Trader

# Install all workspace dependencies
pnpm install
```

### Environment Variables

Create a `.env` file (or set these in your hosting environment):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/aitrader
OPENAI_API_KEY=sk-...
SESSION_SECRET=any-random-string
```

### Database Setup

```bash
pnpm --filter @workspace/db run db:push
```

### Run in Development

Open two terminals (or use a process manager):

```bash
# Terminal 1 — API server (port from $PORT env var, default 3001)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port from $PORT env var, default 5173)
pnpm --filter @workspace/trading-terminal run dev
```

---

## Project Structure

```
AI-Trader/
├── artifacts/
│   ├── trading-terminal/        # React + Vite frontend
│   │   └── src/
│   │       ├── pages/           # 15 page components
│   │       ├── components/      # terminal-ui design system
│   │       └── hooks/           # TanStack Query hooks
│   └── api-server/              # Express 5 backend
│       └── src/
│           └── routes/          # REST API routes
├── lib/
│   ├── db/                      # Drizzle ORM schema & client
│   └── api-client/              # Auto-generated typed API client
└── package.json                 # pnpm workspace root
```

---

## Design System

The terminal uses a custom dark design system:

- **Background**: near-black `hsl(0 0% 4%)`
- **Cards**: `hsl(0 0% 7%)` with `rounded-sm` corners
- **Typography**: Inter (UI) + JetBrains Mono (numbers/tickers)
- **Bullish**: `hsl(142 71% 45%)` green
- **Bearish**: `hsl(0 84% 60%)` red
- No gradients. ALL-CAPS `tracking-widest` labels.

---

## Disclaimer

AI Trader is a **paper trading simulator** for educational purposes only. All trades use virtual money — no real funds are at risk. AI analysis does not constitute financial advice. Past AI performance does not guarantee future results.
