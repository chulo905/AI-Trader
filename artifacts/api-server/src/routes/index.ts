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

export default router;
