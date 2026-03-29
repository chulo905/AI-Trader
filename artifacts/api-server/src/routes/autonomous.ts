import { Router, type IRouter } from "express";
import { db, autonomousConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isLoopRunning, getExecutionLog, startAutonomousLoop } from "../lib/autonomous-loop";

const router: IRouter = Router();

router.get("/status", async (_req, res) => {
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
    res.status(500).json({ error: "Failed to get autonomous status" });
  }
});

router.get("/log", (_req, res) => {
  res.json(getExecutionLog());
});

router.get("/configs", async (_req, res) => {
  try {
    const configs = await db.select().from(autonomousConfigTable);
    res.json(configs);
  } catch {
    res.status(500).json({ error: "Failed to get configs" });
  }
});

router.post("/configs", async (req, res) => {
  const { symbol, enabled, budgetPerTrade, maxShares, intervalMinutes } = req.body;
  if (!symbol) { res.status(400).json({ error: "symbol is required" }); return; }

  try {
    const existing = await db.select().from(autonomousConfigTable)
      .where(eq(autonomousConfigTable.symbol, symbol.toUpperCase()));

    if (existing.length > 0) {
      const [updated] = await db.update(autonomousConfigTable).set({
        enabled: enabled ?? existing[0]!.enabled,
        budgetPerTrade: budgetPerTrade ?? existing[0]!.budgetPerTrade,
        maxShares: maxShares ?? existing[0]!.maxShares,
        intervalMinutes: intervalMinutes ?? existing[0]!.intervalMinutes,
        updatedAt: new Date(),
      }).where(eq(autonomousConfigTable.symbol, symbol.toUpperCase())).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(autonomousConfigTable).values({
        symbol: symbol.toUpperCase(),
        enabled: enabled ?? false,
        budgetPerTrade: budgetPerTrade ?? 1000,
        maxShares: maxShares ?? 10,
        intervalMinutes: intervalMinutes ?? 15,
      }).returning();
      if (enabled) startAutonomousLoop();
      res.status(201).json(created);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save config" });
  }
});

router.patch("/configs/:symbol/toggle", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
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
  } catch {
    res.status(500).json({ error: "Failed to toggle" });
  }
});

router.delete("/configs/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  try {
    await db.delete(autonomousConfigTable).where(eq(autonomousConfigTable.symbol, symbol));
    res.json({ deleted: true, symbol });
  } catch {
    res.status(500).json({ error: "Failed to delete config" });
  }
});

export default router;
