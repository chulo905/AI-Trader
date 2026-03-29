CREATE TABLE "watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"symbols" text[] DEFAULT '{}' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"shares" real NOT NULL,
	"entry_price" real NOT NULL,
	"exit_price" real,
	"stop_loss" real,
	"take_profit" real,
	"realized_pnl" real,
	"realized_pnl_percent" real,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"type" text NOT NULL,
	"value" real,
	"message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_triggered" boolean DEFAULT false NOT NULL,
	"triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_size" real DEFAULT 100000 NOT NULL,
	"max_risk_per_trade" real DEFAULT 2 NOT NULL,
	"default_timeframe" text DEFAULT '1d' NOT NULL,
	"strategy_focus" text DEFAULT 'momentum' NOT NULL,
	"risk_tolerance" text DEFAULT 'moderate' NOT NULL,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"default_watchlist_id" integer,
	"max_daily_loss" real DEFAULT 500 NOT NULL,
	"max_position_size" real DEFAULT 0.1 NOT NULL,
	"max_open_positions" integer DEFAULT 5 NOT NULL,
	"stop_loss_enforcement" boolean DEFAULT true NOT NULL,
	"max_drawdown_pct" real DEFAULT 0.15 NOT NULL,
	"trading_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autonomous_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"max_shares" integer DEFAULT 10 NOT NULL,
	"budget_per_trade" real DEFAULT 1000 NOT NULL,
	"interval_minutes" integer DEFAULT 15 NOT NULL,
	"last_run_at" timestamp,
	"last_action" text,
	"last_reason" text,
	"total_auto_trades" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "autonomous_config_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "backtest_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"strategy" text DEFAULT 'ai-autopilot' NOT NULL,
	"period" text DEFAULT '3M' NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"win_rate" real DEFAULT 0 NOT NULL,
	"total_return" real DEFAULT 0 NOT NULL,
	"max_drawdown" real DEFAULT 0 NOT NULL,
	"sharpe_ratio" real DEFAULT 0 NOT NULL,
	"profit_factor" real DEFAULT 0 NOT NULL,
	"avg_win" real DEFAULT 0 NOT NULL,
	"avg_loss" real DEFAULT 0 NOT NULL,
	"summary" text,
	"run_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trades_symbol_idx" ON "trades" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "trades_status_idx" ON "trades" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_symbol_idx" ON "alerts" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "alerts_is_active_idx" ON "alerts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");