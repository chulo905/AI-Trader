import { Router, type IRouter } from "express";
import { getSingleQuote } from "../lib/tradersage";
import { getSentiment } from "../lib/sentiment";

const router: IRouter = Router();

router.get("/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();

  try {
    const quote = await getSingleQuote(symbol);
    const sentiment = await getSentiment(symbol, quote.price, quote.changePercent);
    res.json(sentiment);
  } catch (err) {
    console.error("[Sentiment]", err);
    res.status(500).json({ error: "Failed to get sentiment" });
  }
});

export default router;
