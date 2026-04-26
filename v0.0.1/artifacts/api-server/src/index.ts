import app from "./app";
import { logger } from "./lib/logger";
import { startExchanges } from "./lib/exchanges";
import { startMicropriceLoop } from "./lib/microprice";
import { startPaperLoop } from "./lib/paper";
import { startAiLoop } from "./lib/ai";
import { startChartPredictorLoop } from "./lib/chart-predictor";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Boot the live data and trading engine before the server begins serving
startExchanges();
startMicropriceLoop();
startChartPredictorLoop();
startPaperLoop();
startAiLoop();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
