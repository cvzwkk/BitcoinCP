import { Router, type IRouter } from "express";
import { UpdatePaperConfigBody, UpdatePaperConfigResponse, ResetPaperResponse, GetTradesResponse } from "@workspace/api-zod";
import { getPaperState, getTrades, resetPaper, updatePaperConfig } from "../lib/paper";

const router: IRouter = Router();

router.get("/trades", (_req, res) => {
  const trades = getTrades();
  const data = GetTradesResponse.parse({ trades });
  res.json(data);
});

router.post("/paper/config", (req, res) => {
  const parsed = UpdatePaperConfigBody.parse(req.body ?? {});
  updatePaperConfig(parsed);
  const out = UpdatePaperConfigResponse.parse(getPaperState());
  res.json(out);
});

router.post("/paper/reset", (_req, res) => {
  resetPaper();
  const out = ResetPaperResponse.parse(getPaperState());
  res.json(out);
});

export default router;
