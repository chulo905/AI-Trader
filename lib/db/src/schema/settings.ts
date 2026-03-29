import { pgTable, text, serial, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  accountSize: real("account_size").notNull().default(100000),
  maxRiskPerTrade: real("max_risk_per_trade").notNull().default(2),
  maxDailyLoss: real("max_daily_loss").notNull().default(2000),
  defaultTimeframe: text("default_timeframe").notNull().default("1d"),
  strategyFocus: text("strategy_focus").notNull().default("momentum"),
  riskTolerance: text("risk_tolerance").notNull().default("moderate"),
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  defaultWatchlistId: integer("default_watchlist_id"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
