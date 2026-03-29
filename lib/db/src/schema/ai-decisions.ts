import { pgTable, serial, text, real, boolean, integer, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tradesTable } from "./trades";

export const aiDecisionActionEnum = pgEnum("ai_decision_action", ["BUY", "SELL", "HOLD"]);

export const aiDecisionsTable = pgTable("ai_decisions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  action: aiDecisionActionEnum("action").notNull(),
  confidence: real("confidence").notNull(),
  rationale: text("rationale").notNull(),
  indicatorsJson: text("indicators_json"),
  wasExecuted: boolean("was_executed").notNull().default(false),
  tradeId: integer("trade_id").references(() => tradesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_decisions_symbol_created_at_idx").on(t.symbol, t.createdAt),
]);

export const insertAiDecisionSchema = createInsertSchema(aiDecisionsTable).omit({ id: true, createdAt: true });
export type InsertAiDecision = z.infer<typeof insertAiDecisionSchema>;
export type AiDecision = typeof aiDecisionsTable.$inferSelect;
