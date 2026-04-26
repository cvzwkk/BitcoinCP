import { logger } from "./logger";

const HIRO = "https://api.hiro.so";

export interface InscriptionInfo {
  id: string;
  number: number;
  contentType: string;
  contentLength: number;
  genesisBlockHeight: number;
  genesisAddress: string;
  txid: string;
  outputValue: number;
  satOrdinal: string;
  satRarity: string;
  curatedUrl: string;
}

export async function getInscriptionsByAddress(address: string, limit = 30): Promise<InscriptionInfo[]> {
  try {
    const r = await fetch(
      `${HIRO}/ordinals/v1/inscriptions?address=${encodeURIComponent(address)}&limit=${limit}`,
    );
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { results: Array<Record<string, unknown>> };
    return j.results.map((i) => ({
      id: String(i["id"]),
      number: Number(i["number"]),
      contentType: String(i["content_type"] ?? ""),
      contentLength: Number(i["content_length"] ?? 0),
      genesisBlockHeight: Number(i["genesis_block_height"] ?? 0),
      genesisAddress: String(i["genesis_address"] ?? ""),
      txid: String(i["tx_id"] ?? ""),
      outputValue: Number(i["value"] ?? 0),
      satOrdinal: String(i["sat_ordinal"] ?? ""),
      satRarity: String(i["sat_rarity"] ?? ""),
      curatedUrl: `https://ordinals.com/inscription/${i["id"]}`,
    }));
  } catch (err) {
    logger.warn({ err, address }, "ord inscriptions fetch failed");
    return [];
  }
}

export interface BrcBalance {
  ticker: string;
  availableBalance: string;
  transferrableBalance: string;
  overallBalance: string;
}

export async function getBrc20Balances(address: string): Promise<BrcBalance[]> {
  try {
    const r = await fetch(
      `${HIRO}/ordinals/v1/brc-20/balances/${encodeURIComponent(address)}?limit=60`,
    );
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { results: Array<Record<string, string>> };
    return j.results.map((b) => ({
      ticker: b["ticker"] ?? "",
      availableBalance: b["available_balance"] ?? "0",
      transferrableBalance: b["transferrable_balance"] ?? "0",
      overallBalance: b["overall_balance"] ?? "0",
    }));
  } catch (err) {
    logger.warn({ err, address }, "brc20 fetch failed");
    return [];
  }
}

export interface RuneBalance {
  rune: string;
  symbol: string;
  amount: string;
  divisibility: number;
}

export async function getRunesBalances(address: string): Promise<RuneBalance[]> {
  try {
    const r = await fetch(
      `${HIRO}/runes/v1/addresses/${encodeURIComponent(address)}/balances?limit=60`,
    );
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { results: Array<Record<string, unknown>> };
    return j.results.map((b) => {
      const rune = (b["rune"] as Record<string, unknown>) ?? {};
      return {
        rune: String(rune["spaced_name"] ?? rune["name"] ?? ""),
        symbol: String(rune["symbol"] ?? ""),
        amount: String(b["balance"] ?? "0"),
        divisibility: Number(rune["divisibility"] ?? 0),
      };
    });
  } catch (err) {
    logger.warn({ err, address }, "runes fetch failed");
    return [];
  }
}

export async function getOnchainAssets(address: string) {
  const [inscriptions, brc20, runes] = await Promise.all([
    getInscriptionsByAddress(address),
    getBrc20Balances(address),
    getRunesBalances(address),
  ]);
  return { address, inscriptions, brc20, runes };
}
