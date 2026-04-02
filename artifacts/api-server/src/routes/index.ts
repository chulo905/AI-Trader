import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import watchlistsRouter from "./watchlists";
import portfolioRouter from "./portfolio";
import tradesRouter from "./trades";
import alertsRouter from "./alerts";
import analysisRouter from "./analysis";
import settingsRouter from "./settings";
import autopilotRouter from "./autopilot";
import autonomousRouter from "./autonomous";
import riskRouter from "./risk";
import backtestRouter from "./backtest";
import sentimentRouter from "./sentiment";
import regimeRouter from "./regime";
import brokerageRouter from "./brokerage";
import mirofishRouter from "./mirofish";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/market", marketRouter);
router.use("/watchlists", watchlistsRouter);
router.use("/portfolio", portfolioRouter);
router.use("/trades", tradesRouter);
router.use("/alerts", alertsRouter);
router.use("/analysis", analysisRouter);
router.use("/settings", settingsRouter);
router.use("/autopilot", autopilotRouter);
router.use("/autonomous", autonomousRouter);
router.use("/risk", riskRouter);
router.use("/backtest", backtestRouter);
router.use("/sentiment", sentimentRouter);
router.use("/regime", regimeRouter);
router.use("/brokerage", brokerageRouter);
router.use("/mirofish", mirofishRouter);

export default router;
