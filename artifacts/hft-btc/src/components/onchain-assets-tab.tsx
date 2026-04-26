import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Boxes, Loader2, ExternalLink } from "lucide-react";
import { useGetOnchainAssets, getGetOnchainAssetsQueryKey } from "@workspace/api-client-react";

export function OnchainAssetsTab() {
  const [input, setInput] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const { data, isFetching, error } = useGetOnchainAssets(address ?? "", {
    query: {
      enabled: !!address,
      retry: false,
      queryKey: getGetOnchainAssetsQueryKey(address ?? ""),
    },
  });

  return (
    <div className="grid gap-4">
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Boxes className="w-3.5 h-3.5" /> On-chain Assets at Address</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); setAddress(input.trim()); }} className="flex gap-2">
            <Input placeholder="bc1q…" value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs flex-1" />
            <Button type="submit" size="sm" disabled={!input.trim()}>Lookup Ordinals · BRC-20 · Runes</Button>
          </form>
          {error && <div className="text-xs text-rose-400 mt-2">{(error as Error).message}</div>}
        </CardContent>
      </Card>

      {isFetching && (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Reading chain…
        </div>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Inscriptions <Badge variant="outline" className="ml-2">{data.inscriptions.length}</Badge></CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {data.inscriptions.length === 0 && <div className="text-xs text-muted-foreground">No inscriptions found.</div>}
                {data.inscriptions.map((i) => (
                  <a key={i.id} href={i.curatedUrl} target="_blank" rel="noopener noreferrer" className="block text-xs bg-background/40 border border-border/30 rounded px-2 py-1.5 hover:border-primary/40">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">#{i.number.toLocaleString()}</span>
                      <Badge variant="outline" className="text-[10px]">{i.contentType.split(";")[0]}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{i.contentLength} bytes · {i.satRarity || "common"} · block {i.genesisBlockHeight}</div>
                    <div className="text-[10px] font-mono truncate">{i.id}</div>
                    <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">View on ordinals.com <ExternalLink className="w-3 h-3" /></div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">BRC-20 <Badge variant="outline" className="ml-2">{data.brc20.length}</Badge></CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {data.brc20.length === 0 && <div className="text-xs text-muted-foreground">No BRC-20 balances.</div>}
                {data.brc20.map((b) => (
                  <div key={b.ticker} className="text-xs bg-background/40 border border-border/30 rounded px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono uppercase font-bold">{b.ticker}</span>
                      <span className="font-mono">{b.overallBalance}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>avail: {b.availableBalance}</span>
                      <span>transferable: {b.transferrableBalance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Runes <Badge variant="outline" className="ml-2">{data.runes.length}</Badge></CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {data.runes.length === 0 && <div className="text-xs text-muted-foreground">No Runes balances.</div>}
                {data.runes.map((r) => (
                  <div key={r.rune} className="text-xs bg-background/40 border border-border/30 rounded px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold">{r.symbol} {r.rune}</span>
                      <span className="font-mono">{r.amount}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">divisibility {r.divisibility}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
