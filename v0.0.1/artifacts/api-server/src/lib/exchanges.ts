import WebSocket from "ws";
import { logger } from "./logger";
import type { VenueState } from "./types";

const venues = new Map<string, VenueState>();

export function getVenues(): VenueState[] {
  const now = Date.now();
  const out: VenueState[] = [];
  for (const v of venues.values()) {
    out.push({
      ...v,
      connected: v.connected && now - v.lastUpdateMs < 15_000,
    });
  }
  return out;
}

function upsert(name: string, type: "cex" | "dex", patch: Partial<VenueState>) {
  const prev = venues.get(name) ?? {
    venue: name,
    type,
    bid: 0,
    ask: 0,
    bidSize: 0,
    askSize: 0,
    last: 0,
    connected: false,
    lastUpdateMs: 0,
  };
  venues.set(name, { ...prev, ...patch, type, lastUpdateMs: Date.now() });
}

interface FeedDef {
  name: string;
  type: "cex" | "dex";
  url: string;
  subscribe: (ws: WebSocket) => void;
  parse: (data: string, name: string) => void;
}

const feeds: FeedDef[] = [
  // Bitfinex
  {
    name: "Bitfinex",
    type: "cex",
    url: "wss://api-pub.bitfinex.com/ws/2",
    subscribe: (ws) => {
      ws.send(
        JSON.stringify({
          event: "subscribe",
          channel: "ticker",
          symbol: "tBTCUSD",
        }),
      );
    },
    parse: (data, name) => {
      try {
        const msg = JSON.parse(data);
        if (Array.isArray(msg) && Array.isArray(msg[1])) {
          const t = msg[1] as number[];
          // [BID, BID_SIZE, ASK, ASK_SIZE, DAILY_CHANGE, ..., LAST_PRICE, ...]
          const bid = Number(t[0]);
          const bidSize = Number(t[1]);
          const ask = Number(t[2]);
          const askSize = Number(t[3]);
          const last = Number(t[6]);
          if (bid > 0 && ask > 0) {
            upsert(name, "cex", { bid, ask, bidSize, askSize, last, connected: true });
          }
        }
      } catch {}
    },
  },
  // Coinbase
  {
    name: "Coinbase",
    type: "cex",
    url: "wss://ws-feed.exchange.coinbase.com",
    subscribe: (ws) => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: ["BTC-USD"],
          channels: ["ticker"],
        }),
      );
    },
    parse: (data, name) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "ticker" && msg.product_id === "BTC-USD") {
          const bid = Number(msg.best_bid);
          const ask = Number(msg.best_ask);
          const bidSize = Number(msg.best_bid_size ?? 0);
          const askSize = Number(msg.best_ask_size ?? 0);
          const last = Number(msg.price);
          if (bid > 0 && ask > 0) {
            upsert(name, "cex", { bid, ask, bidSize, askSize, last, connected: true });
          }
        }
      } catch {}
    },
  },
  // Kraken
  {
    name: "Kraken",
    type: "cex",
    url: "wss://ws.kraken.com/v2",
    subscribe: (ws) => {
      ws.send(
        JSON.stringify({
          method: "subscribe",
          params: { channel: "ticker", symbol: ["BTC/USD"] },
        }),
      );
    },
    parse: (data, name) => {
      try {
        const msg = JSON.parse(data);
        if (msg.channel === "ticker" && Array.isArray(msg.data)) {
          const t = msg.data[0];
          const bid = Number(t.bid);
          const ask = Number(t.ask);
          const bidSize = Number(t.bid_qty ?? 0);
          const askSize = Number(t.ask_qty ?? 0);
          const last = Number(t.last);
          if (bid > 0 && ask > 0) {
            upsert(name, "cex", { bid, ask, bidSize, askSize, last, connected: true });
          }
        }
      } catch {}
    },
  },
  // OKX (cex)
  {
    name: "OKX",
    type: "cex",
    url: "wss://ws.okx.com:8443/ws/v5/public",
    subscribe: (ws) => {
      ws.send(
        JSON.stringify({
          op: "subscribe",
          args: [{ channel: "tickers", instId: "BTC-USDT" }],
        }),
      );
    },
    parse: (data, name) => {
      try {
        const msg = JSON.parse(data);
        if (msg.arg?.channel === "tickers" && Array.isArray(msg.data)) {
          const t = msg.data[0];
          const bid = Number(t.bidPx);
          const ask = Number(t.askPx);
          const bidSize = Number(t.bidSz ?? 0);
          const askSize = Number(t.askSz ?? 0);
          const last = Number(t.last);
          if (bid > 0 && ask > 0) {
            upsert(name, "cex", { bid, ask, bidSize, askSize, last, connected: true });
          }
        }
      } catch {}
    },
  },
];

// DEX: Uniswap v3 wBTC/USDC pool — polled via REST
async function pollDexPrices() {
  // Use a free public oracle: GeckoTerminal public API (Uniswap v3 WBTC/USDC pool on Ethereum)
  // No signup required.
  const dexes = [
    {
      name: "Uniswap v3",
      url: "https://api.geckoterminal.com/api/v2/networks/eth/pools/0x99ac8ca7087fa4a2a1fb6357269965a2014abc35",
    },
    {
      name: "PancakeSwap",
      url: "https://api.geckoterminal.com/api/v2/networks/bsc/pools/0xf45cd219aef8618a92baa7ad848364a158a24f33",
    },
  ];
  for (const dex of dexes) {
    try {
      const res = await fetch(dex.url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: { attributes?: { base_token_price_usd?: string } } };
      const px = Number(json?.data?.attributes?.base_token_price_usd);
      if (px > 0) {
        upsert(dex.name, "dex", {
          bid: px * 0.9995,
          ask: px * 1.0005,
          bidSize: 1,
          askSize: 1,
          last: px,
          connected: true,
        });
      }
    } catch (err) {
      logger.debug({ err, dex: dex.name }, "dex poll error");
    }
  }
}

function startFeed(def: FeedDef) {
  let ws: WebSocket | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  const connect = () => {
    try {
      ws = new WebSocket(def.url);
      ws.on("open", () => {
        logger.info({ venue: def.name }, "feed connected");
        upsert(def.name, def.type, { connected: true });
        try {
          def.subscribe(ws!);
        } catch (err) {
          logger.warn({ err, venue: def.name }, "subscribe error");
        }
        pingInterval = setInterval(() => {
          try {
            ws?.ping();
          } catch {}
        }, 20_000);
      });
      ws.on("message", (data) => {
        def.parse(data.toString(), def.name);
      });
      ws.on("close", () => {
        logger.warn({ venue: def.name }, "feed disconnected, reconnecting in 5s");
        upsert(def.name, def.type, { connected: false });
        if (pingInterval) clearInterval(pingInterval);
        setTimeout(connect, 5_000);
      });
      ws.on("error", (err) => {
        logger.warn({ venue: def.name, err: err.message }, "feed error");
        try {
          ws?.terminate();
        } catch {}
      });
    } catch (err) {
      logger.error({ venue: def.name, err }, "feed connect failed");
      setTimeout(connect, 5_000);
    }
  };

  connect();
}

let started = false;
export function startExchanges(): void {
  if (started) return;
  started = true;
  // Seed entries so the UI can display "connecting"
  for (const f of feeds) {
    upsert(f.name, f.type, {});
  }
  upsert("Uniswap v3", "dex", {});
  upsert("PancakeSwap", "dex", {});

  for (const f of feeds) startFeed(f);

  // Initial poll + interval
  void pollDexPrices();
  setInterval(() => {
    void pollDexPrices();
  }, 8_000);
}
