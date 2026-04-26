import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { useGetWalletAddress, getGetWalletAddressQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";

const SAT = 100_000_000;
function btc(sats: number) {
  return (sats / SAT).toFixed(8);
}

export function WalletSearchTab() {
  const [input, setInput] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");

  const { data, isFetching, error } = useGetWalletAddress(
    address ?? "",
    { network },
    {
      query: {
        enabled: !!address,
        retry: false,
        queryKey: getGetWalletAddressQueryKey(address ?? "", { network }),
      },
    },
  );

  return (
    <div className="grid gap-4">
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Search className="w-3.5 h-3.5" /> Lookup Bitcoin Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAddress(input.trim());
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="bc1q… or 1… or 3… or tb1…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="font-mono text-xs flex-1"
            />
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as "mainnet" | "testnet")}
              className="bg-background border border-border/40 rounded px-2 text-xs"
            >
              <option value="mainnet">mainnet</option>
              <option value="testnet">testnet</option>
            </select>
            <Button type="submit" size="sm" disabled={!input.trim()}>Search</Button>
          </form>
          {error && <div className="text-xs text-rose-400 mt-2">Address not found or fetch failed.</div>}
        </CardContent>
      </Card>

      {isFetching && (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Looking up…
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Balance</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-primary">{btc(data.totalSats)} <span className="text-sm font-normal text-muted-foreground">BTC</span></div>
                <div className="text-xs text-muted-foreground mt-1">{data.totalSats.toLocaleString()} sats</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Confirmed</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-mono">{btc(data.confirmedSats)}</div>
                <div className="text-xs text-muted-foreground mt-1">{data.confirmedSats.toLocaleString()} sats</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Tx Count</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-mono">{data.txCount.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Unconfirmed: {btc(data.unconfirmedSats)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {data.recentTxs.length === 0 && <div className="text-xs text-muted-foreground">No recent transactions</div>}
                {data.recentTxs.map((t) => (
                  <a
                    key={t.txid}
                    href={`https://mempool.space/${data.network === "testnet" ? "testnet/" : ""}tx/${t.txid}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between text-xs font-mono bg-background/40 border border-border/30 rounded px-3 py-2 hover:border-primary/40"
                  >
                    <span className="truncate">{t.txid}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t.confirmed ? `block ${t.blockHeight}` : "mempool"}</Badge>
                      <span className="text-muted-foreground">{t.feeSats.toLocaleString()} sat fee</span>
                      <span className="text-muted-foreground">{t.inputs} in / {t.outputs} out</span>
                      {t.blockTime && <span className="text-muted-foreground">{format(t.blockTime * 1000, "MMM d HH:mm")}</span>}
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
