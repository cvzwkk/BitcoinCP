import { useGetMempool, getGetMempoolQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Boxes, Layers, Zap, Clock } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

function fmtBytes(b: number) {
  if (b > 1e9) return (b / 1e9).toFixed(2) + " GB";
  if (b > 1e6) return (b / 1e6).toFixed(2) + " MB";
  if (b > 1e3) return (b / 1e3).toFixed(2) + " KB";
  return `${b} B`;
}

export function MempoolTab() {
  const { data, isLoading } = useGetMempool({
    query: { refetchInterval: 8000, queryKey: getGetMempoolQueryKey() },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading on-chain state...
      </div>
    );
  }

  const { mempool, blocks, fees, difficulty, tipHeight } = data;
  const congestion = Math.min(100, Math.round((mempool.vsize / 300_000_000) * 100));

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <Card className="md:col-span-4 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" /> Tip Height
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold text-primary">{tipHeight.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-2">Current chain tip</div>
        </CardContent>
      </Card>

      <Card className="md:col-span-4 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Boxes className="w-3.5 h-3.5" /> Mempool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold">{mempool.count.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">tx</span></div>
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>{fmtBytes(mempool.vsize)} vsize</span><span>{congestion}% load</span></div>
            <div className="h-1.5 bg-muted/30 rounded mt-1">
              <div className="h-full rounded bg-gradient-to-r from-emerald-400 to-amber-500" style={{ width: `${congestion}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-4 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Difficulty
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold">{difficulty.progressPercent.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground mt-1">
            {difficulty.remainingBlocks} blocks until retarget
          </div>
          <div className={"text-xs mt-1 font-mono " + (difficulty.difficultyChange >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {difficulty.difficultyChange >= 0 ? "+" : ""}{difficulty.difficultyChange.toFixed(2)}% est.
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-12 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" /> Fee Estimates (sat/vB)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["No Priority", fees.minimumFee, "text-muted-foreground"],
              ["Economy", fees.economyFee, "text-sky-400"],
              ["1 hour", fees.hourFee, "text-cyan-400"],
              ["30 min", fees.halfHourFee, "text-amber-400"],
              ["Next block", fees.fastestFee, "text-emerald-400"],
            ].map(([label, val, color]) => (
              <div key={String(label)} className="bg-background/50 border border-border/40 rounded p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label as string}</div>
                <div className={"text-2xl font-mono font-bold mt-1 " + (color as string)}>{val as number}</div>
                <div className="text-[10px] text-muted-foreground">sat/vB</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-12 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Recent Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {blocks.slice(0, 10).map((b) => (
              <div key={b.id} className="bg-background/40 border border-border/40 rounded p-3 hover:border-primary/40 transition">
                <div className="text-xs font-mono font-bold text-primary">{b.height.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{format(b.timestamp * 1000, "HH:mm:ss")} · {formatDistanceToNowStrict(b.timestamp * 1000)} ago</div>
                <div className="flex justify-between mt-2 text-[10px]">
                  <Badge variant="outline" className="px-1 py-0 text-[10px]">{b.txCount.toLocaleString()} tx</Badge>
                  <span className="text-muted-foreground">{fmtBytes(b.size)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 break-all font-mono">{b.id.slice(0, 12)}…</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
