import { logger } from "./logger";

interface MempoolStats {
  count: number;
  vsize: number;
  totalFee: number;
  feeHistogram: Array<[number, number]>;
}

interface RecentBlock {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  size: number;
  weight: number;
}

interface FeeEstimates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

interface PriceTick {
  ts: number;
  usd: number;
}

const cache: Record<string, { data: unknown; ts: number }> = {};

async function fetchJson<T>(url: string, ttlMs: number, key: string): Promise<T | null> {
  const c = cache[key] as { data: T; ts: number } | undefined;
  if (c && Date.now() - c.ts < ttlMs) return c.data;
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`${r.status}`);
    const data = (await r.json()) as T;
    cache[key] = { data, ts: Date.now() };
    return data;
  } catch (err) {
    logger.warn({ err, url }, "fetchJson failed");
    return c?.data ?? null;
  }
}

function cacheGet<T>(key: string, ttlMs: number): T | null {
  const c = cache[key];
  if (c && Date.now() - c.ts < ttlMs) return c.data as T;
  return null;
}
function cacheSet<T>(key: string, data: T): void {
  cache[key] = { data, ts: Date.now() };
}
function cachePeek<T>(key: string): T | null {
  return (cache[key]?.data as T) ?? null;
}

export async function getMempoolStats(): Promise<MempoolStats | null> {
  return fetchJson<MempoolStats>("https://mempool.space/api/mempool", 4_000, "mempool");
}

export async function getRecentBlocks(): Promise<RecentBlock[] | null> {
  type RawBlock = {
    id: string; height: number; timestamp: number; tx_count: number; size: number; weight: number;
  };
  const cached = cacheGet<RecentBlock[]>("blocks", 8_000);
  if (cached) return cached;
  try {
    const r = await fetch("https://mempool.space/api/v1/blocks");
    if (!r.ok) throw new Error(`${r.status}`);
    const raw = (await r.json()) as RawBlock[];
    const data: RecentBlock[] = raw.slice(0, 10).map((b) => ({
      id: b.id,
      height: b.height,
      timestamp: b.timestamp,
      txCount: b.tx_count,
      size: b.size,
      weight: b.weight,
    }));
    cacheSet("blocks", data);
    return data;
  } catch (err) {
    logger.warn({ err }, "blocks fetch failed");
    return cachePeek<RecentBlock[]>("blocks");
  }
}

export async function getFeeEstimates(): Promise<FeeEstimates | null> {
  return fetchJson<FeeEstimates>("https://mempool.space/api/v1/fees/recommended", 8_000, "fees");
}

export async function getTipHeight(): Promise<number | null> {
  const cached = cacheGet<number>("height", 4_000);
  if (cached !== null) return cached;
  try {
    const r = await fetch("https://mempool.space/api/blocks/tip/height");
    if (!r.ok) throw new Error(`${r.status}`);
    const text = await r.text();
    const data = parseInt(text, 10);
    if (Number.isFinite(data)) {
      cacheSet("height", data);
      return data;
    }
  } catch {}
  return cachePeek<number>("height");
}

export async function getDifficultyAdjustment() {
  type RawDA = { progressPercent: number; difficultyChange: number; remainingBlocks: number; estimatedRetargetDate: number };
  const cached = cacheGet<RawDA>("difficulty", 30_000);
  if (cached) return cached;
  try {
    const r = await fetch("https://mempool.space/api/v1/difficulty-adjustment");
    if (!r.ok) throw new Error(`${r.status}`);
    const raw = (await r.json()) as RawDA;
    const data: RawDA = {
      progressPercent: raw.progressPercent,
      difficultyChange: raw.difficultyChange,
      remainingBlocks: raw.remainingBlocks,
      estimatedRetargetDate: raw.estimatedRetargetDate,
    };
    cacheSet("difficulty", data);
    return data;
  } catch (err) {
    logger.warn({ err }, "difficulty fetch failed");
    return cachePeek<RawDA>("difficulty");
  }
}

export async function getCurrentBtcPrice(): Promise<number | null> {
  const cached = cacheGet<number>("price", 10_000);
  if (cached !== null) return cached;
  try {
    const r = await fetch("https://mempool.space/api/v1/prices");
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { USD: number };
    if (j?.USD > 0) {
      cacheSet("price", j.USD);
      return j.USD;
    }
  } catch {}
  return cachePeek<number>("price");
}

export async function getPriceHistory(): Promise<PriceTick[] | null> {
  const cached = cacheGet<PriceTick[]>("history", 6 * 60 * 60 * 1000);
  if (cached) return cached;
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily",
    );
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { prices: Array<[number, number]> };
    const data: PriceTick[] = j.prices.map((p) => ({ ts: p[0], usd: p[1] }));
    cacheSet("history", data);
    return data;
  } catch (err) {
    logger.warn({ err }, "history fetch failed");
    return cachePeek<PriceTick[]>("history");
  }
}

const HALVING_HEIGHTS = [
  { height: 0, reward: 50, date: new Date("2009-01-03").getTime() },
  { height: 210_000, reward: 25, date: new Date("2012-11-28").getTime() },
  { height: 420_000, reward: 12.5, date: new Date("2016-07-09").getTime() },
  { height: 630_000, reward: 6.25, date: new Date("2020-05-11").getTime() },
  { height: 840_000, reward: 3.125, date: new Date("2024-04-20").getTime() },
  { height: 1_050_000, reward: 1.5625, date: new Date("2028-04-01").getTime() },
  { height: 1_260_000, reward: 0.78125, date: new Date("2032-04-01").getTime() },
];

function rewardAt(height: number): number {
  let r = 50;
  for (const h of HALVING_HEIGHTS) {
    if (height >= h.height) r = h.reward;
  }
  return r;
}

function totalSupplyAt(height: number): number {
  let supply = 0;
  for (let i = 0; i < HALVING_HEIGHTS.length; i++) {
    const h = HALVING_HEIGHTS[i]!;
    const next = HALVING_HEIGHTS[i + 1];
    if (!next || height < next.height) {
      const blocks = height - h.height;
      supply += blocks * h.reward;
      break;
    } else {
      supply += (next.height - h.height) * h.reward;
    }
  }
  return supply;
}

function timestampAtHeight(height: number): number {
  for (let i = HALVING_HEIGHTS.length - 1; i >= 0; i--) {
    const h = HALVING_HEIGHTS[i]!;
    if (height >= h.height) {
      const next = HALVING_HEIGHTS[i + 1];
      if (next) {
        const frac = (height - h.height) / (next.height - h.height);
        return h.date + (next.date - h.date) * frac;
      }
      const blocksAhead = height - h.height;
      return h.date + blocksAhead * 10 * 60 * 1000;
    }
  }
  return HALVING_HEIGHTS[0]!.date;
}

export interface S2FPoint {
  ts: number;
  height: number;
  supply: number;
  flow: number;
  s2f: number;
  modelPrice: number;
  marketPrice: number | null;
}

export async function getStockToFlowSeries(): Promise<{
  points: S2FPoint[];
  modelPrice: number;
  marketPrice: number;
  currentS2F: number;
  nextHalving: { height: number; date: number; estimatedDays: number } | null;
}> {
  const tipHeight = (await getTipHeight()) ?? 880_000;
  const currentPrice = (await getCurrentBtcPrice()) ?? 0;
  const history = (await getPriceHistory()) ?? [];
  const histByYear: Map<string, number> = new Map();
  for (const p of history) {
    const ym = new Date(p.ts).toISOString().slice(0, 7);
    histByYear.set(ym, p.usd);
  }
  const startHeight = 50_000;
  const stepBlocks = 4_500;
  const points: S2FPoint[] = [];
  for (let h = startHeight; h <= tipHeight + 210_000; h += stepBlocks) {
    const supply = totalSupplyAt(h);
    const reward = rewardAt(h);
    const flow = reward * 144 * 365;
    const s2f = supply / flow;
    const modelPrice = Math.exp(-1.84) * Math.pow(s2f, 3.36);
    const ts = timestampAtHeight(h);
    let marketPrice: number | null = null;
    if (h <= tipHeight) {
      const ym = new Date(ts).toISOString().slice(0, 7);
      marketPrice = histByYear.get(ym) ?? null;
    }
    points.push({ ts, height: h, supply, flow, s2f, modelPrice, marketPrice });
  }
  const supply = totalSupplyAt(tipHeight);
  const reward = rewardAt(tipHeight);
  const flow = reward * 144 * 365;
  const s2f = supply / flow;
  const modelPrice = Math.exp(-1.84) * Math.pow(s2f, 3.36);
  const next = HALVING_HEIGHTS.find((h) => h.height > tipHeight);
  const nextHalving = next
    ? {
        height: next.height,
        date: next.date,
        estimatedDays: ((next.height - tipHeight) * 10) / (60 * 24),
      }
    : null;
  return {
    points,
    modelPrice,
    marketPrice: currentPrice,
    currentS2F: s2f,
    nextHalving,
  };
}
