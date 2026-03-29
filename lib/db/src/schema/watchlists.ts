import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchlistsTable = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  symbols: text("symbols").array().notNull().default([]),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlistsTable.$inferSelect;
