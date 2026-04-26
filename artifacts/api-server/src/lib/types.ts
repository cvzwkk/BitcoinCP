export type VenueType = "cex" | "dex";

export interface VenueState {
  venue: string;
  type: VenueType;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  connected: boolean;
  lastUpdateMs: number;
}

export interface MicropriceTick {
  value: number;
  ts: number;
}

export interface PredictionOutput {
  horizonSeconds: number;
  predictedPrice: number;
  deltaBps: number;
  direction: "up" | "down" | "flat";
  confidence: number;
  signal: "BUY" | "SELL" | "HOLD";
}

export interface StrategyContribution {
  name: string;
  score: number;
  note: string;
}

export interface Position {
  id: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  size: number;
  notional: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: number;
  unrealizedPnl: number;
  confidence: number;
  horizonSeconds: number;
  strategyId: string;
  strategyLabel: string;
  expiresAt: number;
}

export interface Trade {
  id: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  size: number;
  notional: number;
  pnl: number;
  pnlPct: number;
  openedAt: number;
  closedAt: number;
  durationMs: number;
  reason: string;
  confidence: number;
  horizonSeconds: number;
  strategyId: string;
  strategyLabel: string;
}

export interface PaperConfig {
  initialBalance: number;
  entrySize: number;
  autoTrade: boolean;
  minConfidence: number;
}

export interface StrategyState {
  id: string;
  label: string;
  family: "microprice" | "burst" | "meanrev" | "imbalance" | "arb" | "chart";
  allocationPct: number; // 0..1
  allocatedBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  openCount: number;
  closedCount: number;
  winCount: number;
  lossCount: number;
  enabled: boolean;
}
