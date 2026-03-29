import { pgTable, text, serial, real, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const autonomousConfigTable = pgTable("autonomous_config", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  maxShares: integer("max_shares").notNull().default(10),
  budgetPerTrade: real("budget_per_trade").notNull().default(1000),
  intervalMinutes: integer("interval_minutes").notNull().default(15),
  lastRunAt: timestamp("last_run_at"),
  lastAction: text("last_action"),
  lastReason: text("last_reason"),
  totalAutoTrades: integer("total_auto_trades").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const riskSettingsTable = pgTable("risk_settings", {
  id: serial("id").primaryKey(),
  maxDailyLoss: real("max_daily_loss").notNull().default(500),
  maxPositionSize: real("max_position_size").notNull().default(0.1),
  maxOpenPositions: integer("max_open_positions").notNull().default(5),
  stopLossEnforcement: boolean("stop_loss_enforcement").notNull().default(true),
  maxDrawdownPct: real("max_drawdown_pct").notNull().default(0.15),
  tradingEnabled: boolean("trading_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const backtestResultsTable = pgTable("backtest_results", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull().default("ai-autopilot"),
  period: text("period").notNull().default("3M"),
  totalTrades: integer("total_trades").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  totalReturn: real("total_return").notNull().default(0),
  maxDrawdown: real("max_drawdown").notNull().default(0),
  sharpeRatio: real("sharpe_ratio").notNull().default(0),
  profitFactor: real("profit_factor").notNull().default(0),
  avgWin: real("avg_win").notNull().default(0),
  avgLoss: real("avg_loss").notNull().default(0),
  summary: text("summary"),
  runAt: timestamp("run_at").notNull().defaultNow(),
});

export type AutonomousConfig = typeof autonomousConfigTable.$inferSelect;
export type RiskSettings = typeof riskSettingsTable.$inferSelect;
export type BacktestResult = typeof backtestResultsTable.$inferSelect;
