import { pgTable, text, serial, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketDataCacheTable = pgTable("market_data_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  dataType: text("data_type").notNull(),
  symbol: text("symbol").notNull(),
  data: jsonb("data").notNull(),
  source: text("source").notNull().default("yahoo"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("market_cache_key_idx").on(t.cacheKey),
  index("market_cache_symbol_idx").on(t.symbol),
  index("market_cache_expires_idx").on(t.expiresAt),
]);

export const insertMarketDataCacheSchema = createInsertSchema(marketDataCacheTable).omit({ id: true });
export type InsertMarketDataCache = z.infer<typeof insertMarketDataCacheSchema>;
export type MarketDataCache = typeof marketDataCacheTable.$inferSelect;
