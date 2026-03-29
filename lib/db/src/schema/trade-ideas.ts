import { pgTable, text, serial, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradeIdeasTable = pgTable("trade_ideas", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryZone: text("entry_zone").notNull(),
  targetZone: text("target_zone").notNull(),
  stopZone: text("stop_zone").notNull(),
  rationale: text("rationale").notNull(),
  confidence: real("confidence").notNull(),
  bias: text("bias").notNull().default("neutral"),
  riskReward: real("risk_reward").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const insertTradeIdeaSchema = createInsertSchema(tradeIdeasTable).omit({ id: true });
export type InsertTradeIdea = z.infer<typeof insertTradeIdeaSchema>;
export type TradeIdea = typeof tradeIdeasTable.$inferSelect;
