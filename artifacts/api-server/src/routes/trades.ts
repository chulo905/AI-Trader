import { Router, type NextFunction, type Request, type Response, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getSingleQuote } from "../lib/tradersage";
import { checkRisk } from "../lib/risk-manager";
import { logger } from "../lib/logger";
import { CreateTradeBody, CloseTradeBody } from "@workspace/api-zod";
import { calculatePnl } from "../lib/services/pnl";

const router: IRouter = Router();

router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const trades = await db.select().from(tradesTable);
    const closed = trades.filter(t => t.status === "closed");
    const wins = closed.filter(t => (t.realizedPnl ?? 0) > 0);
    const losses = closed.filter(t => (t.realizedPnl ?? 0) <= 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const avgGain = wins.length > 0 ? wins.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgGain * wins.length) / (avgLoss * losses.length) : wins.length > 0 ? 999 : 0;
    const totalRealizedPnl = closed.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const pnlValues = closed.map(t => t.realizedPnl ?? 0);
    const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : null;
    const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : null;

    const tradesWithHoldTime = closed.filter(t => t.openedAt && t.closedAt);
    const avgHoldTimeHours = tradesWithHoldTime.length > 0
      ? tradesWithHoldTime.reduce((sum, t) => {
          const diffMs = new Date(t.closedAt!).getTime() - new Date(t.openedAt).getTime();
          return sum + diffMs / (1000 * 60 * 60);
        }, 0) / tradesWithHoldTime.length
      : null;

    const expectancy = closed.length > 0
      ? (winRate / 100) * avgGain - ((100 - winRate) / 100) * avgLoss
      : null;

    res.json({
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === "open").length,
      closedTrades: closed.length,
      winCount: wins.length,
      lossCount: losses.length,
      winRate: Math.round(winRate * 10) / 10,
      avgGain: Math.round(avgGain * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
      bestTrade: bestTrade !== null ? Math.round(bestTrade * 100) / 100 : null,
      worstTrade: worstTrade !== null ? Math.round(worstTrade * 100) / 100 : null,
      avgHoldTime: avgHoldTimeHours !== null ? Math.round(avgHoldTimeHours * 10) / 10 : null,
      expectancy: expectancy !== null ? Math.round(expectancy * 100) / 100 : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt((req.query["limit"] as string) ?? "50", 10);
    const offset = parseInt((req.query["offset"] as string) ?? "0", 10);
    const trades = await db.select().from(tradesTable)
      .orderBy(desc(tradesTable.openedAt))
      .limit(limit)
      .offset(offset);

    res.json(trades.map(t => ({
      ...t,
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateTradeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const { symbol, side, shares, entryPrice, stopLoss, takeProfit, notes } = parsed.data;

    const risk = await checkRisk("BUY", symbol, shares, entryPrice, { [symbol]: entryPrice });
    if (!risk.allowed) {
      res.status(422).json({ error: "Risk check failed", code: "RISK_BLOCKED", message: risk.reason ?? "Trade blocked by risk manager" });
      return;
    }

    const [trade] = await db.insert(tradesTable).values({
      symbol: symbol.toUpperCase(),
      side,
      shares,
      entryPrice,
      stopLoss: stopLoss ?? null,
      takeProfit: takeProfit ?? null,
      notes: notes ?? null,
      status: "open",
    }).returning();

    logger.info({ tradeId: trade!.id, symbol, side, shares, entryPrice }, "Trade opened");

    res.status(201).json({ ...trade!, openedAt: trade!.openedAt.toISOString(), closedAt: null });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/close-partial", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid trade ID", code: "VALIDATION_ERROR", message: "id must be a number" });
      return;
    }

    const { percent, exitPrice } = req.body as { percent?: number; exitPrice?: number };
    if (!percent || percent <= 0 || percent > 100) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: "percent must be between 1 and 100" });
      return;
    }

    const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, id));
    if (!trade) {
      res.status(404).json({ error: "Trade not found", code: "NOT_FOUND", message: `No trade with id ${id}` });
      return;
    }
    if (trade.status === "closed") {
      res.status(400).json({ error: "Trade is already closed", code: "ALREADY_CLOSED", message: "Trade is already closed" });
      return;
    }

    let closePrice = exitPrice;
    if (!closePrice) {
      const q = await getSingleQuote(trade.symbol);
      closePrice = q.price;
    }

    const closingShares = Math.round(trade.shares * (percent / 100) * 10000) / 10000;
    const remainingShares = Math.round((trade.shares - closingShares) * 10000) / 10000;
    const { realizedPnl, realizedPnlPercent } = calculatePnl(trade.side as "long" | "short", trade.entryPrice, closePrice, closingShares);

    if (remainingShares <= 0 || percent >= 100) {
      const [closed] = await db.update(tradesTable).set({
        exitPrice: closePrice,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        realizedPnlPercent: Math.round(realizedPnlPercent * 100) / 100,
        status: "closed",
        closedAt: new Date(),
        notes: `Partial close (100%): ${trade.notes ?? ""}`.trim(),
      }).where(eq(tradesTable.id, id)).returning();

      logger.info({ tradeId: id, percent, exitPrice: closePrice, realizedPnl }, "Trade fully closed via partial close");
      res.json({ ...closed!, openedAt: closed!.openedAt.toISOString(), closedAt: closed!.closedAt?.toISOString() ?? null, closedShares: closingShares, realizedPnl: Math.round(realizedPnl * 100) / 100 });
      return;
    }

    const [updated] = await db.update(tradesTable).set({
      shares: remainingShares,
      notes: `${trade.notes ?? ""} | Partial close ${percent}% @ $${closePrice}`.trim(),
    }).where(eq(tradesTable.id, id)).returning();

    logger.info({ tradeId: id, percent, closingShares, remainingShares, exitPrice: closePrice, realizedPnl }, "Trade partially closed");

    res.json({
      ...updated!,
      openedAt: updated!.openedAt.toISOString(),
      closedAt: null,
      closedShares: closingShares,
      remainingShares,
      realizedPnl: Math.round(realizedPnl * 100) / 100,
      realizedPnlPercent: Math.round(realizedPnlPercent * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/close", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid trade ID", code: "VALIDATION_ERROR", message: "id must be a number" });
      return;
    }

    const parsed = CloseTradeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const { exitPrice, notes } = parsed.data;

    let closePrice = exitPrice;
    if (!closePrice) {
      const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, id));
      if (!trade) {
        res.status(404).json({ error: "Trade not found", code: "NOT_FOUND", message: `No trade with id ${id}` });
        return;
      }
      const q = await getSingleQuote(trade.symbol);
      closePrice = q.price;
    }

    const updated = await db.transaction(async (tx) => {
      const [trade] = await tx.select().from(tradesTable).where(eq(tradesTable.id, id));
      if (!trade) {
        throw Object.assign(new Error("Trade not found"), { statusCode: 404, code: "NOT_FOUND" });
      }
      if (trade.status === "closed") {
        throw Object.assign(new Error("Trade is already closed"), { statusCode: 400, code: "ALREADY_CLOSED" });
      }

      const { realizedPnl, realizedPnlPercent } = calculatePnl(trade.side as "long" | "short", trade.entryPrice, closePrice!, trade.shares);

      const [closed] = await tx.update(tradesTable).set({
        exitPrice: closePrice,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        realizedPnlPercent: Math.round(realizedPnlPercent * 100) / 100,
        status: "closed",
        closedAt: new Date(),
        notes: notes ?? trade.notes,
      }).where(eq(tradesTable.id, id)).returning();

      return closed!;
    });

    logger.info({ tradeId: id, exitPrice: closePrice, realizedPnl: updated.realizedPnl }, "Trade closed");

    res.json({ ...updated, openedAt: updated.openedAt.toISOString(), closedAt: updated.closedAt?.toISOString() ?? null });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode) {
      res.status(e.statusCode).json({ error: e.message, code: e.code, message: e.message });
      return;
    }
    next(err);
  }
});

export default router;
