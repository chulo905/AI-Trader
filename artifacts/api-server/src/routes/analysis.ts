import { Router, type IRouter } from "express";
import { generateAnalysis, generateTradeIdeas } from "../lib/analysis";

const router: IRouter = Router();

router.get("/ideas", async (req, res) => {
  const limit = parseInt((req.query["limit"] as string) ?? "10", 10);
  const ideas = await generateTradeIdeas(limit);
  res.json(ideas);
});

router.get("/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const timeframe = (req.query["timeframe"] as string) ?? "1d";
  const analysis = await generateAnalysis(symbol, timeframe);
  res.json(analysis);
});

export default router;
