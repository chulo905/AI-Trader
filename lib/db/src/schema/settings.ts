import { pgTable, text, serial, real, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  accountSize: real("account_size").notNull().default(100000),
  maxRiskPerTrade: real("max_risk_per_trade").notNull().default(2),
  defaultTimeframe: text("default_timeframe").notNull().default("1d"),
  strategyFocus: text("strategy_focus").notNull().default("momentum"),
  riskTolerance: text("risk_tolerance").notNull().default("moderate"),
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  defaultWatchlistId: integer("default_watchlist_id"),
  maxDailyLoss: real("max_daily_loss").notNull().default(500),
  maxPositionSize: real("max_position_size").notNull().default(0.1),
  maxOpenPositions: integer("max_open_positions").notNull().default(5),
  stopLossEnforcement: boolean("stop_loss_enforcement").notNull().default(true),
  maxDrawdownPct: real("max_drawdown_pct").notNull().default(0.15),
  tradingEnabled: boolean("trading_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;

export type RiskSettings = Pick<
  Settings,
  | "maxDailyLoss"
  | "maxPositionSize"
  | "maxOpenPositions"
  | "stopLossEnforcement"
  | "maxDrawdownPct"
  | "tradingEnabled"
>;
