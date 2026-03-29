import { Router, type IRouter } from "express";
import { getBrokerageStatus, getBrokerageAdapter } from "../lib/brokerage";

const router: IRouter = Router();

router.get("/status", (_req, res) => {
  res.json(getBrokerageStatus());
});

router.get("/account", async (_req, res) => {
  try {
    const adapter = getBrokerageAdapter();
    const account = await adapter.getAccount();
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to get account" });
  }
});

router.get("/market-open", async (_req, res) => {
  try {
    const adapter = getBrokerageAdapter();
    const open = await adapter.isMarketOpen();
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const timeET = ((hour - 4 + 24) % 24) * 60 + minute;

    res.json({
      isOpen: open,
      currentTimeET: `${String((hour - 4 + 24) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`,
      marketHours: "9:30 AM – 4:00 PM ET, Mon–Fri",
      preMarket: !open && timeET >= 4 * 60 && timeET < 9 * 60 + 30,
      afterHours: !open && timeET >= 16 * 60 && timeET < 20 * 60,
      isWeekend: day === 0 || day === 6,
    });
  } catch {
    res.status(500).json({ error: "Failed to check market status" });
  }
});

export default router;
