import { Router, type IRouter } from "express";
import { db, riskSettingsTable } from "@workspace/db";
import { getRiskSettings, getPortfolioMetrics, enforceStopLosses } from "../lib/risk-manager";

const router: IRouter = Router();

router.get("/settings", async (_req, res) => {
  try {
    const settings = await getRiskSettings();
    res.json(settings);
  } catch {
    res.status(500).json({ error: "Failed to get risk settings" });
  }
});

router.put("/settings", async (req, res) => {
  const { maxDailyLoss, maxPositionSize, maxOpenPositions, stopLossEnforcement, maxDrawdownPct, tradingEnabled } = req.body;

  try {
    const existing = await db.select().from(riskSettingsTable).limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(riskSettingsTable).set({
        ...(maxDailyLoss !== undefined && { maxDailyLoss }),
        ...(maxPositionSize !== undefined && { maxPositionSize }),
        ...(maxOpenPositions !== undefined && { maxOpenPositions }),
        ...(stopLossEnforcement !== undefined && { stopLossEnforcement }),
        ...(maxDrawdownPct !== undefined && { maxDrawdownPct }),
        ...(tradingEnabled !== undefined && { tradingEnabled }),
        updatedAt: new Date(),
      }).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(riskSettingsTable).values({
        maxDailyLoss: maxDailyLoss ?? 500,
        maxPositionSize: maxPositionSize ?? 0.1,
        maxOpenPositions: maxOpenPositions ?? 5,
        stopLossEnforcement: stopLossEnforcement ?? true,
        maxDrawdownPct: maxDrawdownPct ?? 0.15,
        tradingEnabled: tradingEnabled ?? true,
      }).returning();
      res.status(201).json(created);
    }
  } catch {
    res.status(500).json({ error: "Failed to save risk settings" });
  }
});

router.get("/metrics", async (_req, res) => {
  try {
    const metrics = await getPortfolioMetrics();
    const settings = await getRiskSettings();

    const dailyLossUsed = Math.min(100, (metrics.todayRealizedLoss / settings.maxDailyLoss) * 100);
    const drawdownUsed = Math.min(100, (metrics.maxDrawdown / settings.maxDrawdownPct) * 100);
    const positionsUsed = Math.min(100, (metrics.openPositions / settings.maxOpenPositions) * 100);

    res.json({
      ...metrics,
      settings,
      health: {
        dailyLossUsed: Math.round(dailyLossUsed),
        drawdownUsed: Math.round(drawdownUsed),
        positionsUsed: Math.round(positionsUsed),
        overallStatus: dailyLossUsed > 90 || drawdownUsed > 90 ? "danger" :
          dailyLossUsed > 60 || drawdownUsed > 60 ? "warning" : "healthy",
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to get risk metrics" });
  }
});

router.post("/enforce-stops", async (req, res) => {
  const { currentPrices = {} } = req.body;
  try {
    const result = await enforceStopLosses(currentPrices);
    res.json({ success: true, ...result });
  } catch {
    res.status(500).json({ error: "Failed to enforce stop losses" });
  }
});

export default router;
