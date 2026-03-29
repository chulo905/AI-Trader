import { Router, type NextFunction, type Request, type Response, type IRouter } from "express";
import { db, watchlistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateWatchlistBody, UpdateWatchlistBody, AddWatchlistSymbolBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await db.select().from(watchlistsTable).orderBy(watchlistsTable.createdAt);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateWatchlistBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }
    const { name, description, symbols } = parsed.data;
    const [created] = await db.insert(watchlistsTable).values({
      name,
      description: description ?? null,
      symbols: symbols ?? [],
      isDefault: false,
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"]!, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID", code: "VALIDATION_ERROR", message: "id must be a number" });
      return;
    }

    const parsed = UpdateWatchlistBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const updates: Partial<{ name: string; description: string | null; symbols: string[]; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (parsed.data.name !== undefined && parsed.data.name !== null) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
    if (parsed.data.symbols !== undefined && parsed.data.symbols !== null) updates.symbols = parsed.data.symbols;

    const [updated] = await db.update(watchlistsTable)
      .set(updates)
      .where(eq(watchlistsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Watchlist not found", code: "NOT_FOUND", message: `No watchlist with id ${id}` });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"]!, 10);
    await db.delete(watchlistsTable).where(eq(watchlistsTable.id, id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/symbols", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"]!, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID", code: "VALIDATION_ERROR", message: "id must be a number" });
      return;
    }

    const parsed = AddWatchlistSymbolBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const [existing] = await db.select().from(watchlistsTable).where(eq(watchlistsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Watchlist not found", code: "NOT_FOUND", message: `No watchlist with id ${id}` });
      return;
    }

    const sym = parsed.data.symbol.toUpperCase();
    if (!existing.symbols.includes(sym)) {
      const [updated] = await db.update(watchlistsTable)
        .set({ symbols: [...existing.symbols, sym], updatedAt: new Date() })
        .where(eq(watchlistsTable.id, id))
        .returning();
      res.json(updated);
    } else {
      res.json(existing);
    }
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/symbols/:symbol", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params["id"]!, 10);
    const symbol = req.params["symbol"]!.toUpperCase();

    const [existing] = await db.select().from(watchlistsTable).where(eq(watchlistsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Watchlist not found", code: "NOT_FOUND", message: `No watchlist with id ${id}` });
      return;
    }

    const [updated] = await db.update(watchlistsTable)
      .set({ symbols: existing.symbols.filter(s => s !== symbol), updatedAt: new Date() })
      .where(eq(watchlistsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
