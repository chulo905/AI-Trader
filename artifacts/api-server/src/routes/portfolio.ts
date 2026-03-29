import { Router, type IRouter } from "express";
import { db, tradesTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSingleQuote } from "../lib/tradersage";

const router: IRouter = Router();

async function getOrCreateSettings() {
  const [settings] = await db.select().from(settingsTable);
  if (settings) return settings;
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created!;
}

router.get("/", async (_req, res) => {
  const settings = await getOrCreateSettings();
  const trades = await db.select().from(tradesTable);

  const openTrades = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.status === "closed");

  let openEquity = 0;
  for (const trade of openTrades) {
    try {
      const q = await getSingleQuote(trade.symbol);
      const pnl = trade.side === "long"
        ? (q.price - trade.entryPrice) * trade.shares
        : (trade.entryPrice - q.price) * trade.shares;
      openEquity += pnl;
    } catch {
      // skip
    }
  }

  const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const totalPnl = totalRealizedPnl + openEquity;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTrades = closedTrades.filter(t => t.closedAt && new Date(t.closedAt) >= today);
  const todayPnl = todayTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);

  const wins = closedTrades.filter(t => (t.realizedPnl ?? 0) > 0);
  const losses = closedTrades.filter(t => (t.realizedPnl ?? 0) <= 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const avgGain = wins.length > 0 ? wins.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / losses.length : 0;

  res.json({
    accountSize: settings.accountSize,
    cash: settings.accountSize - openTrades.reduce((s, t) => s + t.entryPrice * t.shares, 0) + totalRealizedPnl,
    equity: settings.accountSize + totalPnl,
    totalPnl,
    todayPnl,
    openPositions: openTrades.length,
    totalTrades: trades.length,
    winRate: Math.round(winRate * 10) / 10,
    avgGain: Math.round(avgGain * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
  });
});

router.get("/positions", async (_req, res) => {
  const openTrades = await db.select().from(tradesTable).where(eq(tradesTable.status, "open"));

  const positions = await Promise.all(openTrades.map(async trade => {
    let currentPrice = trade.entryPrice;
    try {
      const q = await getSingleQuote(trade.symbol);
      currentPrice = q.price;
    } catch { /* fallback */ }

    const unrealizedPnl = trade.side === "long"
      ? (currentPrice - trade.entryPrice) * trade.shares
      : (trade.entryPrice - currentPrice) * trade.shares;
    const unrealizedPnlPercent = (unrealizedPnl / (trade.entryPrice * trade.shares)) * 100;

    return {
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      shares: trade.shares,
      entryPrice: trade.entryPrice,
      currentPrice,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      unrealizedPnlPercent: Math.round(unrealizedPnlPercent * 100) / 100,
      stopLoss: trade.stopLoss ?? null,
      takeProfit: trade.takeProfit ?? null,
      openedAt: trade.openedAt.toISOString(),
    };
  }));

  res.json(positions);
});

export default router;
