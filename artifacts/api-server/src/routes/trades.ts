import { Router, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getSingleQuote } from "../lib/tradersage";

const router: IRouter = Router();

router.get("/stats", async (_req, res) => {
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
    avgHoldTime: null,
  });
});

router.get("/", async (req, res) => {
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
});

router.post("/", async (req, res) => {
  const { symbol, side, shares, entryPrice, stopLoss, takeProfit, notes } = req.body;
  if (!symbol || !side || !shares || !entryPrice) {
    res.status(400).json({ error: "symbol, side, shares, and entryPrice are required" });
    return;
  }

  const [trade] = await db.insert(tradesTable).values({
    symbol: symbol.toUpperCase(),
    side,
    shares: parseFloat(shares),
    entryPrice: parseFloat(entryPrice),
    stopLoss: stopLoss ? parseFloat(stopLoss) : null,
    takeProfit: takeProfit ? parseFloat(takeProfit) : null,
    notes: notes ?? null,
    status: "open",
  }).returning();

  res.status(201).json({ ...trade!, openedAt: trade!.openedAt.toISOString(), closedAt: null });
});

router.post("/:id/close", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const { exitPrice, notes } = req.body;

  if (!exitPrice) {
    res.status(400).json({ error: "exitPrice is required" });
    return;
  }

  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, id));
  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }
  if (trade.status === "closed") {
    res.status(400).json({ error: "Trade is already closed" });
    return;
  }

  let closePrice = parseFloat(exitPrice);
  if (!closePrice) {
    const q = await getSingleQuote(trade.symbol);
    closePrice = q.price;
  }

  const realizedPnl = trade.side === "long"
    ? (closePrice - trade.entryPrice) * trade.shares
    : (trade.entryPrice - closePrice) * trade.shares;
  const realizedPnlPercent = (realizedPnl / (trade.entryPrice * trade.shares)) * 100;

  const [updated] = await db.update(tradesTable).set({
    exitPrice: closePrice,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    realizedPnlPercent: Math.round(realizedPnlPercent * 100) / 100,
    status: "closed",
    closedAt: new Date(),
    notes: notes ?? trade.notes,
  }).where(eq(tradesTable.id, id)).returning();

  res.json({ ...updated!, openedAt: updated!.openedAt.toISOString(), closedAt: updated!.closedAt?.toISOString() ?? null });
});

export default router;
