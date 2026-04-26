import {
  computeBookStats,
  getMicropriceState,
  getStrategyContributions,
  getRollingVolatilityBps,
  getDriftBps,
  getMicropriceAccelerationBps,
  getEmaDriftBps,
  getRsi,
  getMacd,
  getBookPressure,
} from "./microprice";
import type { PredictionOutput, StrategyContribution } from "./types";

const HORIZONS = [5, 10, 30, 60];

export interface PredictionBundle {
  predictions: PredictionOutput[];
  strategies: StrategyContribution[];
  blendedScore: number; // -1..1
}

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function buildPredictions(): PredictionBundle {
  const stats = computeBookStats();
  const { contributions, blendedScore } = getStrategyContributions(stats);
  const mp = getMicropriceState();
  const price = mp.value;

  if (price <= 0) {
    return {
      predictions: HORIZONS.map((h) => ({
        horizonSeconds: h,
        predictedPrice: 0,
        deltaBps: 0,
        direction: "flat",
        confidence: 0,
        signal: "HOLD",
      })),
      strategies: contributions,
      blendedScore: 0,
    };
  }

  const vol5s = getRollingVolatilityBps(5_000);
  const vol30s = getRollingVolatilityBps(30_000);
  const vol = Math.max(vol5s, vol30s * 0.6);

  // Additional micro-features blended in for short-horizon accuracy.
  const drift1 = getDriftBps(1_000);
  const drift5 = getDriftBps(5_000);
  const drift15 = getDriftBps(15_000);
  const drift30 = getDriftBps(30_000);
  const accel = getMicropriceAccelerationBps();
  const emaShort = getEmaDriftBps(2_000);
  const emaLong = getEmaDriftBps(15_000);
  const rsi = getRsi(20);
  const macd = getMacd();
  const pressure = getBookPressure();

  // Per-horizon adjusted score: longer horizons lean more on slower drift,
  // shorter horizons emphasise instantaneous pressure & acceleration.
  const baseScore = blendedScore;

  const predictions: PredictionOutput[] = HORIZONS.map((h) => {
    const fastWeight = h <= 10 ? 0.6 : h <= 30 ? 0.35 : 0.2;
    const slowWeight = 1 - fastWeight;

    const fastSignal =
      0.35 * Math.tanh(drift1 / Math.max(1, vol5s * 0.7)) +
      0.25 * Math.tanh(accel / Math.max(0.5, vol5s * 0.5)) +
      0.2 * pressure +
      0.2 * Math.tanh(emaShort / Math.max(1, vol5s * 0.7));
    const slowSignal =
      0.3 * Math.tanh(drift15 / Math.max(1, vol30s)) +
      0.25 * Math.tanh(drift30 / Math.max(1.5, vol30s * 1.5)) +
      0.2 * Math.tanh(emaLong / Math.max(1, vol30s)) +
      0.15 * Math.tanh((rsi - 50) / 25) +
      0.1 * Math.tanh(macd.hist / Math.max(0.05, vol30s * 0.05));

    const blended = clamp(
      0.45 * baseScore +
        0.3 * (fastWeight * fastSignal + slowWeight * slowSignal) +
        0.25 * Math.tanh(drift5 / Math.max(1, vol)),
      -1,
      1,
    );

    const expectedBps =
      blended * Math.max(1.5, vol * 0.7) * Math.sqrt(h / 5);
    const deltaBps = clamp(expectedBps, -vol * 4, vol * 4);
    const predictedPrice = price * (1 + deltaBps / 10_000);

    let direction: PredictionOutput["direction"] = "flat";
    if (deltaBps > 0.3) direction = "up";
    else if (deltaBps < -0.3) direction = "down";

    // Confidence: combine score magnitude, indicator agreement, and horizon decay.
    const indicatorAgreement = clamp(
      (Math.sign(drift1) === Math.sign(blended) ? 0.15 : 0) +
        (Math.sign(emaShort) === Math.sign(blended) ? 0.1 : 0) +
        (Math.sign(macd.hist) === Math.sign(blended) ? 0.1 : 0) +
        (Math.sign(pressure) === Math.sign(blended) ? 0.1 : 0),
      0,
      0.45,
    );
    const horizonDecay = Math.max(0.4, 1 - (h - 5) / 120);
    const confidence = clamp(
      Math.abs(blended) * 0.7 * horizonDecay + indicatorAgreement,
      0,
      0.99,
    );

    let signal: PredictionOutput["signal"] = "HOLD";
    if (confidence > 0.5 && direction === "up") signal = "BUY";
    else if (confidence > 0.5 && direction === "down") signal = "SELL";

    return {
      horizonSeconds: h,
      predictedPrice,
      deltaBps,
      direction,
      confidence,
      signal,
    };
  });

  return {
    predictions,
    strategies: contributions,
    blendedScore,
  };
}
