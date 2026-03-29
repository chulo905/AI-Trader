import { Router, type IRouter } from "express";
import { db, watchlistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  const data = await db.select().from(watchlistsTable).orderBy(watchlistsTable.createdAt);
  res.json(data);
});

router.post("/", async (req, res) => {
  const { name, description, symbols = [] } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [created] = await db.insert(watchlistsTable).values({
    name,
    description: description ?? null,
    symbols,
    isDefault: false,
  }).returning();
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const { name, description, symbols } = req.body;

  const updates: Partial<{ name: string; description: string | null; symbols: string[]; updatedAt: Date }> = {
    updatedAt: new Date(),
  };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (symbols !== undefined) updates.symbols = symbols;

  const [updated] = await db.update(watchlistsTable)
    .set(updates)
    .where(eq(watchlistsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Watchlist not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  await db.delete(watchlistsTable).where(eq(watchlistsTable.id, id));
  res.status(204).send();
});

router.post("/:id/symbols", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const { symbol } = req.body;
  if (!symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const [existing] = await db.select().from(watchlistsTable).where(eq(watchlistsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Watchlist not found" });
    return;
  }

  const sym = symbol.toUpperCase();
  if (!existing.symbols.includes(sym)) {
    const [updated] = await db.update(watchlistsTable)
      .set({ symbols: [...existing.symbols, sym], updatedAt: new Date() })
      .where(eq(watchlistsTable.id, id))
      .returning();
    res.json(updated);
  } else {
    res.json(existing);
  }
});

router.delete("/:id/symbols/:symbol", async (req, res) => {
  const id = parseInt(req.params["id"]!, 10);
  const symbol = req.params["symbol"]!.toUpperCase();

  const [existing] = await db.select().from(watchlistsTable).where(eq(watchlistsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Watchlist not found" });
    return;
  }

  const [updated] = await db.update(watchlistsTable)
    .set({ symbols: existing.symbols.filter(s => s !== symbol), updatedAt: new Date() })
    .where(eq(watchlistsTable.id, id))
    .returning();
  res.json(updated);
});

export default router;
