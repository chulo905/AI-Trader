import { Router, type IRouter } from "express";
import { db, alertsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res, next) => {
  try {
    const data = await db.select().from(alertsTable).orderBy(alertsTable.createdAt);
    res.json(data.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      triggeredAt: a.triggeredAt?.toISOString() ?? null,
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { symbol, type, value, message } = req.body;
    if (!symbol || !type) {
      res.status(400).json({ error: "symbol and type are required" });
      return;
    }
    const [created] = await db.insert(alertsTable).values({
      symbol: symbol.toUpperCase(),
      type,
      value: value !== undefined ? parseFloat(value) : null,
      message: message ?? null,
      isActive: true,
      isTriggered: false,
    }).returning();
    res.status(201).json({ ...created!, createdAt: created!.createdAt.toISOString(), triggeredAt: null });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params["id"]!, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid alert ID" });
      return;
    }
    await db.delete(alertsTable).where(eq(alertsTable.id, id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
