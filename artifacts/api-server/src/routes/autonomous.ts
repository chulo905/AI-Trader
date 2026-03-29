import { Router, type NextFunction, type Request, type Response, type IRouter } from "express";
import { db, autonomousConfigTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { isLoopRunning, getExecutionLog, startAutonomousLoop } from "../lib/autonomous-loop";

const router: IRouter = Router();

router.get("/status", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await db.select().from(autonomousConfigTable);
    const log = getExecutionLog();
    res.json({
      loopRunning: isLoopRunning(),
      watchedSymbols: configs.length,
      enabledSymbols: configs.filter(c => c.enabled).length,
      configs,
      recentLog: log.slice(0, 20),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/log", (_req: Request, res: Response) => {
  res.json(getExecutionLog());
});

router.get("/configs", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await db.select().from(autonomousConfigTable);
    res.json(configs);
  } catch (err) {
    next(err);
  }
});

router.post("/configs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { symbol, enabled, budgetPerTrade, maxShares, intervalMinutes } = req.body;
    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: "symbol is required" });
      return;
    }

    const sym = symbol.toUpperCase();

    const [upserted] = await db.insert(autonomousConfigTable)
      .values({
        symbol: sym,
        enabled: enabled ?? false,
        budgetPerTrade: budgetPerTrade ?? 1000,
        maxShares: maxShares ?? 10,
        intervalMinutes: intervalMinutes ?? 15,
      })
      .onConflictDoUpdate({
        target: autonomousConfigTable.symbol,
        set: {
          enabled: sql`EXCLUDED.enabled`,
          budgetPerTrade: sql`EXCLUDED."budgetPerTrade"`,
          maxShares: sql`EXCLUDED."maxShares"`,
          intervalMinutes: sql`EXCLUDED."intervalMinutes"`,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (upserted?.enabled) startAutonomousLoop();
    res.status(201).json(upserted);
  } catch (err) {
    next(err);
  }
});

router.patch("/configs/:symbol/toggle", async (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.params["symbol"]).toUpperCase();
  try {
    const [existing] = await db.select().from(autonomousConfigTable)
      .where(eq(autonomousConfigTable.symbol, symbol));

    if (!existing) {
      const [created] = await db.insert(autonomousConfigTable).values({
        symbol, enabled: true, budgetPerTrade: 1000, maxShares: 10, intervalMinutes: 15,
      }).returning();
      startAutonomousLoop();
      res.json({ ...created, toggled: true });
      return;
    }

    const [updated] = await db.update(autonomousConfigTable).set({
      enabled: !existing.enabled, updatedAt: new Date(),
    }).where(eq(autonomousConfigTable.symbol, symbol)).returning();

    if (updated?.enabled) startAutonomousLoop();
    res.json({ ...updated, toggled: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/configs/:symbol", async (req: Request, res: Response, next: NextFunction) => {
  const symbol = String(req.params["symbol"]).toUpperCase();
  try {
    await db.delete(autonomousConfigTable).where(eq(autonomousConfigTable.symbol, symbol));
    res.json({ deleted: true, symbol });
  } catch (err) {
    next(err);
  }
});

export default router;
