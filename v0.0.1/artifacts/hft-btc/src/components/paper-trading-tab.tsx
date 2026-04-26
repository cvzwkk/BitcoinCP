import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaperState, Trade } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useResetPaper, useUpdatePaperConfig, getGetSnapshotQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, RotateCcw, Target, TrendingUp, TrendingDown, DollarSign, Activity, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

const configSchema = z.object({
  initialBalance: z.coerce.number().min(1),
  entrySize: z.coerce.number().min(0.5),
  autoTrade: z.boolean(),
  minConfidence: z.array(z.number()).transform((v) => v[0]),
});

export function PaperTradingTab({ paper, recentTrades }: { paper: PaperState; recentTrades: Trade[] }) {
  const queryClient = useQueryClient();
  const updateConfig = useUpdatePaperConfig();
  const resetPaper = useResetPaper();

  const form = useForm<z.infer<typeof configSchema>>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      initialBalance: paper.initialBalance,
      entrySize: paper.entrySize,
      autoTrade: paper.autoTrade,
      minConfidence: [paper.minConfidence * 100] as any,
    },
  });

  function onSubmit(values: z.infer<typeof configSchema>) {
    updateConfig.mutate(
      {
        data: {
          initialBalance: values.initialBalance,
          entrySize: values.entrySize,
          autoTrade: values.autoTrade,
          minConfidence: values.minConfidence / 100,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSnapshotQueryKey() });
        },
      },
    );
  }

  function onReset() {
    resetPaper.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSnapshotQueryKey() });
      },
    });
  }

  const pnlIsPositive = paper.totalPnl >= 0;
  const familyOrder = ["microprice", "burst", "meanrev", "imbalance", "arb", "chart"] as const;
  const sortedStrategies = [...(paper.strategies ?? [])].sort(
    (a, b) => familyOrder.indexOf(a.family as any) - familyOrder.indexOf(b.family as any),
  );

  return (
    <div className="grid gap-4 md:grid-cols-12">
      {paper.stopped && (
        <div className="col-span-full">
          <Card className="bg-red-950/30 border-red-500/60">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertOctagon className="w-6 h-6 text-red-400 shrink-0" />
              <div>
                <div className="font-mono text-sm font-bold text-red-300 uppercase tracking-wider">
                  ENGINE STOPPED — equity depleted
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Set a new balance below or reset the engine to resume trading.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats row */}
      <div className="col-span-full grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <DollarSign className="w-3 h-3 mr-1" /> Balance
            </div>
            <div className="text-2xl font-mono font-bold">${paper.balance.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Target className="w-3 h-3 mr-1" /> Equity
            </div>
            <div className="text-2xl font-mono font-bold">${paper.equity.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Activity className="w-3 h-3 mr-1" /> Total P&L
            </div>
            <div className={cn("text-2xl font-mono font-bold", pnlIsPositive ? "text-emerald-400" : "text-red-400")}>
              {pnlIsPositive ? "+" : ""}
              {paper.totalPnl.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <TrendingUp className="w-3 h-3 mr-1" /> Win Rate
            </div>
            <div className="text-2xl font-mono font-bold">{(paper.winRate * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {paper.winCount}W / {paper.lossCount}L
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Activity className="w-3 h-3 mr-1" /> Open / Total
            </div>
            <div className="text-2xl font-mono font-bold">
              {paper.openPositions.length}
              <span className="text-muted-foreground text-base">/{paper.tradesCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Config Form */}
      <Card className="col-span-full md:col-span-4 bg-card/50">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" /> Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="initialBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase">Set Balance ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" className="font-mono bg-background/50" {...field} />
                    </FormControl>
                    <div className="text-[10px] text-muted-foreground">
                      Updates the working balance immediately and re-allocates strategies.
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entrySize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase">Max Entry Size ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" className="font-mono bg-background/50" {...field} />
                    </FormControl>
                    <div className="text-[10px] text-muted-foreground">
                      Each new position uses up to this notional, capped by per-strategy budget.
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minConfidence"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel className="text-xs uppercase">Min Confidence</FormLabel>
                      <span className="text-xs font-mono">{field.value}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[field.value as number]}
                        onValueChange={field.onChange}
                        className="py-2"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoTrade"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-3 bg-background/30">
                    <div className="space-y-0.5">
                      <FormLabel className="text-xs uppercase">Auto-trade Engine</FormLabel>
                      <div className="text-[10px] text-muted-foreground">High-frequency, executes signals automatically</div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 font-mono uppercase tracking-wider text-xs" disabled={updateConfig.isPending}>
                  {updateConfig.isPending ? "Updating..." : "Apply"}
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={onReset} disabled={resetPaper.isPending} title="Reset engine">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Strategies grid */}
      <Card className="col-span-full md:col-span-8 bg-card/50">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Strategies & Allocations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {sortedStrategies.map((s) => {
              const wr = s.closedCount > 0 ? (s.winCount / s.closedCount) * 100 : 0;
              const totalPnl = s.realizedPnl + s.unrealizedPnl;
              const positive = totalPnl >= 0;
              return (
                <div key={s.id} className="grid grid-cols-12 gap-3 items-center px-4 py-3 text-xs font-mono">
                  <div className="col-span-3">
                    <div className="text-foreground font-semibold uppercase tracking-wider text-[11px]">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.family}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Allocation</div>
                    <div>${s.allocatedBalance.toFixed(2)} <span className="text-muted-foreground">({(s.allocationPct * 100).toFixed(1)}%)</span></div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Realized</div>
                    <div className={cn(s.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {s.realizedPnl >= 0 ? "+" : ""}{s.realizedPnl.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Unrealized</div>
                    <div className={cn(s.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {s.unrealizedPnl >= 0 ? "+" : ""}{s.unrealizedPnl.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Trades</div>
                    <div>
                      <span className="text-foreground">{s.closedCount}</span>
                      <span className="text-muted-foreground"> · {wr.toFixed(0)}% win</span>
                    </div>
                  </div>
                  <div className="col-span-1 text-right">
                    <Badge variant={positive ? "default" : "destructive"} className="font-mono text-[10px]">
                      {s.openCount} open
                    </Badge>
                  </div>
                </div>
              );
            })}
            {sortedStrategies.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground font-mono">No strategies registered</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Open positions list */}
      <Card className="col-span-full bg-card/50">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Open Positions ({paper.openPositions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40 max-h-72 overflow-auto">
            {paper.openPositions.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground font-mono">No open positions</div>
            )}
            {paper.openPositions.map((p) => {
              const remainingMs = p.expiresAt - Date.now();
              return (
                <div key={p.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2 text-xs font-mono">
                  <div className="col-span-2 truncate text-[10px] text-muted-foreground uppercase">{p.strategyLabel}</div>
                  <div className="col-span-1">
                    <Badge variant={p.side === "BUY" ? "default" : "destructive"} className="text-[10px]">
                      {p.side}
                    </Badge>
                  </div>
                  <div className="col-span-2">@ ${p.entryPrice.toFixed(2)}</div>
                  <div className="col-span-2">${p.notional.toFixed(2)}</div>
                  <div className={cn("col-span-2", p.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toFixed(3)}
                  </div>
                  <div className="col-span-1 text-muted-foreground">{p.horizonSeconds}s</div>
                  <div className="col-span-2 text-right text-muted-foreground">
                    {remainingMs > 0
                      ? remainingMs > 86400000
                        ? `${Math.round(remainingMs / 86400000)}d left`
                        : remainingMs > 3600000
                          ? `${Math.round(remainingMs / 3600000)}h left`
                          : remainingMs > 60000
                            ? `${Math.round(remainingMs / 60000)}m left`
                            : `${Math.round(remainingMs / 1000)}s left`
                      : "expiring..."}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent trades */}
      <Card className="col-span-full bg-card/50">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {recentTrades.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", t.side === "BUY" ? "bg-emerald-500" : "bg-red-500")} />
                  <div>
                    <div>
                      <span className="text-muted-foreground">{t.strategyLabel}</span> · {t.side} @ ${t.entryPrice.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {(t.durationMs / 1000).toFixed(1)}s • {t.reason} • horizon {t.horizonSeconds}s
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("font-bold", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t.notional.toFixed(2)} USD</div>
                </div>
              </div>
            ))}
            {recentTrades.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground font-mono">No trades yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Open Position highlight (legacy single) */}
      {paper.openPosition && (
        <Card className="col-span-full bg-card/50 border-primary/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            {paper.openPosition.side === "BUY" ? (
              <TrendingUp className="w-24 h-24 text-emerald-500" />
            ) : (
              <TrendingDown className="w-24 h-24 text-red-500" />
            )}
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge variant={paper.openPosition.side === "BUY" ? "default" : "destructive"}>
                {paper.openPosition.side}
              </Badge>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Featured Open Position</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 relative z-10">
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase">Strategy</div>
                <div className="text-base font-mono">{paper.openPosition.strategyLabel}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase">Entry Price</div>
                <div className="text-xl font-mono">${paper.openPosition.entryPrice.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase">Size</div>
                <div className="text-xl font-mono">${paper.openPosition.notional.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase">Unrealized P&L</div>
                <div
                  className={cn(
                    "text-xl font-mono font-bold",
                    paper.openPosition.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {paper.openPosition.unrealizedPnl >= 0 ? "+" : ""}
                  {paper.openPosition.unrealizedPnl.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase">Duration</div>
                <div className="text-xl font-mono">{((Date.now() - paper.openPosition.openedAt) / 1000).toFixed(0)}s</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
