import { pgTable, serial, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfolioSnapshotsTable = pgTable("portfolio_snapshots", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  equity: real("equity").notNull(),
  cash: real("cash").notNull(),
  unrealizedPnl: real("unrealized_pnl").notNull(),
  realizedPnl: real("realized_pnl").notNull(),
  openPositionCount: integer("open_position_count").notNull(),
}, (t) => [
  index("portfolio_snapshots_timestamp_idx").on(t.timestamp),
]);

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshotsTable).omit({ id: true });
export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type PortfolioSnapshot = typeof portfolioSnapshotsTable.$inferSelect;
