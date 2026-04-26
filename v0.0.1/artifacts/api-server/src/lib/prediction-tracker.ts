import { logger } from "./logger";

export type Direction = "up" | "down" | "flat";
export type Outcome = "hit" | "miss" | "flat";

interface PendingPrediction {
  id: string;
  horizonSeconds: number;
  createdAt: number;
  resolveAt: number;
  entryPrice: number;
  predictedDirection: Direction;
  predictedDeltaBps: number;
  confidence: number;
}

interface ResolvedPrediction {
  id: string;
  horizonSeconds: number;
  createdAt: number;
  resolvedAt: number;
  entryPrice: number;
  exitPrice: number;
  predictedDirection: Direction;
  actualDirection: Direction;
  actualDeltaBps: number;
  predictedDeltaBps: number;
  outcome: Outcome;
  confidence: number;
}

const HORIZONS = [5, 10, 30, 60];
const SAMPLE_INTERVAL_MS = 1_000; // record at most one prediction per horizon per second
const MAX_HISTORY = 5_000; // cap memory
const FLAT_THRESHOLD_BPS = 0.5; // |delta| < this → flat
const BUCKET_MS = 60_000; // 1-minute buckets for charting
const MAX_BUCKETS = 120; // last 2 hours

const pending: Map<number, PendingPrediction[]> = new Map(HORIZONS.map((h) => [h, []]));
const resolved: ResolvedPrediction[] = [];
const lastSampledAt: Map<number, number> = new Map(HORIZONS.map((h) => [h, 0]));

interface Bucket {
  ts: number;
  hits: number;
  misses: number;
  flats: number;
}
const buckets: Map<number, Map<number, Bucket>> = new Map(HORIZONS.map((h) => [h, new Map()]));

function bucketTs(ts: number): number {
  return Math.floor(ts / BUCKET_MS) * BUCKET_MS;
}

function classify(deltaBps: number): Direction {
  if (deltaBps > FLAT_THRESHOLD_BPS) return "up";
  if (deltaBps < -FLAT_THRESHOLD_BPS) return "down";
  return "flat";
}

let nextId = 1;

export interface PredictionInput {
  horizonSeconds: number;
  predictedPrice: number;
  deltaBps: number;
  direction: Direction;
  confidence: number;
}

export function recordPredictions(currentPrice: number, predictions: PredictionInput[]): void {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;
  const now = Date.now();
  for (const p of predictions) {
    const last = lastSampledAt.get(p.horizonSeconds) ?? 0;
    if (now - last < SAMPLE_INTERVAL_MS) continue;
    lastSampledAt.set(p.horizonSeconds, now);
    const arr = pending.get(p.horizonSeconds);
    if (!arr) continue;
    arr.push({
      id: String(nextId++),
      horizonSeconds: p.horizonSeconds,
      createdAt: now,
      resolveAt: now + p.horizonSeconds * 1000,
      entryPrice: currentPrice,
      predictedDirection: p.direction,
      predictedDeltaBps: p.deltaBps,
      confidence: p.confidence,
    });
  }
  resolveExpired(currentPrice);
}

function resolveExpired(currentPrice: number): void {
  const now = Date.now();
  for (const horizon of HORIZONS) {
    const arr = pending.get(horizon);
    if (!arr) continue;
    let cut = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p) continue;
      if (now < p.resolveAt) break;
      cut = i + 1;
      const actualDeltaBps = ((currentPrice - p.entryPrice) / p.entryPrice) * 10_000;
      const actualDirection = classify(actualDeltaBps);
      let outcome: Outcome = "miss";
      if (p.predictedDirection === "flat" || actualDirection === "flat") outcome = "flat";
      else if (p.predictedDirection === actualDirection) outcome = "hit";
      else outcome = "miss";

      const r: ResolvedPrediction = {
        id: p.id,
        horizonSeconds: p.horizonSeconds,
        createdAt: p.createdAt,
        resolvedAt: now,
        entryPrice: p.entryPrice,
        exitPrice: currentPrice,
        predictedDirection: p.predictedDirection,
        actualDirection,
        actualDeltaBps,
        predictedDeltaBps: p.predictedDeltaBps,
        outcome,
        confidence: p.confidence,
      };
      resolved.push(r);
      if (resolved.length > MAX_HISTORY) resolved.splice(0, resolved.length - MAX_HISTORY);

      const bucketsForH = buckets.get(horizon);
      if (bucketsForH) {
        const bts = bucketTs(now);
        let b = bucketsForH.get(bts);
        if (!b) {
          b = { ts: bts, hits: 0, misses: 0, flats: 0 };
          bucketsForH.set(bts, b);
        }
        if (outcome === "hit") b.hits++;
        else if (outcome === "miss") b.misses++;
        else b.flats++;
        if (bucketsForH.size > MAX_BUCKETS) {
          const sorted = [...bucketsForH.keys()].sort((a, b) => a - b);
          const drop = sorted.slice(0, bucketsForH.size - MAX_BUCKETS);
          for (const k of drop) bucketsForH.delete(k);
        }
      }
    }
    if (cut > 0) arr.splice(0, cut);
  }
}

export interface HorizonStats {
  horizonSeconds: number;
  total: number;
  hits: number;
  misses: number;
  flats: number;
  accuracy: number;
  decisive: number;
  decisiveAccuracy: number;
  avgConfidence: number;
  avgAbsErrorBps: number;
  pending: number;
  upCalls: number;
  downCalls: number;
  flatCalls: number;
  upHits: number;
  downHits: number;
  buckets: { ts: number; hits: number; misses: number; flats: number }[];
}

export function getStats(): { horizons: HorizonStats[]; recent: ResolvedPrediction[]; totalsAcrossHorizons: { total: number; hits: number; misses: number; flats: number; accuracy: number } } {
  const horizons: HorizonStats[] = HORIZONS.map((h) => {
    const list = resolved.filter((r) => r.horizonSeconds === h);
    const total = list.length;
    const hits = list.filter((r) => r.outcome === "hit").length;
    const misses = list.filter((r) => r.outcome === "miss").length;
    const flats = list.filter((r) => r.outcome === "flat").length;
    const decisive = hits + misses;
    const accuracy = total > 0 ? hits / total : 0;
    const decisiveAccuracy = decisive > 0 ? hits / decisive : 0;
    const avgConfidence = total > 0 ? list.reduce((s, r) => s + r.confidence, 0) / total : 0;
    const avgAbsErrorBps = total > 0
      ? list.reduce((s, r) => s + Math.abs(r.actualDeltaBps - r.predictedDeltaBps), 0) / total
      : 0;
    const upCalls = list.filter((r) => r.predictedDirection === "up").length;
    const downCalls = list.filter((r) => r.predictedDirection === "down").length;
    const flatCalls = list.filter((r) => r.predictedDirection === "flat").length;
    const upHits = list.filter((r) => r.predictedDirection === "up" && r.outcome === "hit").length;
    const downHits = list.filter((r) => r.predictedDirection === "down" && r.outcome === "hit").length;
    const bucketsForH = buckets.get(h);
    const bucketsArr = bucketsForH
      ? [...bucketsForH.values()].sort((a, b) => a.ts - b.ts)
      : [];
    return {
      horizonSeconds: h,
      total,
      hits,
      misses,
      flats,
      accuracy,
      decisive,
      decisiveAccuracy,
      avgConfidence,
      avgAbsErrorBps,
      pending: pending.get(h)?.length ?? 0,
      upCalls,
      downCalls,
      flatCalls,
      upHits,
      downHits,
      buckets: bucketsArr,
    };
  });
  const total = resolved.length;
  const hits = resolved.filter((r) => r.outcome === "hit").length;
  const misses = resolved.filter((r) => r.outcome === "miss").length;
  const flats = resolved.filter((r) => r.outcome === "flat").length;
  const totals = {
    total,
    hits,
    misses,
    flats,
    accuracy: total > 0 ? hits / total : 0,
  };
  const recent = resolved.slice(-50).reverse();
  return { horizons, recent, totalsAcrossHorizons: totals };
}

export function resetTracker(): void {
  for (const h of HORIZONS) {
    pending.set(h, []);
    buckets.set(h, new Map());
    lastSampledAt.set(h, 0);
  }
  resolved.length = 0;
  logger.info("prediction tracker reset");
}
