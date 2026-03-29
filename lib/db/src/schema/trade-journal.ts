import { pgTable, serial, integer, text, real, timestamp, check, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tradesTable } from "./trades";

export const tradeJournalTable = pgTable("trade_journal", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().references(() => tradesTable.id, { onDelete: "cascade" }),
  tags: text("tags").array(),
  preTradeRationale: text("pre_trade_rationale"),
  postTradeNotes: text("post_trade_notes"),
  confidenceRating: integer("confidence_rating"),
  rMultiple: real("r_multiple"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("trade_journal_trade_id_uniq").on(t.tradeId),
  check("trade_journal_confidence_rating_chk", sql`${t.confidenceRating} IS NULL OR (${t.confidenceRating} >= 1 AND ${t.confidenceRating} <= 5)`),
]);

export const insertTradeJournalSchema = createInsertSchema(tradeJournalTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({ confidenceRating: z.int().min(1).max(5).nullable().optional() });
export type InsertTradeJournal = z.infer<typeof insertTradeJournalSchema>;
export type TradeJournal = typeof tradeJournalTable.$inferSelect;
