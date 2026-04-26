import { getVenues } from "./exchanges";
import type { MicropriceTick, StrategyContribution } from "./types";

const HISTORY_MS = 5 * 60_000; // 5 minutes of microprice history for richer features
const TICK_HZ = 50; // 50Hz internal tick (every 20ms)

const ticks: MicropriceTick[] = [];
let updateCount = 0;
let lastSecond = Math.floor(Date.now() / 1000);
let updatesThisSecond = 0;
let updatesPerSecond = 0;

// Per-second close samples for indicator calculations (RSI/MACD).
const secondCloses: number[] = [];
const SECOND_CLOSES_MAX = 600; // 10 minutes
let lastSecondSample = 0;

export interface BookStats {
  bestBid: number;
  bestAsk: number;
  bidSize: number;
  askSize: number;
  spread: number;
  imbalance: number;
}

export function computeBookStats(): BookStats {
  const venues = getVenues().filter(
    (v) => v.connected && v.bid > 0 && v.ask > 0 && v.type === "cex",
  );
  if (!venues.length) {
    return { bestBid: 0, bestAsk: 0, bidSize: 0, askSize: 0, spread: 0, imbalance: 0 };
  }
  let bestBid = 0;
  let bestBidSize = 0;
  let bestAsk = Number.POSITIVE_INFINITY;
  let bestAskSize = 0;
  let totalBidSize = 0;
  let totalAskSize = 0;
  for (const v of venues) {
    if (v.bid > bestBid) {
      bestBid = v.bid;
      bestBidSize = v.bidSize || 1;
    }
    if (v.ask < bestAsk) {
      bestAsk = v.ask;
      bestAskSize = v.askSize || 1;
    }
    totalBidSize += v.bidSize || 0;
    totalAskSize += v.askSize || 0;
  }
  const totalSize = totalBidSize + totalAskSize;
  const imbalance = totalSize > 0 ? (totalBidSize - totalAskSize) / totalSize : 0;
  return {
    bestBid,
    bestAsk: Number.isFinite(bestAsk) ? bestAsk : bestBid,
    bidSize: bestBidSize,
    askSize: bestAskSize,
    spread: Number.isFinite(bestAsk) && bestBid > 0 ? bestAsk - bestBid : 0,
    imbalance,
  };
}

export function computeMicroprice(): number {
  const stats = computeBookStats();
  if (stats.bestBid === 0 || stats.bestAsk === 0) return 0;
  const totalSize = stats.bidSize + stats.askSize;
  if (totalSize <= 0) return (stats.bestBid + stats.bestAsk) / 2;
  return (stats.askSize * stats.bestBid + stats.bidSize * stats.bestAsk) / totalSize;
}

let started = false;
export function startMicropriceLoop(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    const m = computeMicroprice();
    if (m <= 0) return;
    const ts = Date.now();
    ticks.push({ value: m, ts });
    const cutoff = ts - HISTORY_MS;
    while (ticks.length && ticks[0]!.ts < cutoff) ticks.shift();

    const sec = Math.floor(ts / 1000);
    if (sec !== lastSecondSample) {
      secondCloses.push(m);
      while (secondCloses.length > SECOND_CLOSES_MAX) secondCloses.shift();
      lastSecondSample = sec;
    }

    updateCount++;
    updatesThisSecond++;
    if (sec !== lastSecond) {
      updatesPerSecond = updatesThisSecond;
      updatesThisSecond = 0;
      lastSecond = sec;
    }
  }, 1000 / TICK_HZ);
}

export function getMicropriceState() {
  const last = ticks[ticks.length - 1];
  return {
    value: last?.value ?? 0,
    updatedAt: last?.ts ?? 0,
    updatesPerSecond,
    totalUpdates: updateCount,
  };
}

export function getTickHistory(): MicropriceTick[] {
  return ticks;
}

export function getDriftBps(lookbackMs: number): number {
  if (ticks.length < 2) return 0;
  const now = Date.now();
  const target = now - lookbackMs;
  let pastIdx = 0;
  for (let i = ticks.length - 1; i >= 0; i--) {
    if (ticks[i]!.ts <= target) {
      pastIdx = i;
      break;
    }
  }
  const past = ticks[pastIdx]!.value;
  const cur = ticks[ticks.length - 1]!.value;
  if (past <= 0) return 0;
  return ((cur - past) / past) * 10_000;
}

export function getRollingVolatilityBps(lookbackMs: number): number {
  if (ticks.length < 2) return 0;
  const now = Date.now();
  const target = now - lookbackMs;
  const sample = ticks.filter((t) => t.ts >= target);
  if (sample.length < 2) return 0;
  const mean = sample.reduce((s, t) => s + t.value, 0) / sample.length;
  if (mean <= 0) return 0;
  let sq = 0;
  for (const t of sample) {
    const d = t.value - mean;
    sq += d * d;
  }
  const std = Math.sqrt(sq / sample.length);
  return (std / mean) * 10_000;
}

// Acceleration: difference between recent drift and earlier drift in bps/sec.
export function getMicropriceAccelerationBps(): number {
  const recent = getDriftBps(1_000);
  const prior = getDriftBps(3_000) / 3; // per-second equivalent
  return recent - prior;
}

// EMA-style drift: weighted average of price changes over lookback window.
export function getEmaDriftBps(lookbackMs: number): number {
  if (ticks.length < 2) return 0;
  const now = Date.now();
  const cutoff = now - lookbackMs;
  const sample = ticks.filter((t) => t.ts >= cutoff);
  if (sample.length < 2) return 0;
  let weighted = 0;
  let weight = 0;
  const last = sample[sample.length - 1]!.value;
  for (let i = 1; i < sample.length; i++) {
    const t = sample[i]!;
    const w = Math.exp(-(now - t.ts) / lookbackMs);
    const ret = ((last - sample[i - 1]!.value) / sample[i - 1]!.value) * 10_000;
    weighted += ret * w;
    weight += w;
  }
  return weight > 0 ? weighted / weight : 0;
}

function emaSeries(vals: number[], period: number): number[] {
  if (!vals.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [vals[0]!];
  for (let i = 1; i < vals.length; i++) {
    out.push(vals[i]! * k + out[i - 1]! * (1 - k));
  }
  return out;
}

export function getRsi(period = 14): number {
  if (secondCloses.length < period + 1) return 50;
  let g = 0;
  let l = 0;
  for (let i = secondCloses.length - period; i < secondCloses.length; i++) {
    const d = secondCloses[i]! - secondCloses[i - 1]!;
    if (d >= 0) g += d;
    else l -= d;
  }
  if (l === 0) return 100;
  const rs = g / l;
  return 100 - 100 / (1 + rs);
}

export function getMacd(): { macd: number; signal: number; hist: number } {
  if (secondCloses.length < 35) return { macd: 0, signal: 0, hist: 0 };
  const e12 = emaSeries(secondCloses, 12);
  const e26 = emaSeries(secondCloses, 26);
  const macdArr: number[] = [];
  const len = Math.min(e12.length, e26.length);
  for (let i = 0; i < len; i++) macdArr.push(e12[i]! - e26[i]!);
  const sig = emaSeries(macdArr, 9);
  const macd = macdArr[macdArr.length - 1] ?? 0;
  const signal = sig[sig.length - 1] ?? 0;
  return { macd, signal, hist: macd - signal };
}

// Aggregate book pressure across all CEX venues, normalized to [-1, 1].
export function getBookPressure(): number {
  const venues = getVenues().filter((v) => v.connected && v.type === "cex");
  let bid = 0;
  let ask = 0;
  for (const v of venues) {
    bid += v.bidSize || 0;
    ask += v.askSize || 0;
  }
  const total = bid + ask;
  if (total <= 0) return 0;
  return (bid - ask) / total;
}

// Cross-venue spread (highest mid - lowest mid) in bps relative to average.
export function getCrossVenueSpreadBps(): number {
  const venues = getVenues().filter((v) => v.connected && v.bid > 0 && v.ask > 0 && v.type === "cex");
  if (venues.length < 2) return 0;
  let high = -Infinity;
  let low = Infinity;
  let sum = 0;
  for (const v of venues) {
    const m = (v.bid + v.ask) / 2;
    if (m > high) high = m;
    if (m < low) low = m;
    sum += m;
  }
  const avg = sum / venues.length;
  if (avg <= 0) return 0;
  return ((high - low) / avg) * 10_000;
}

export function getStrategyContributions(stats: BookStats): {
  contributions: StrategyContribution[];
  blendedScore: number; // -1..1, positive = up
} {
  const venues = getVenues().filter((v) => v.connected && v.bid > 0);

  const imbScore = clamp(stats.imbalance, -1, 1);
  const drift5 = getDriftBps(5_000);
  const driftScore = clamp(drift5 / 5, -1, 1);

  const drift1 = getDriftBps(1_000);
  const momentum = drift1 - getDriftBps(10_000) / 10;
  const momScore = clamp(momentum / 3, -1, 1);

  let cexAvg = 0;
  let cexCount = 0;
  for (const v of venues.filter((x) => x.type === "cex")) {
    cexAvg += (v.bid + v.ask) / 2;
    cexCount++;
  }
  cexAvg = cexCount ? cexAvg / cexCount : 0;
  let arbScore = 0;
  let arbNote = "balanced";
  if (cexAvg > 0) {
    let highest = -Infinity;
    let lowest = Infinity;
    let highestName = "";
    let lowestName = "";
    for (const v of venues.filter((x) => x.type === "cex")) {
      const m = (v.bid + v.ask) / 2;
      if (m > highest) {
        highest = m;
        highestName = v.venue;
      }
      if (m < lowest) {
        lowest = m;
        lowestName = v.venue;
      }
    }
    const spread = ((highest - lowest) / cexAvg) * 10_000;
    arbScore = clamp(((highest - cexAvg) / cexAvg) * 1_000, -1, 1);
    arbNote = `${spread.toFixed(2)}bps spread, ${lowestName}->${highestName}`;
  }

  const dexPrices = venues.filter((x) => x.type === "dex");
  let dexPremiumBps = 0;
  if (dexPrices.length && cexAvg > 0) {
    const dexAvg =
      dexPrices.reduce((s, v) => s + (v.bid + v.ask) / 2, 0) / dexPrices.length;
    dexPremiumBps = ((dexAvg - cexAvg) / cexAvg) * 10_000;
  }
  const dexScore = clamp(dexPremiumBps / 20, -1, 1);

  const vol1 = getRollingVolatilityBps(1_000);
  const vol30 = getRollingVolatilityBps(30_000);
  const volRatio = vol30 > 0 ? vol1 / vol30 : 1;
  const newsScore = clamp((volRatio - 1) * Math.sign(drift1 || driftScore), -1, 1);
  const newsNote =
    volRatio > 1.4
      ? "spike — high-impact flow"
      : volRatio < 0.6
        ? "calm — mean-reversion"
        : "neutral";

  const accel = getMicropriceAccelerationBps();
  const accelScore = clamp(accel / Math.max(0.5, vol1 * 0.5), -1, 1);
  const rsi = getRsi(20);
  const rsiScore = clamp(-(rsi - 50) / 30, -1, 1); // mean-reversion bias
  const macd = getMacd();
  const macdScore = clamp(macd.hist / Math.max(0.05, vol30 * 0.05), -1, 1);
  const pressure = getBookPressure();

  const contributions: StrategyContribution[] = [
    {
      name: "Book Imbalance",
      score: scoreTo100(imbScore),
      note: `${(stats.imbalance * 100).toFixed(1)}% imbalance, ${stats.spread.toFixed(2)} spread`,
    },
    {
      name: "Microprice Drift 5s",
      score: scoreTo100(driftScore),
      note: `${drift5.toFixed(2)} bps over 5s`,
    },
    {
      name: "Tick Momentum",
      score: scoreTo100(momScore),
      note: `1s vs 10s differential ${momentum.toFixed(2)} bps`,
    },
    {
      name: "Cross-Venue Arb",
      score: scoreTo100(arbScore),
      note: arbNote,
    },
    {
      name: "DEX Premium",
      score: scoreTo100(dexScore),
      note: dexPrices.length
        ? `${dexPremiumBps.toFixed(1)} bps DEX vs CEX`
        : "DEX feeds warming up",
    },
    {
      name: "News / Vol Burst",
      score: scoreTo100(newsScore),
      note: newsNote,
    },
    {
      name: "Acceleration",
      score: scoreTo100(accelScore),
      note: `${accel.toFixed(2)} bps Δ/sec`,
    },
    {
      name: "RSI(20s)",
      score: scoreTo100(rsiScore),
      note: `RSI ${rsi.toFixed(1)}`,
    },
    {
      name: "MACD",
      score: scoreTo100(macdScore),
      note: `hist ${macd.hist.toFixed(3)}`,
    },
    {
      name: "Aggregate Book Pressure",
      score: scoreTo100(pressure),
      note: `pressure ${(pressure * 100).toFixed(1)}%`,
    },
  ];

  const blended =
    imbScore * 0.16 +
    driftScore * 0.16 +
    momScore * 0.12 +
    arbScore * 0.06 +
    dexScore * 0.04 +
    newsScore * 0.06 +
    accelScore * 0.12 +
    rsiScore * 0.08 +
    macdScore * 0.1 +
    pressure * 0.1;

  return { contributions, blendedScore: clamp(blended, -1, 1) };
}

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

function scoreTo100(s: number): number {
  return Math.round((s + 1) * 50);
}
