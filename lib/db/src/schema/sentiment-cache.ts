import { pgTable, serial, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sentimentCacheTable = pgTable("sentiment_cache", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  score: real("score").notNull(),
  label: text("label").notNull(),
  breakdown: text("breakdown"),
  headlines: text("headlines"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => [
  uniqueIndex("sentiment_cache_symbol_uniq").on(t.symbol),
]);

export const insertSentimentCacheSchema = createInsertSchema(sentimentCacheTable).omit({ id: true });
export type InsertSentimentCache = z.infer<typeof insertSentimentCacheSchema>;
export type SentimentCache = typeof sentimentCacheTable.$inferSelect;
