# Workspace

## Overview

pnpm workspace monorepo using TypeScript — AI Trading Terminal (paper trading only). Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port from PORT env)
│   └── trading-terminal/   # React + Vite frontend (Bloomberg-style dark UI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## AI Trading Terminal

### Purpose
A professional Bloomberg-style dark terminal for paper trading, AI technical analysis, market data, and portfolio tracking. All data labeled as "Paper Trading / AI Analysis — Not Financial Advice."

### Frontend (`artifacts/trading-terminal`)
- React + Vite + TanStack React Query + Framer Motion + Lucide + lightweight-charts
- Pages (13): Dashboard, AI Pilot, Auto Loop, Charts, Portfolio, Analysis, Sentiment, Discover, Backtest, Risk, Brokerage, Alerts, Settings
- **Design system** — pure monochrome: `background` near-black `hsl(0 0% 4%)`, `card` `hsl(0 0% 7%)`, `primary` white `hsl(0 0% 96%)`. Semantic semantic only: `bullish` green `hsl(142 71% 45%)`, `bearish` red `hsl(0 84% 60%)`. NO gradients, NO shadows on cards.
- **Typography** — Inter (UI), JetBrains Mono (data/numbers). ALL-CAPS `tracking-widest` labels at `text-[10px]`/`text-[11px]`. `tabular-nums font-mono` on all prices.
- **Geometry** — `rounded-sm` everywhere (no rounded-xl/2xl/lg). Sharp card borders. Divide-y rows instead of gaps.
- Dark mode always-on: colors defined in `:root` CSS variables, no toggling needed
- State: `useAppState` (Zustand) manages `selectedSymbol` (default: "AAPL")

### Backend (`artifacts/api-server`)
- Trader Sage API integration with graceful mock data fallback (API DNS unreachable in dev)
- All market data routes: `/api/market/quote/:symbol`, `/api/market/history/:symbol`, `/api/market/quotes`, `/api/market/movers`, `/api/market/scan`
- Paper trading routes: `/api/portfolio`, `/api/portfolio/positions`, `/api/trades`, `/api/trades/:id/close`, `/api/trades/stats`
- Other routes: `/api/watchlists`, `/api/alerts`, `/api/analysis/:symbol`, `/api/ideas`, `/api/settings`
- Mock history generator: starts 5–20% below current price and mean-reverts toward it for realistic uptrend charts

### Database
- Tables: `watchlists`, `trades`, `alerts`, `settings`
- Default data: 3 watchlists seeded (Tech Leaders: 8 symbols, Index ETFs: 5 symbols, Momentum Plays: 6 symbols), default settings row (accountSize: $100,000)
- Schema pushed via `pnpm --filter @workspace/db run push`

### Critical Data-Shape Pattern

Many API endpoints return wrapped objects `{ data, isMock: true }` — NOT raw arrays. Always extract:
- Positions: use `resolvePositions(data)` from `@/lib/utils` — handles both `{ positions, isMock }` envelope and raw arrays
- Chart history: `data?.candles` (from `{ candles, isMock }`)
- Portfolio: flat object (no wrapping): `{ accountSize, cash, equity, totalPnl, ... }`

Files already fixed for this pattern: `chart.tsx`, `portfolio.tsx`, `dashboard.tsx`, `ai-pilot.tsx`, `use-paper-trade-form.ts`, `layout.tsx` (uses `queueMicrotask` to avoid render-phase setState).

### Live Market Data
- `TRADER_SAGE_API_KEY` env variable: set to enable real Trader Sage API
- Without the key (or if unreachable), all endpoints return deterministic mock data with realistic price ranges

### MiroFish Swarm Intelligence (Native OpenAI Implementation)
- 10 AI investor persona agents: Warren (Value), Kira (Technical), Maya (Macro), Tyler (Momentum), Sophia (Risk), Alex (Market Structure), Jordan (Retail Sentiment), Ethan (Event-Driven), Luna (Contrarian), Quant (Statistical)
- 2-round opinion dynamics: Round 1 = independent analysis, Round 2 = each agent reads peer consensus and can revise
- Synthesis agent aggregates all views into a Chief Strategist report
- Routes: `POST /api/mirofish/:symbol/run`, `GET /api/mirofish/:symbol/latest`, `GET /api/mirofish/:symbol/history`, `GET /api/mirofish/agents`, `GET /api/mirofish/history`
- DB table: `mirofish_simulations` — persists all simulation runs
- Frontend: `/mirofish` → "Swarm AI" page — agent vote cards, swarm donut chart, opinion dynamics panel, history
- Cache TTL: 15 minutes (in-memory cache keyed by symbol + time bucket)
- Engine: `artifacts/api-server/src/lib/mirofish.ts`

### AI Enhancements (HuggingFace + tulind)
- `HUGGINGFACE_API_TOKEN` env variable: required to enable Chronos price forecasting and Financial RoBERTa sentiment analysis
  - Without the token, `/api/market/:symbol/forecast` returns 503; the Analysis page shows a fallback message
  - Sentiment falls back through: Financial RoBERTa → DistilRoBERTa → Prosus FinBERT → GPT-only
- `GET /api/market/:symbol/forecast` — Chronos T5 Small probabilistic 5-bar forecast with direction, confidence interval, and horizon
- `GET /api/autopilot/:symbol` response includes `extended` field with Williams %R, CCI, and Aroon (all computed via tulind C bindings)
- Extended indicators are displayed on the Analysis page and AI Pilot page
- **tulind** C bindings are compiled via `onlyBuiltDependencies` in `pnpm-workspace.yaml`; `src/types/tulind.d.ts` provides TypeScript declarations

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from root** — `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files are emitted; JS is handled by esbuild/vite
- **Project references** — packages must list dependencies in their `tsconfig.json` references

## Root Scripts

- `pnpm run build` — typecheck then build all packages
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — CORS, JSON parsing, routes at `/api`
- Routes: `src/routes/index.ts`
- Market data: `src/lib/tradersage.ts` (Trader Sage API + mock fallback)
- AI analysis engine: `src/lib/analysis.ts`
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `artifacts/trading-terminal` (`@workspace/trading-terminal`)

React + Vite frontend.

- `src/pages/` — 13 pages (dashboard, ai-pilot, autonomous, chart, portfolio, analysis, sentiment, discover, backtesting, risk, brokerage, alerts, settings)
- `src/components/terminal-ui.tsx` — shared UI components (TerminalCard, TerminalButton, SignalBadge, PriceChange, DataPoint, etc.)
- `src/components/layout.tsx` — sidebar nav + header with equity/P&L ticker
- `src/lib/utils.ts` — `formatCurrency`, `formatPrice`, `formatPercent`, `formatNumber` (all null-safe)
- `src/hooks/use-app-state.ts` — Zustand store for selected symbol
- Depends on: `@workspace/api-client-react`

### `lib/db` (`@workspace/db`)

Drizzle ORM + PostgreSQL.

- `src/schema/` — table definitions
- `drizzle.config.ts` — requires `DATABASE_URL` (Replit-provided)
- Push: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval codegen.

- `openapi.yaml` — full API spec
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- Outputs to `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas. Used by `api-server` for validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated TanStack React Query v5 hooks.

- Query keys follow the URL path pattern: `['/api/portfolio/positions']`, `['/api/portfolio']`, etc.
- Custom fetch in `src/custom-fetch.ts`

### `scripts` (`@workspace/scripts`)

Utility scripts. Run via `pnpm --filter @workspace/scripts run <script>`.
