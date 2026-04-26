import { Router, type IRouter } from "express";
import { AiChatBody, AiChatResponse, GetAiInsightsResponse } from "@workspace/api-zod";
import { chat, getInsights } from "../lib/ai";

const router: IRouter = Router();

router.get("/ai/insights", (_req, res) => {
  const out = GetAiInsightsResponse.parse(getInsights());
  res.json(out);
});

router.post("/ai/chat", (req, res) => {
  const parsed = AiChatBody.parse(req.body ?? {});
  const result = chat(parsed.message);
  const out = AiChatResponse.parse(result);
  res.json(out);
});

export default router;
