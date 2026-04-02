import { db, tradesTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
}

export interface PortfolioMetrics {
  equity: number;
  openPositions: number;
  todayRealizedLoss: number;
  totalExposure: number;
  maxDrawdown: number;
}

const DEFAULT_SETTINGS = {
  maxDailyLoss: 500,
  maxPositionSize: 0.1,
  maxOpenPositions: 5,
  stopLossEnforcement: true,
  maxDrawdownPct: 0.15,
  tradingEnabled: true,
};

export async function getRiskSettings() {
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    if (!rows[0]) return DEFAULT_SETTINGS;
    const s = rows[0];
    return {
      maxDailyLoss: s.maxDailyLoss,
      maxPositionSize: s.maxPositionSize,
      maxOpenPositions: s.maxOpenPositions,
      stopLossEnforcement: s.stopLossEnforcement,
      maxDrawdownPct: s.maxDrawdownPct,
      tradingEnabled: s.tradingEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function getStartingEquity(): Promise<number> {
  try {
    const [settings] = await db.select().from(settingsTable);
    return settings?.accountSize ?? 100_000;
  } catch {
    return 100_000;
  }
}

export async function getPortfolioMetrics(currentPrices: Record<string, number> = {}): Promise<PortfolioMetrics> {
  const startingEquity = await getStartingEquity();

  try {
    const allTrades = await db.select().from(tradesTable);
    const openTrades = allTrades.filter(t => t.status === "open");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayClosedTrades = allTrades.filter(t =>
      t.status === "closed" && t.closedAt && new Date(t.closedAt) >= today
    );

    const todayRealizedLoss = todayClosedTrades
      .filter(t => (t.realizedPnl ?? 0) < 0)
      .reduce((sum, t) => sum + Math.abs(t.realizedPnl ?? 0), 0);

    const unrealizedPnl = openTrades.reduce((sum, t) => {
      const currentPrice = currentPrices[t.symbol] ?? t.entryPrice;
      const pnl = t.side === "short"
        ? (t.entryPrice - currentPrice) * t.shares
        : (currentPrice - t.entryPrice) * t.shares;
      return sum + pnl;
    }, 0);

    const realizedPnl = allTrades
      .filter(t => t.status === "closed")
      .reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);

    const equity = startingEquity + realizedPnl + unrealizedPnl;
    const totalExposure = openTrades.reduce((sum, t) => sum + t.entryPrice * t.shares, 0);

    const maxDrawdown = Math.max(0, (startingEquity - equity) / startingEquity);

    return {
      equity,
      openPositions: openTrades.length,
      todayRealizedLoss,
      totalExposure,
      maxDrawdown,
    };
  } catch {
    return {
      equity: startingEquity,
      openPositions: 0,
      todayRealizedLoss: 0,
      totalExposure: 0,
      maxDrawdown: 0,
    };
  }
}

export async function checkRisk(
  action: string,
  symbol: string,
  shares: number,
  entryPrice: number,
  currentPrices: Record<string, number> = {}
): Promise<RiskCheckResult> {
  const settings = await getRiskSettings();

  if (!settings.tradingEnabled) {
    return { allowed: false, reason: "Trading is currently disabled in risk settings.", riskLevel: "blocked" };
  }

  if (action === "HOLD") {
    return { allowed: true, riskLevel: "low" };
  }

  const metrics = await getPortfolioMetrics(currentPrices);

  if (action === "BUY" || action === "STRONG BUY") {
    if (metrics.openPositions >= settings.maxOpenPositions) {
      return {
        allowed: false,
        reason: `Max open positions reached (${settings.maxOpenPositions}). Close some positions before opening new ones.`,
        riskLevel: "blocked",
      };
    }

    const tradeValue = shares * entryPrice;
    const safeEquity = metrics.equity > 0 ? metrics.equity : 1;
    const positionPct = tradeValue / safeEquity;

    if (positionPct > settings.maxPositionSize) {
      const maxShares = Math.floor((metrics.equity * settings.maxPositionSize) / entryPrice);
      return {
        allowed: false,
        reason: `Position size ${(positionPct * 100).toFixed(1)}% exceeds max allowed ${(settings.maxPositionSize * 100).toFixed(0)}%. Max ${maxShares} shares at this price.`,
        riskLevel: "blocked",
      };
    }

    if (metrics.todayRealizedLoss >= settings.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit of $${settings.maxDailyLoss} reached. No more trades today.`,
        riskLevel: "blocked",
      };
    }

    if (metrics.maxDrawdown >= settings.maxDrawdownPct) {
      return {
        allowed: false,
        reason: `Portfolio drawdown (${(metrics.maxDrawdown * 100).toFixed(1)}%) exceeds max allowed ${(settings.maxDrawdownPct * 100).toFixed(0)}%. Protect capital first.`,
        riskLevel: "blocked",
      };
    }

    const riskLevel = positionPct > 0.07 ? "high" : positionPct > 0.04 ? "medium" : "low";
    return { allowed: true, riskLevel };
  }

  return { allowed: true, riskLevel: "low" };
}

export async function enforceStopLosses(currentPrices: Record<string, number>): Promise<{ closed: string[]; triggered: number }> {
  const settings = await getRiskSettings();
  if (!settings.stopLossEnforcement) return { closed: [], triggered: 0 };

  const openTrades = await db.select().from(tradesTable).where(eq(tradesTable.status, "open"));
  const closed: string[] = [];

  for (const trade of openTrades) {
    if (!trade.stopLoss) continue;
    const currentPrice = currentPrices[trade.symbol];
    if (!currentPrice) continue;

    const isLong = trade.side !== "short";
    const hitStopLoss = isLong
      ? currentPrice <= trade.stopLoss
      : currentPrice >= trade.stopLoss;
    const hitTakeProfit = !!trade.takeProfit && (isLong
      ? currentPrice >= trade.takeProfit
      : currentPrice <= trade.takeProfit);

    if (hitStopLoss || hitTakeProfit) {
      const costBasis = trade.entryPrice * trade.shares;
      const realizedPnl = isLong
        ? (currentPrice - trade.entryPrice) * trade.shares
        : (trade.entryPrice - currentPrice) * trade.shares;
      const realizedPnlPercent = costBasis > 0 ? (realizedPnl / costBasis) * 100 : 0;
      const reason = hitTakeProfit ? "Take Profit" : "Stop Loss";

      await db.update(tradesTable).set({
        exitPrice: currentPrice,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        realizedPnlPercent: Math.round(realizedPnlPercent * 100) / 100,
        status: "closed",
        closedAt: new Date(),
        notes: `Risk Manager: ${reason} triggered at $${currentPrice}`,
      }).where(eq(tradesTable.id, trade.id));

      closed.push(`${trade.symbol} (${reason}: $${currentPrice})`);
    }
  }

  return { closed, triggered: closed.length };
}
