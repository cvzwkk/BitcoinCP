import { Router, type IRouter } from "express";
import {
  getMempoolStats,
  getRecentBlocks,
  getFeeEstimates,
  getTipHeight,
  getDifficultyAdjustment,
  getStockToFlowSeries,
} from "../lib/btc-data";

const router: IRouter = Router();

router.get("/btc/mempool", async (_req, res) => {
  const [stats, blocks, fees, height, difficulty] = await Promise.all([
    getMempoolStats(),
    getRecentBlocks(),
    getFeeEstimates(),
    getTipHeight(),
    getDifficultyAdjustment(),
  ]);
  res.json({
    tipHeight: height ?? 0,
    mempool: stats ?? { count: 0, vsize: 0, totalFee: 0, feeHistogram: [] },
    blocks: blocks ?? [],
    fees: fees ?? {
      fastestFee: 0,
      halfHourFee: 0,
      hourFee: 0,
      economyFee: 0,
      minimumFee: 0,
    },
    difficulty: difficulty ?? {
      progressPercent: 0,
      difficultyChange: 0,
      remainingBlocks: 0,
      estimatedRetargetDate: 0,
    },
  });
});

router.get("/btc/stock-to-flow", async (_req, res) => {
  const data = await getStockToFlowSeries();
  res.json(data);
});

export default router;
