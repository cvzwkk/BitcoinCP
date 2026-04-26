import { getMicropriceState, getRollingVolatilityBps } from "./microprice";
import { getPaperConfig, getPaperState, getTrades, updatePaperConfig } from "./paper";
import { buildPredictions } from "./predictor";

export interface AiInsightsState {
  notes: string[];
  recommendedMinConfidence: number;
  recommendedEntrySize: number;
  updatedAt: number;
}

let lastInsights: AiInsightsState = {
  notes: ["AI assistant warming up — collecting tick history."],
  recommendedMinConfidence: 0.65,
  recommendedEntrySize: 5,
  updatedAt: Date.now(),
};

function recomputeInsights(): AiInsightsState {
  const cfg = getPaperConfig();
  const state = getPaperState();
  const trades = getTrades();
  const mp = getMicropriceState();
  const vol5 = getRollingVolatilityBps(5_000);
  const vol30 = getRollingVolatilityBps(30_000);

  const notes: string[] = [];
  let recMinConf = cfg.minConfidence;
  let recEntrySize = cfg.entrySize;

  // Win-rate adjustments
  if (trades.length >= 10) {
    if (state.winRate < 0.5) {
      recMinConf = Math.min(0.92, cfg.minConfidence + 0.05);
      notes.push(
        `Win-rate ${(state.winRate * 100).toFixed(1)}% under target. Tightening minConfidence to ${recMinConf.toFixed(2)}.`,
      );
    } else if (state.winRate > 0.85) {
      recMinConf = Math.max(0.4, cfg.minConfidence - 0.03);
      notes.push(
        `Win-rate ${(state.winRate * 100).toFixed(1)}% strong. Loosening minConfidence to ${recMinConf.toFixed(2)} to capture more entries.`,
      );
    } else {
      notes.push(
        `Win-rate ${(state.winRate * 100).toFixed(1)}% within target band — holding parameters.`,
      );
    }
  } else {
    notes.push(
      `Only ${trades.length} trades sampled — keeping defaults until 10+ trades.`,
    );
  }

  // Volatility-aware sizing
  if (vol5 > vol30 * 1.6 && vol30 > 0) {
    recEntrySize = Math.max(1, cfg.entrySize * 0.6);
    notes.push(
      `Realized vol spike (${vol5.toFixed(2)} vs ${vol30.toFixed(2)} bps). Reducing entry size to $${recEntrySize.toFixed(2)} to limit risk.`,
    );
  } else if (vol5 < vol30 * 0.5 && state.balance > cfg.initialBalance) {
    recEntrySize = Math.min(state.balance * 0.1, cfg.entrySize * 1.4);
    notes.push(
      `Quiet tape and account up to $${state.balance.toFixed(2)}. Suggested entry size $${recEntrySize.toFixed(2)}.`,
    );
  }

  // Microprice freshness
  if (mp.updatedAt && Date.now() - mp.updatedAt > 1500) {
    notes.push(
      `Microprice stale by ${Date.now() - mp.updatedAt}ms — likely venue disconnects. Pausing auto-trade is wise until ticks resume.`,
    );
  }

  // Per-strategy drift commentary
  const { strategies, blendedScore } = buildPredictions();
  const top = [...strategies].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))[0];
  if (top) {
    notes.push(
      `Dominant signal right now: ${top.name} at ${top.score}/100 (${top.note}). Blended score ${(blendedScore * 100).toFixed(1)}.`,
    );
  }

  return {
    notes,
    recommendedMinConfidence: Math.round(recMinConf * 100) / 100,
    recommendedEntrySize: Math.round(recEntrySize * 100) / 100,
    updatedAt: Date.now(),
  };
}

let started = false;
export function startAiLoop(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    try {
      lastInsights = recomputeInsights();
    } catch {}
  }, 5_000);
}

export function getInsights(): AiInsightsState {
  return lastInsights;
}

export function applyInsights(): { applied: string[] } {
  const before = getPaperConfig();
  updatePaperConfig({
    minConfidence: lastInsights.recommendedMinConfidence,
    entrySize: lastInsights.recommendedEntrySize,
  });
  const applied: string[] = [];
  if (before.minConfidence !== lastInsights.recommendedMinConfidence) {
    applied.push(
      `minConfidence ${before.minConfidence} -> ${lastInsights.recommendedMinConfidence}`,
    );
  }
  if (before.entrySize !== lastInsights.recommendedEntrySize) {
    applied.push(
      `entrySize ${before.entrySize} -> ${lastInsights.recommendedEntrySize}`,
    );
  }
  return { applied };
}

export function chat(message: string): { reply: string; appliedAdjustments: string[] } {
  const m = message.toLowerCase();
  const cfg = getPaperConfig();
  const state = getPaperState();
  const mp = getMicropriceState();
  const { predictions, strategies, blendedScore } = buildPredictions();
  let appliedAdjustments: string[] = [];
  const lines: string[] = [];

  if (
    m.includes("apply") ||
    m.includes("adjust") ||
    m.includes("optimize") ||
    m.includes("tune")
  ) {
    const r = applyInsights();
    appliedAdjustments = r.applied;
    if (appliedAdjustments.length) {
      lines.push(`Applied: ${appliedAdjustments.join(", ")}.`);
    } else {
      lines.push(`No tuning needed — current config is already in target band.`);
    }
  }

  if (m.includes("status") || m.includes("how") || m.includes("?") || m.length < 6) {
    lines.push(
      `Microprice $${mp.value.toFixed(2)} (${mp.updatesPerSecond} ticks/sec). Equity $${state.equity.toFixed(2)} on $${state.initialBalance.toFixed(2)} starter. ${state.tradesCount} trades, win rate ${(state.winRate * 100).toFixed(1)}%.`,
    );
  }

  if (m.includes("predict") || m.includes("forecast") || m.includes("signal")) {
    const lines2 = predictions
      .map(
        (p) =>
          `${p.horizonSeconds}s: ${p.signal} ${(p.deltaBps).toFixed(2)}bps @ ${(p.confidence * 100).toFixed(0)}%`,
      )
      .join(" | ");
    lines.push(`Forecasts -> ${lines2}.`);
    lines.push(`Blended score ${(blendedScore * 100).toFixed(1)} (-100..100).`);
  }

  if (m.includes("strateg") || m.includes("why")) {
    const top3 = [...strategies]
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 3)
      .map((s) => `${s.name} ${s.score} (${s.note})`)
      .join(" • ");
    lines.push(`Top contributors: ${top3}.`);
  }

  if (m.includes("risk") || m.includes("stop") || m.includes("loss")) {
    lines.push(
      `Risk model: dynamic SL/TP scaled to realized 5s+30s vol. Higher confidence widens TP and tightens SL. Trailing SL ratchets after 0.6×vol move in profit. Time stop at 90s.`,
    );
  }

  if (!lines.length) {
    lines.push(
      `I track the microprice (currently $${mp.value.toFixed(2)}), 6 strategies, and adapt entry size and minConfidence to push toward a 90/10 win rate. Ask me to "apply" suggestions, "explain strategies", or "show predictions". Current config: minConf ${cfg.minConfidence}, entry $${cfg.entrySize}.`,
    );
  }

  return {
    reply: lines.join(" "),
    appliedAdjustments,
  };
}
