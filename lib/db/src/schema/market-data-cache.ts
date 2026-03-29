import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketDataCacheTable = pgTable("market_data_cache", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  period: text("period").notNull(),
  barsJson: text("bars_json").notNull(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => [
  uniqueIndex("market_data_cache_symbol_timeframe_period_uniq").on(t.symbol, t.timeframe, t.period),
]);

export const insertMarketDataCacheSchema = createInsertSchema(marketDataCacheTable).omit({ id: true });
export type InsertMarketDataCache = z.infer<typeof insertMarketDataCacheSchema>;
export type MarketDataCache = typeof marketDataCacheTable.$inferSelect;
