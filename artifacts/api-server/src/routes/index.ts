import { Router, type IRouter } from "express";
import healthRouter from "./health";
import snapshotRouter from "./snapshot";
import paperRouter from "./paper";
import aiRouter from "./ai";
import btcRouter from "./btc";
import walletRouter from "./wallet";
import lightningRouter from "./lightning";
import onchainRouter from "./onchain";
import predictionsRouter from "./predictions";
import chartForecastRouter from "./chart-forecast";

const router: IRouter = Router();

router.use(healthRouter);
router.use(snapshotRouter);
router.use(paperRouter);
router.use(aiRouter);
router.use(btcRouter);
router.use(walletRouter);
router.use(lightningRouter);
router.use(onchainRouter);
router.use(predictionsRouter);
router.use(chartForecastRouter);

export default router;
