import { pgTable, text, serial, real, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  shares: real("shares").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  realizedPnl: real("realized_pnl"),
  realizedPnlPercent: real("realized_pnl_percent"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
}, (t) => [
  index("trades_symbol_idx").on(t.symbol),
  index("trades_status_idx").on(t.status),
]);

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, openedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
