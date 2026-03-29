import { Router, type NextFunction, type Request, type Response, type IRouter } from "express";
import { getSingleQuote } from "../lib/tradersage";
import { getSentiment } from "../lib/sentiment";

const router: IRouter = Router();

router.get("/:symbol", async (req: Request, res: Response, next: NextFunction) => {
  const symbol = req.params["symbol"]!.toUpperCase();

  try {
    const quote = await getSingleQuote(symbol);
    const sentiment = await getSentiment(symbol, quote.price, quote.changePercent);
    res.json({ ...sentiment, isMock: quote.isMock });
  } catch (err) {
    next(err);
  }
});

export default router;
