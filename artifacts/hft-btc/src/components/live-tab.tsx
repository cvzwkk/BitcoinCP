import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Snapshot } from "@workspace/api-client-react";
import { NumberTicker } from "./number-ticker";
import { format } from "date-fns";
import { ArrowDown, ArrowRight, ArrowUp, Activity, Server, Zap } from "lucide-react";
import { Progress } from "./ui/progress";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function LiveTab({ snapshot }: { snapshot: Snapshot }) {
  if (!snapshot) return null;

  const { microprice, book, venues, predictions, strategies } = snapshot;

  return (
    <div className="grid gap-4 md:grid-cols-12 auto-rows-max">
      {/* Hero: Microprice & Stats */}
      <Card className="col-span-full md:col-span-8 bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Live Microprice</h2>
              <div className="text-5xl md:text-7xl font-bold font-mono tracking-tighter flex items-center gap-4">
                $<NumberTicker value={microprice.value} decimals={8} trendColor className="drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="font-mono bg-background/50 backdrop-blur">
                <Activity className="w-3 h-3 mr-1 text-primary" /> {microprice.updatesPerSecond.toFixed(1)} up/s
              </Badge>
              <div className="text-xs text-muted-foreground mt-2 font-mono">
                Age: {Date.now() - microprice.updatedAt}ms
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase">Best Bid</p>
              <p className="text-lg font-mono text-emerald-400">{book.bestBid.toFixed(2)}</p>
              <p className="text-xs font-mono text-muted-foreground">{book.bidSize.toFixed(4)} BTC</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase">Best Ask</p>
              <p className="text-lg font-mono text-red-400">{book.bestAsk.toFixed(2)}</p>
              <p className="text-xs font-mono text-muted-foreground">{book.askSize.toFixed(4)} BTC</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase">Spread</p>
              <p className="text-lg font-mono text-primary">{book.spread.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase">Imbalance</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-mono">{book.imbalance.toFixed(2)}</p>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(book.imbalance + 1) * 50}%` }} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategies */}
      <Card className="col-span-full md:col-span-4 bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-medium uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Strategy Signals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {strategies.map((s, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{s.name}</span>
                <span className="font-mono">{s.score}/100</span>
              </div>
              <Progress value={s.score} className="h-1" />
              <p className="text-[10px] text-muted-foreground truncate">{s.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Predictions */}
      <div className="col-span-full grid grid-cols-2 md:grid-cols-4 gap-4">
        {predictions.map((p) => {
          const isUp = p.direction === "up";
          const isDown = p.direction === "down";
          
          return (
            <motion.div
              key={p.horizonSeconds}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full border-border/50 bg-card/50">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider">{p.horizonSeconds}s Horizon</CardTitle>
                  <Badge variant={p.signal === "BUY" ? "default" : p.signal === "SELL" ? "destructive" : "secondary"} className="text-[10px]">
                    {p.signal}
                  </Badge>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold font-mono mb-1">
                    ${p.predictedPrice.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className={cn(isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-muted-foreground")}>
                      {p.deltaBps > 0 ? "+" : ""}{p.deltaBps.toFixed(1)} bps
                    </span>
                    {isUp ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : isDown ? <ArrowDown className="w-3 h-3 text-red-400" /> : <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>CONFIDENCE</span>
                      <span className="font-mono">{(p.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={p.confidence * 100} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Venues */}
      <Card className="col-span-full bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-medium uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" /> Live Venues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {venues.map((v) => (
              <div key={v.venue} className="p-3 rounded-lg border border-border/40 bg-background/30 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold">{v.venue}</span>
                  <div className={cn("w-2 h-2 rounded-full", v.connected ? "bg-emerald-500 shadow-[0_0_4px_#10b981]" : "bg-muted")} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <div className="text-muted-foreground">BID</div>
                    <div className="text-emerald-400">{v.bid.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">ASK</div>
                    <div className="text-red-400">{v.ask.toFixed(2)}</div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  Age: {v.ageMs}ms
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
