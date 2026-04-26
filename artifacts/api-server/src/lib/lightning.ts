import { logger } from "./logger";
import bolt11 from "bolt11";

export interface DecodedInvoice {
  network: string;
  paymentHash: string;
  amountSats: number | null;
  description: string | null;
  payeeNodeKey: string | null;
  expiry: number;
  timestamp: number;
  expiresAt: number;
  routeHints: number;
  features: string[];
  raw: string;
}

export function decodeInvoice(invoice: string): DecodedInvoice {
  const decoded = bolt11.decode(invoice.trim());
  const tagsByName: Record<string, unknown> = {};
  for (const t of decoded.tags) {
    if (typeof t.tagName === "string") tagsByName[t.tagName] = t.data;
  }
  const amountSats = decoded.satoshis ?? (decoded.millisatoshis ? Number(decoded.millisatoshis) / 1000 : null);
  const expiry = (tagsByName["expire_time"] as number) ?? 3600;
  const networkName = (decoded as unknown as { network?: { bech32?: string } }).network?.bech32 ?? "bc";
  return {
    network: networkName,
    paymentHash: (tagsByName["payment_hash"] as string) ?? "",
    amountSats,
    description: (tagsByName["description"] as string) ?? null,
    payeeNodeKey: decoded.payeeNodeKey ?? null,
    expiry,
    timestamp: decoded.timestamp ?? 0,
    expiresAt: ((decoded.timestamp ?? 0) + expiry) * 1000,
    routeHints: Array.isArray(tagsByName["routing_info"])
      ? (tagsByName["routing_info"] as unknown[]).length
      : 0,
    features: Object.keys((tagsByName["feature_bits"] as object) ?? {}),
    raw: invoice,
  };
}

function bech32ToHex(lnurl: string): string {
  const lower = lnurl.trim().toLowerCase();
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const sep = lower.lastIndexOf("1");
  if (sep < 1) throw new Error("invalid lnurl bech32");
  const data = lower.slice(sep + 1);
  const dataLen = data.length - 6;
  if (dataLen < 0) throw new Error("invalid lnurl data length");
  const dataBytes: number[] = [];
  for (let i = 0; i < dataLen; i++) {
    const v = CHARSET.indexOf(data[i]!);
    if (v === -1) throw new Error("invalid bech32 char");
    dataBytes.push(v);
  }
  const out: number[] = [];
  let acc = 0, bits = 0;
  for (const v of dataBytes) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Buffer.from(out).toString("utf-8");
}

export interface LnurlResolved {
  type: "payRequest" | "withdrawRequest" | "channelRequest" | "login" | "unknown";
  url: string;
  data: unknown;
}

export async function resolveLnurl(input: string): Promise<LnurlResolved> {
  let url = input.trim();
  if (url.toLowerCase().startsWith("lnurl")) {
    url = bech32ToHex(url);
  } else if (url.includes("@")) {
    const [name, host] = url.split("@");
    url = `https://${host}/.well-known/lnurlp/${name}`;
  }
  if (!url.startsWith("http")) throw new Error("invalid lnurl/lightning address");
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`lnurl fetch failed: ${r.status}`);
  const data = (await r.json()) as { tag?: string };
  const tag = data?.tag;
  let type: LnurlResolved["type"] = "unknown";
  if (tag === "payRequest") type = "payRequest";
  else if (tag === "withdrawRequest") type = "withdrawRequest";
  else if (tag === "channelRequest") type = "channelRequest";
  else if (tag === "login") type = "login";
  return { type, url, data };
}

export async function lnurlPayCallback(
  callback: string,
  amountSats: number,
  comment?: string,
): Promise<{ pr: string; routes: unknown[]; decoded: DecodedInvoice }> {
  const params = new URLSearchParams();
  params.set("amount", String(amountSats * 1000));
  if (comment) params.set("comment", comment);
  const sep = callback.includes("?") ? "&" : "?";
  const r = await fetch(`${callback}${sep}${params.toString()}`);
  if (!r.ok) throw new Error(`lnurl pay callback failed: ${r.status}`);
  const data = (await r.json()) as { pr: string; routes?: unknown[]; reason?: string; status?: string };
  if (!data.pr) throw new Error(data.reason ?? "no invoice returned");
  return {
    pr: data.pr,
    routes: data.routes ?? [],
    decoded: decodeInvoice(data.pr),
  };
}

interface MempoolNode {
  public_key: string;
  alias: string;
  channels: number;
  capacity: number;
  city?: string;
  country?: string;
}
interface NetworkStats {
  latest: {
    id: number;
    added: number;
    channel_count: number;
    node_count: number;
    total_capacity: number;
    tor_nodes: number;
    clearnet_nodes: number;
    unannounced_nodes: number;
    avg_capacity: number;
    avg_fee_rate: number;
    avg_base_fee_mtokens: number;
    med_capacity: number;
    med_fee_rate: number;
    med_base_fee_mtokens: number;
    clearnet_tor_nodes: number;
  };
}

export async function getLightningNetworkStats() {
  try {
    const [statsR, nodesR] = await Promise.all([
      fetch("https://mempool.space/api/v1/lightning/statistics/latest"),
      fetch("https://mempool.space/api/v1/lightning/nodes/rankings/connectivity"),
    ]);
    const stats = (await statsR.json()) as NetworkStats;
    const nodes = (await nodesR.json()) as MempoolNode[];
    return {
      stats: stats.latest,
      topNodes: nodes.slice(0, 10).map((n) => ({
        publicKey: n.public_key,
        alias: n.alias,
        channels: n.channels,
        capacity: n.capacity,
        city: n.city ?? null,
        country: n.country ?? null,
      })),
    };
  } catch (err) {
    logger.warn({ err }, "lightning stats failed");
    return null;
  }
}
