import { logger } from "./logger";
import {
  getMicropriceState,
  getRollingVolatilityBps,
  getDriftBps,
  getBookPressure,
  getCrossVenueSpreadBps,
  computeBookStats,
} from "./microprice";
import { buildPredictions } from "./predictor";
import { getChartPredictions, CHART_HORIZONS } from "./chart-predictor";
import type {
  PaperConfig,
  Position,
  StrategyState,
  Trade,
} from "./types";

const TRADES: Trade[] = [];
const MAX_TRADES = 50_000;
const MICRO_HORIZONS = [5, 10, 30, 60] as const;

interface StrategyDef {
  id: string;
  label: string;
  family: StrategyState["family"];
  allocationPct: number;
  enabled: boolean;
  // Optional metadata for chart strategies
  horizonSeconds?: number;
  chartLabel?: string;
}

const STRATEGY_DEFS: StrategyDef[] = [
  { id: "microprice_scalp", label: "Microprice Scalp", family: "microprice", allocationPct: 0.30, enabled: true },
  { id: "momentum_burst", label: "Momentum Burst", family: "burst", allocationPct: 0.10, enabled: true },
  { id: "mean_reversion", label: "Mean Reversion", family: "meanrev", allocationPct: 0.10, enabled: true },
  { id: "book_imbalance", label: "Book Imbalance", family: "imbalance", allocationPct: 0.08, enabled: true },
  { id: "arb_capture", label: "Cross-Venue Arb", family: "arb", allocationPct: 0.07, enabled: true },
  ...CHART_HORIZONS.map((h) => ({
    id: `chart_${h.label}`,
    label: `Chart ${h.label}`,
    family: "chart" as const,
    allocationPct: 0.35 / CHART_HORIZONS.length, // 0.04375 each
    enabled: true,
    horizonSeconds: h.intervalSeconds,
    chartLabel: h.label,
  })),
];

interface StrategyRuntime extends StrategyState {
  positions: Map<string, Position>;
}

let config: PaperConfig = {
  initialBalance: 100,
  entrySize: 10,
  autoTrade: true,
  minConfidence: 0.55,
};

let balance = config.initialBalance;
let stopped = false;
let nextId = 1;
const strategies: StrategyRuntime[] = STRATEGY_DEFS.map((d) => ({
  id: d.id,
  label: d.label,
  family: d.family,
  allocationPct: d.allocationPct,
  allocatedBalance: config.initialBalance * d.allocationPct,
  realizedPnl: 0,
  unrealizedPnl: 0,
  openCount: 0,
  closedCount: 0,
  winCount: 0,
  lossCount: 0,
  enabled: d.enabled,
  positions: new Map(),
}));

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

function getDef(id: string): StrategyDef | undefined {
  return STRATEGY_DEFS.find((d) => d.id === id);
}

function getStrategy(id: string): StrategyRuntime | undefined {
  return strategies.find((s) => s.id === id);
}

function reallocate(totalBalance: number) {
  for (const s of strategies) {
    s.allocatedBalance = totalBalance * s.allocationPct;
  }
}

export function getPaperConfig(): PaperConfig {
  return { ...config };
}

export function updatePaperConfig(input: Partial<PaperConfig>): void {
  const prevInitial = config.initialBalance;
  config = {
    initialBalance:
      typeof input.initialBalance === "number" && input.initialBalance > 0
        ? input.initialBalance
        : config.initialBalance,
    entrySize:
      typeof input.entrySize === "number" && input.entrySize > 0
        ? input.entrySize
        : config.entrySize,
    autoTrade:
      typeof input.autoTrade === "boolean" ? input.autoTrade : config.autoTrade,
    minConfidence:
      typeof input.minConfidence === "number"
        ? Math.max(0, Math.min(1, input.minConfidence))
        : config.minConfidence,
  };
  // If initialBalance changed, sync the working balance immediately so the
  // user can dynamically inject capital into the engine.
  if (config.initialBalance !== prevInitial) {
    balance = config.initialBalance;
    stopped = false;
    reallocate(balance);
  }
}

export function resetPaper(): void {
  TRADES.length = 0;
  for (const s of strategies) {
    s.positions.clear();
    s.realizedPnl = 0;
    s.unrealizedPnl = 0;
    s.openCount = 0;
    s.closedCount = 0;
    s.winCount = 0;
    s.lossCount = 0;
  }
  balance = config.initialBalance;
  stopped = false;
  reallocate(balance);
}

function unrealizedPnl(price: number, pos: Position): number {
  if (price <= 0) return 0;
  const dir = pos.side === "BUY" ? 1 : -1;
  return ((price - pos.entryPrice) / pos.entryPrice) * pos.notional * dir;
}

export function getPaperState() {
  const mp = getMicropriceState();
  const price = mp.value;
  const allPositions: Position[] = [];
  let openUnrealized = 0;
  for (const s of strategies) {
    let stratUnrealized = 0;
    for (const p of s.positions.values()) {
      const updated = price > 0 ? { ...p, unrealizedPnl: unrealizedPnl(price, p) } : p;
      stratUnrealized += updated.unrealizedPnl;
      allPositions.push(updated);
    }
    s.unrealizedPnl = stratUnrealized;
    s.openCount = s.positions.size;
    openUnrealized += stratUnrealized;
  }
  const equity = balance + openUnrealized;
  if (equity <= 0.01 && !stopped) {
    stopped = true;
    logger.warn({ balance, equity }, "paper engine stopped — equity depleted");
  }
  const winCount = TRADES.filter((t) => t.pnl > 0).length;
  const lossCount = TRADES.filter((t) => t.pnl <= 0).length;
  const winRate = TRADES.length ? winCount / TRADES.length : 0;
  const totalPnl = TRADES.reduce((s, t) => s + t.pnl, 0);

  const strategyStates: StrategyState[] = strategies.map((s) => ({
    id: s.id,
    label: s.label,
    family: s.family,
    allocationPct: s.allocationPct,
    allocatedBalance: s.allocatedBalance,
    realizedPnl: s.realizedPnl,
    unrealizedPnl: s.unrealizedPnl,
    openCount: s.positions.size,
    closedCount: s.closedCount,
    winCount: s.winCount,
    lossCount: s.lossCount,
    enabled: s.enabled,
  }));

  return {
    balance,
    initialBalance: config.initialBalance,
    entrySize: config.entrySize,
    autoTrade: config.autoTrade,
    minConfidence: config.minConfidence,
    equity,
    stopped,
    openPosition: allPositions[0] ?? null,
    openPositions: allPositions,
    winCount,
    lossCount,
    winRate,
    totalPnl,
    tradesCount: TRADES.length,
    strategies: strategyStates,
  };
}

export function getTrades(): Trade[] {
  return [...TRADES].reverse();
}

function strategyOpenNotional(s: StrategyRuntime): number {
  let n = 0;
  for (const p of s.positions.values()) n += p.notional;
  return n;
}

function closePosition(
  strategy: StrategyRuntime,
  posId: string,
  exitPrice: number,
  reason: string,
) {
  const pos = strategy.positions.get(posId);
  if (!pos) return;
  const dir = pos.side === "BUY" ? 1 : -1;
  const pnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * dir;
  const pnl = pnlPct * pos.notional;
  const closedAt = Date.now();
  const trade: Trade = {
    id: uid("t"),
    side: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice,
    size: pos.size,
    notional: pos.notional,
    pnl,
    pnlPct,
    openedAt: pos.openedAt,
    closedAt,
    durationMs: closedAt - pos.openedAt,
    reason,
    confidence: pos.confidence,
    horizonSeconds: pos.horizonSeconds,
    strategyId: pos.strategyId,
    strategyLabel: pos.strategyLabel,
  };
  TRADES.push(trade);
  if (TRADES.length > MAX_TRADES) TRADES.splice(0, TRADES.length - MAX_TRADES);
  balance += pnl;
  strategy.positions.delete(posId);
  strategy.realizedPnl += pnl;
  strategy.closedCount += 1;
  if (pnl > 0) strategy.winCount += 1;
  else strategy.lossCount += 1;
  reallocate(balance);
  logger.info(
    {
      strategy: pos.strategyId,
      pnl: pnl.toFixed(4),
      reason,
      side: pos.side,
      durationMs: trade.durationMs,
    },
    "trade closed",
  );
}

interface OpenArgs {
  strategy: StrategyRuntime;
  side: "BUY" | "SELL";
  price: number;
  confidence: number;
  horizonSeconds: number;
  notional: number;
  slBps: number;
  tpBps: number;
}

function openPosition(args: OpenArgs) {
  const { strategy, side, price, confidence, horizonSeconds, notional, slBps, tpBps } = args;
  const dir = side === "BUY" ? 1 : -1;
  const stopLoss = price * (1 - (slBps / 10_000) * dir);
  const takeProfit = price * (1 + (tpBps / 10_000) * dir);
  const size = notional / price;
  const id = uid("p");
  const pos: Position = {
    id,
    side,
    entryPrice: price,
    size,
    notional,
    stopLoss,
    takeProfit,
    openedAt: Date.now(),
    unrealizedPnl: 0,
    confidence,
    horizonSeconds,
    strategyId: strategy.id,
    strategyLabel: strategy.label,
    expiresAt: Date.now() + horizonSeconds * 1000,
  };
  strategy.positions.set(id, pos);
  logger.info(
    {
      strategy: strategy.id,
      side,
      price,
      slBps: slBps.toFixed(1),
      tpBps: tpBps.toFixed(1),
      horizonSeconds,
      confidence: confidence.toFixed(2),
    },
    "position opened",
  );
}

let started = false;
export function startPaperLoop(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    try {
      step();
    } catch (err) {
      logger.error({ err }, "paper loop step error");
    }
  }, 100);
}

function checkExits(price: number) {
  const now = Date.now();
  for (const s of strategies) {
    for (const [pid, pos] of [...s.positions.entries()]) {
      const dir = pos.side === "BUY" ? 1 : -1;
      const profitableMove = ((price - pos.entryPrice) / pos.entryPrice) * dir;
      if (pos.side === "BUY") {
        if (price >= pos.takeProfit) {
          closePosition(s, pid, price, "TP");
          continue;
        }
        if (price <= pos.stopLoss) {
          closePosition(s, pid, price, "SL");
          continue;
        }
      } else {
        if (price <= pos.takeProfit) {
          closePosition(s, pid, price, "TP");
          continue;
        }
        if (price >= pos.stopLoss) {
          closePosition(s, pid, price, "SL");
          continue;
        }
      }
      // Time exit only at horizon expiry — chart strategies hold until expiresAt.
      if (now >= pos.expiresAt) {
        closePosition(s, pid, price, "TIME");
        continue;
      }
      // Trailing stop (only for high-frequency families, not chart hold-to-expiry).
      if (s.family !== "chart" && profitableMove > 0) {
        const vol = Math.max(1.5, getRollingVolatilityBps(5_000));
        const moveBps = profitableMove * 10_000;
        if (moveBps > vol * 0.5) {
          const trailBps = vol * 0.3;
          if (pos.side === "BUY") {
            const newSl = price * (1 - trailBps / 10_000);
            if (newSl > pos.stopLoss) pos.stopLoss = newSl;
          } else {
            const newSl = price * (1 + trailBps / 10_000);
            if (newSl < pos.stopLoss) pos.stopLoss = newSl;
          }
        }
      }
    }
  }
}

function entrySizeFor(s: StrategyRuntime): number {
  // Allocate small chunks per entry so unlimited trades can run while balance allows.
  const remaining = s.allocatedBalance - strategyOpenNotional(s);
  if (remaining <= 0) return 0;
  // Use the smaller of: configured entry size, or 25% of remaining strat budget.
  const dynamic = Math.max(1, Math.min(config.entrySize, remaining * 0.25));
  if (dynamic < 1) return 0;
  return Math.min(dynamic, remaining, balance * 0.5);
}

function tryOpenMicropriceScalp(price: number) {
  const s = getStrategy("microprice_scalp");
  if (!s || !s.enabled) return;
  const { predictions } = buildPredictions();
  for (const horizon of MICRO_HORIZONS) {
    const open = [...s.positions.values()].filter((p) => p.horizonSeconds === horizon);
    if (open.length >= 4) continue; // cap per micro horizon
    const pred = predictions.find((p) => p.horizonSeconds === horizon);
    if (!pred) continue;
    if (pred.signal !== "BUY" && pred.signal !== "SELL") continue;
    if (pred.confidence < config.minConfidence) continue;
    const notional = entrySizeFor(s);
    if (notional <= 0) continue;
    const vol5s = Math.max(1.5, getRollingVolatilityBps(5_000));
    const vol30s = Math.max(2, getRollingVolatilityBps(30_000));
    const baseBps = ((vol5s + vol30s) / 2) * Math.sqrt(horizon / 10);
    openPosition({
      strategy: s,
      side: pred.signal,
      price,
      confidence: pred.confidence,
      horizonSeconds: horizon,
      notional,
      slBps: baseBps * (1.2 - pred.confidence * 0.4),
      tpBps: baseBps * (1.5 + pred.confidence * 1.5),
    });
  }
}

function tryOpenMomentumBurst(price: number) {
  const s = getStrategy("momentum_burst");
  if (!s || !s.enabled) return;
  if (s.positions.size >= 6) return;
  const drift1 = getDriftBps(1_000);
  const vol5s = Math.max(1, getRollingVolatilityBps(5_000));
  const ratio = drift1 / vol5s;
  if (Math.abs(ratio) < 2.5) return;
  const side = ratio > 0 ? "BUY" : "SELL";
  const notional = entrySizeFor(s);
  if (notional <= 0) return;
  const slBps = Math.max(1.5, vol5s * 0.8);
  const tpBps = Math.max(2.5, vol5s * 1.6);
  openPosition({
    strategy: s,
    side,
    price,
    confidence: Math.min(0.9, Math.abs(ratio) / 6),
    horizonSeconds: 8,
    notional,
    slBps,
    tpBps,
  });
}

function tryOpenMeanReversion(price: number) {
  const s = getStrategy("mean_reversion");
  if (!s || !s.enabled) return;
  if (s.positions.size >= 6) return;
  const drift1 = getDriftBps(1_000);
  const vol5s = Math.max(1, getRollingVolatilityBps(5_000));
  const ratio = drift1 / vol5s;
  if (Math.abs(ratio) < 4.5) return; // overshoot
  const side = ratio > 0 ? "SELL" : "BUY"; // fade
  const notional = entrySizeFor(s);
  if (notional <= 0) return;
  const slBps = Math.max(2, vol5s * 1.5);
  const tpBps = Math.max(2, vol5s * 1.0);
  openPosition({
    strategy: s,
    side,
    price,
    confidence: Math.min(0.85, Math.abs(ratio) / 8),
    horizonSeconds: 6,
    notional,
    slBps,
    tpBps,
  });
}

function tryOpenBookImbalance(price: number) {
  const s = getStrategy("book_imbalance");
  if (!s || !s.enabled) return;
  if (s.positions.size >= 6) return;
  const stats = computeBookStats();
  const pressure = getBookPressure();
  const composite = (stats.imbalance + pressure) / 2;
  if (Math.abs(composite) < 0.55) return;
  const side = composite > 0 ? "BUY" : "SELL";
  const notional = entrySizeFor(s);
  if (notional <= 0) return;
  const vol5s = Math.max(1, getRollingVolatilityBps(5_000));
  openPosition({
    strategy: s,
    side,
    price,
    confidence: Math.min(0.9, Math.abs(composite)),
    horizonSeconds: 7,
    notional,
    slBps: Math.max(1.5, vol5s),
    tpBps: Math.max(2, vol5s * 1.4),
  });
}

function tryOpenArbCapture(price: number) {
  const s = getStrategy("arb_capture");
  if (!s || !s.enabled) return;
  if (s.positions.size >= 4) return;
  const spreadBps = getCrossVenueSpreadBps();
  if (spreadBps < 8) return;
  // Direction: if cross-venue gap is widening alongside drift, fade toward higher-liquidity venue.
  const drift1 = getDriftBps(1_000);
  const side: "BUY" | "SELL" = drift1 > 0 ? "BUY" : "SELL";
  const notional = entrySizeFor(s);
  if (notional <= 0) return;
  openPosition({
    strategy: s,
    side,
    price,
    confidence: Math.min(0.9, spreadBps / 25),
    horizonSeconds: 5,
    notional,
    slBps: Math.max(2, spreadBps * 0.6),
    tpBps: Math.max(3, spreadBps * 1.0),
  });
}

function tryOpenChartStrategies(price: number) {
  const { predictions } = getChartPredictions();
  if (!predictions.length) return;
  for (const pred of predictions) {
    const id = `chart_${pred.label}`;
    const s = getStrategy(id);
    if (!s || !s.enabled) continue;
    if (s.positions.size >= 1) continue; // single hold-to-expiry per chart timeframe
    if (pred.signal !== "BUY" && pred.signal !== "SELL") continue;
    if (pred.confidence < Math.max(0.4, config.minConfidence - 0.1)) continue;
    const notional = entrySizeFor(s);
    if (notional <= 0) continue;
    const slBps = Math.max(8, pred.indicators.atrBps * 1.5);
    const tpBps = Math.max(12, Math.abs(pred.deltaBps) * 1.5 + pred.indicators.atrBps);
    openPosition({
      strategy: s,
      side: pred.signal,
      price,
      confidence: pred.confidence,
      horizonSeconds: pred.intervalSeconds,
      notional,
      slBps,
      tpBps,
    });
  }
}

function step() {
  const mp = getMicropriceState();
  const price = mp.value;
  if (price <= 0) return;

  checkExits(price);

  if (!config.autoTrade) return;
  if (stopped) return;
  if (balance <= 0.01) {
    stopped = true;
    return;
  }

  tryOpenMicropriceScalp(price);
  tryOpenMomentumBurst(price);
  tryOpenMeanReversion(price);
  tryOpenBookImbalance(price);
  tryOpenArbCapture(price);
  tryOpenChartStrategies(price);
}

export function setStrategyEnabled(id: string, enabled: boolean): boolean {
  const s = getStrategy(id);
  if (!s) return false;
  s.enabled = enabled;
  return true;
}
