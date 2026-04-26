import { Router, type IRouter } from "express";
import { GetSnapshotResponse } from "@workspace/api-zod";
import { getVenues } from "../lib/exchanges";
import { computeBookStats, getMicropriceState } from "../lib/microprice";
import { buildPredictions } from "../lib/predictor";
import { getPaperState, getTrades } from "../lib/paper";
import { recordPredictions } from "../lib/prediction-tracker";
import { getChartPredictions } from "../lib/chart-predictor";

const router: IRouter = Router();

router.get("/snapshot", (_req, res) => {
  const now = Date.now();
  const mp = getMicropriceState();
  const book = computeBookStats();
  const venues = getVenues().map((v) => ({
    venue: v.venue,
    type: v.type,
    bid: v.bid,
    ask: v.ask,
    mid: v.bid && v.ask ? (v.bid + v.ask) / 2 : 0,
    last: v.last,
    connected: v.connected,
    ageMs: v.lastUpdateMs ? now - v.lastUpdateMs : 999_999,
  }));
  const { predictions, strategies } = buildPredictions();
  recordPredictions(mp.value, predictions);
  const paper = getPaperState();
  const recentTrades = getTrades().slice(0, 10);
  const chart = getChartPredictions();

  const data = GetSnapshotResponse.parse({
    timestamp: now,
    microprice: {
      value: mp.value,
      updatedAt: mp.updatedAt,
      updatesPerSecond: mp.updatesPerSecond,
    },
    book,
    venues,
    predictions,
    strategies,
    paper,
    recentTrades,
    chartForecast: {
      updatedAt: chart.updatedAt,
      predictions: chart.predictions.map((p) => ({
        label: p.label,
        intervalSeconds: p.intervalSeconds,
        currentPrice: p.currentPrice,
        predictedPrice: p.predictedPrice,
        deltaBps: p.deltaBps,
        direction: p.direction,
        confidence: p.confidence,
        signal: p.signal,
        score: p.score,
        reasons: p.reasons,
        indicators: p.indicators,
        candleCount: p.candleCount,
        resolvesAt: p.resolvesAt,
      })),
    },
  });
  res.json(data);
});

export default router;
