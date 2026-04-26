import {
  useGetPredictionStats,
  getGetPredictionStatsQueryKey,
  useResetPredictionStats,
  type HorizonStats,
  type ResolvedPrediction,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  ComposedChart,
} from "recharts";
import { Target, TrendingUp, RotateCcw, Loader2, CheckCircle2, XCircle, Minus, Hourglass } from "lucide-react";
import { format } from "date-fns";

const COLOR_HIT = "#10b981";
const COLOR_MISS = "#f43f5e";
const COLOR_FLAT = "#64748b";

function pct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

export function AccuracyTab() {
  const { data, isLoading } = useGetPredictionStats({
    query: { refetchInterval: 1000, queryKey: getGetPredictionStatsQueryKey() },
  });
  const reset = useResetPredictionStats();
  const qc = useQueryClient();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Tracking predictions…
      </div>
    );
  }

  const totals = data.totalsAcrossHorizons;
  const overallPie = [
    { name: "Hits", value: totals.hits, fill: COLOR_HIT },
    { name: "Misses", value: totals.misses, fill: COLOR_MISS },
    { name: "Flat", value: totals.flats, fill: COLOR_FLAT },
  ];
  const horizonsBar = data.horizons.map((h) => ({
    horizon: `${h.horizonSeconds}s`,
    hits: h.hits,
    misses: h.misses,
    flats: h.flats,
    accuracy: Number((h.decisiveAccuracy * 100).toFixed(1)),
  }));

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-3 bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Resolved</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold">{totals.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">across all 4 horizons</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3 bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Hits (acertos)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-6 h-6" /> {totals.hits.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{pct(totals.accuracy)} overall accuracy</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3 bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Misses (erros)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold text-rose-400 flex items-center gap-2"><XCircle className="w-6 h-6" /> {totals.misses.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">wrong direction calls</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3 bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Flat / Pending</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold text-slate-400 flex items-center gap-2"><Minus className="w-6 h-6" /> {totals.flats.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Hourglass className="w-3 h-3" /> {data.horizons.reduce((s, h) => s + h.pending, 0)} pending resolution</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        <Card className="md:col-span-5 bg-card/50 border-border/50">
          <CardHeader className="pb-2 flex-row flex items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Target className="w-3.5 h-3.5" /> Overall Outcome Mix</CardTitle>
            <Button
              size="sm" variant="outline"
              onClick={() => reset.mutate(undefined, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetPredictionStatsQueryKey() }) })}
              disabled={reset.isPending}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset tracker
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overallPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {overallPie.map((s) => <Cell key={s.name} fill={s.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-7 bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Hits vs Misses by Horizon</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={horizonsBar}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
                  <XAxis dataKey="horizon" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="hits" stackId="a" name="Hits" fill={COLOR_HIT} />
                  <Bar yAxisId="left" dataKey="misses" stackId="a" name="Misses" fill={COLOR_MISS} />
                  <Bar yAxisId="left" dataKey="flats" stackId="a" name="Flat" fill={COLOR_FLAT} />
                  <Line yAxisId="right" type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#22d3ee" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.horizons.map((h) => <HorizonCard key={h.horizonSeconds} h={h} />)}
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Recent Resolved Predictions</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {data.recent.length === 0 && <div className="text-xs text-muted-foreground">No resolved predictions yet — wait at least 5 seconds for the first horizon to expire.</div>}
            {data.recent.map((r) => <ResolvedRow key={r.id} r={r} />)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HorizonCard({ h }: { h: HorizonStats }) {
  const buckets = h.buckets.map((b) => ({
    time: format(b.ts, "HH:mm"),
    hits: b.hits,
    misses: b.misses,
    flats: b.flats,
    acc: b.hits + b.misses > 0 ? Number(((b.hits / (b.hits + b.misses)) * 100).toFixed(1)) : null,
  }));
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="text-primary font-mono text-sm">Horizon {h.horizonSeconds}s</span>
          <Badge variant="outline" className="font-mono">{h.pending} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="Total" value={h.total.toLocaleString()} />
          <Stat label="Hits" value={h.hits.toLocaleString()} cls="text-emerald-400" />
          <Stat label="Misses" value={h.misses.toLocaleString()} cls="text-rose-400" />
          <Stat label="Accuracy" value={pct(h.decisiveAccuracy)} cls="text-cyan-400" />
        </div>
        <div className="text-[10px] text-muted-foreground mb-2 flex flex-wrap gap-2">
          <span>Up calls: {h.upCalls} ({h.upCalls ? pct(h.upHits / h.upCalls) : "—"})</span>
          <span>Down calls: {h.downCalls} ({h.downCalls ? pct(h.downHits / h.downCalls) : "—"})</span>
          <span>Flat calls: {h.flatCalls}</span>
          <span>Avg conf: {pct(h.avgConfidence)}</span>
          <span>Avg |err|: {h.avgAbsErrorBps.toFixed(2)} bps</span>
        </div>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
              <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} minTickGap={20} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: "11px" }} />
              <Bar dataKey="hits" stackId="a" name="Hits" fill={COLOR_HIT} />
              <Bar dataKey="misses" stackId="a" name="Misses" fill={COLOR_MISS} />
              <Bar dataKey="flats" stackId="a" name="Flat" fill={COLOR_FLAT} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[100px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
              <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} minTickGap={20} />
              <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} unit="%" />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: "11px" }} />
              <Line type="monotone" dataKey="acc" name="Accuracy" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-background/40 border border-border/30 rounded p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"text-lg font-mono font-bold " + (cls ?? "")}>{value}</div>
    </div>
  );
}

function ResolvedRow({ r }: { r: ResolvedPrediction }) {
  const color =
    r.outcome === "hit" ? "border-emerald-500/40 bg-emerald-500/5" :
    r.outcome === "miss" ? "border-rose-500/40 bg-rose-500/5" :
    "border-slate-500/30 bg-slate-500/5";
  const Icon = r.outcome === "hit" ? CheckCircle2 : r.outcome === "miss" ? XCircle : Minus;
  const iconColor = r.outcome === "hit" ? "text-emerald-400" : r.outcome === "miss" ? "text-rose-400" : "text-slate-400";
  return (
    <div className={"flex items-center justify-between text-xs font-mono border rounded px-2 py-1.5 " + color}>
      <div className="flex items-center gap-2">
        <Icon className={"w-3.5 h-3.5 " + iconColor} />
        <Badge variant="outline" className="text-[10px]">{r.horizonSeconds}s</Badge>
        <span className="text-muted-foreground">{format(r.resolvedAt, "HH:mm:ss")}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span>pred: <span className={r.predictedDirection === "up" ? "text-emerald-400" : r.predictedDirection === "down" ? "text-rose-400" : "text-muted-foreground"}>{r.predictedDirection}</span></span>
        <span>actual: <span className={r.actualDirection === "up" ? "text-emerald-400" : r.actualDirection === "down" ? "text-rose-400" : "text-muted-foreground"}>{r.actualDirection}</span></span>
        <span className="text-muted-foreground">{r.actualDeltaBps >= 0 ? "+" : ""}{r.actualDeltaBps.toFixed(2)} bps</span>
        <span className="text-muted-foreground">conf {(r.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
