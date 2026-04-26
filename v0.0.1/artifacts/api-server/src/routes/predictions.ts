import { Router, type IRouter } from "express";
import { getStats, resetTracker } from "../lib/prediction-tracker";

const router: IRouter = Router();

router.get("/predictions/stats", (_req, res) => {
  res.json(getStats());
});

router.post("/predictions/reset", (_req, res) => {
  resetTracker();
  res.json({ ok: true });
});

export default router;
