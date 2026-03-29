import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function getOrCreate() {
  const [existing] = await db.select().from(settingsTable);
  if (existing) return existing;
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created!;
}

router.get("/", async (_req, res) => {
  const settings = await getOrCreate();
  res.json({
    accountSize: settings.accountSize,
    maxRiskPerTrade: settings.maxRiskPerTrade,
    maxDailyLoss: settings.maxDailyLoss,
    defaultTimeframe: settings.defaultTimeframe,
    strategyFocus: settings.strategyFocus,
    riskTolerance: settings.riskTolerance,
    alertsEnabled: settings.alertsEnabled,
    defaultWatchlistId: settings.defaultWatchlistId,
  });
});

router.put("/", async (req, res) => {
  const settings = await getOrCreate();
  const {
    accountSize, maxRiskPerTrade, maxDailyLoss,
    defaultTimeframe, strategyFocus, riskTolerance,
    alertsEnabled, defaultWatchlistId,
  } = req.body;

  const updates: Record<string, unknown> = {};
  if (accountSize !== undefined && accountSize !== null) updates["accountSize"] = parseFloat(accountSize);
  if (maxRiskPerTrade !== undefined && maxRiskPerTrade !== null) updates["maxRiskPerTrade"] = parseFloat(maxRiskPerTrade);
  if (maxDailyLoss !== undefined && maxDailyLoss !== null) updates["maxDailyLoss"] = parseFloat(maxDailyLoss);
  if (defaultTimeframe !== undefined && defaultTimeframe !== null) updates["defaultTimeframe"] = defaultTimeframe;
  if (strategyFocus !== undefined && strategyFocus !== null) updates["strategyFocus"] = strategyFocus;
  if (riskTolerance !== undefined && riskTolerance !== null) updates["riskTolerance"] = riskTolerance;
  if (alertsEnabled !== undefined && alertsEnabled !== null) updates["alertsEnabled"] = alertsEnabled;
  if (defaultWatchlistId !== undefined) updates["defaultWatchlistId"] = defaultWatchlistId;

  const [updated] = await db.update(settingsTable)
    .set(updates)
    .where(eq(settingsTable.id, settings.id))
    .returning();

  res.json(updated);
});

export default router;
