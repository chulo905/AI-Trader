import { pgTable, text, serial, real, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const mirofishSimulationsTable = pgTable("mirofish_simulations", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  price: real("price").notNull(),
  action: text("action").notNull(),
  confidence: real("confidence").notNull(),
  dissentScore: real("dissent_score").notNull().default(0),
  agentVotes: jsonb("agent_votes").notNull().default([]),
  synthesisReport: text("synthesis_report").notNull().default(""),
  roundOneSummary: text("round_one_summary").notNull().default(""),
  roundTwoSummary: text("round_two_summary").notNull().default(""),
  swarmScore: real("swarm_score").notNull().default(0),
  bullAgents: integer("bull_agents").notNull().default(0),
  bearAgents: integer("bear_agents").notNull().default(0),
  holdAgents: integer("hold_agents").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  runAt: timestamp("run_at").notNull().defaultNow(),
}, (t) => [
  index("mirofish_symbol_idx").on(t.symbol),
  index("mirofish_run_at_idx").on(t.runAt),
]);

export type MirofishSimulation = typeof mirofishSimulationsTable.$inferSelect;
