import { Router, type NextFunction, type Request, type Response, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreate() {
  const [existing] = await db.select().from(settingsTable);
  if (existing) return existing;
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created!;
}

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const settings = await getOrCreate();
    const data = parsed.data;

    const updates: Record<string, unknown> = {};
    if (data.accountSize != null) updates["accountSize"] = data.accountSize;
    if (data.maxRiskPerTrade != null) updates["maxRiskPerTrade"] = data.maxRiskPerTrade;
    if (data.maxDailyLoss != null) updates["maxDailyLoss"] = data.maxDailyLoss;
    if (data.defaultTimeframe != null && data.defaultTimeframe !== "null") updates["defaultTimeframe"] = data.defaultTimeframe;
    if (data.strategyFocus != null && data.strategyFocus !== "null") updates["strategyFocus"] = data.strategyFocus;
    if (data.riskTolerance != null && data.riskTolerance !== "null") updates["riskTolerance"] = data.riskTolerance;
    if (data.alertsEnabled != null) updates["alertsEnabled"] = data.alertsEnabled;
    if (data.defaultWatchlistId !== undefined) updates["defaultWatchlistId"] = data.defaultWatchlistId;

    const [updated] = await db.update(settingsTable)
      .set(updates)
      .where(eq(settingsTable.id, settings.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
