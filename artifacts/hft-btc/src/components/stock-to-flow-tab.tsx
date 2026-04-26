import { useGetStockToFlow, getGetStockToFlowQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";

function usd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "k";
  return "$" + n.toFixed(2);
}

export function StockToFlowTab() {
  const { data, isLoading } = useGetStockToFlow({
    query: { refetchInterval: 60_000, queryKey: getGetStockToFlowQueryKey() },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Computing model...
      </div>
    );
  }

  const chart = data.points.map((p) => ({
    date: format(p.ts, "yyyy-MM"),
    ts: p.ts,
    s2f: Number(p.s2f.toFixed(2)),
    model: p.modelPrice,
    market: p.marketPrice ?? null,
  }));
  const ratio = data.marketPrice && data.modelPrice ? data.marketPrice / data.modelPrice : null;

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <Card className="md:col-span-3 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Model Price</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold text-primary">{usd(data.modelPrice)}</div>
          <div className="text-xs text-muted-foreground mt-1">Plan B S2F (a=-1.84, b=3.36)</div>
        </CardContent>
      </Card>
      <Card className="md:col-span-3 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Market Price</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold">{usd(data.marketPrice)}</div>
          <div className="text-xs text-muted-foreground mt-1">Spot, USD</div>
        </CardContent>
      </Card>
      <Card className="md:col-span-3 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Market / Model</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={"text-3xl font-mono font-bold " + (ratio && ratio < 1 ? "text-amber-400" : "text-emerald-400")}>
            {ratio ? ratio.toFixed(2) + "x" : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {ratio && ratio < 1 ? "Below model — undervalued" : "At/above model"}
          </div>
        </CardContent>
      </Card>
      <Card className="md:col-span-3 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Current S2F</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold">{data.currentS2F.toFixed(1)}</div>
          {data.nextHalving && (
            <div className="text-xs text-muted-foreground mt-1">
              Next halving: block {data.nextHalving.height.toLocaleString()} (~{Math.round(data.nextHalving.estimatedDays)}d)
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-12 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Stock-to-Flow (log scale)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
                <XAxis dataKey="date" minTickGap={40} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis
                  scale="log"
                  domain={["auto", "auto"]}
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => usd(Number(v))}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
                  formatter={(v: number) => usd(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="model" stroke="#22d3ee" strokeWidth={2} dot={false} name="S2F model" />
                <Line type="monotone" dataKey="market" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls name="Market" />
                <ReferenceLine x={chart.find((p) => p.market !== null)?.date} stroke="hsl(var(--border))" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">model_price = e^a · S2F^b, a=-1.84, b=3.36</Badge>
            <Badge variant="outline">Halving heights: 210k / 420k / 630k / 840k / 1050k</Badge>
            <Badge variant="outline">Source: market prices via CoinGecko, supply via halving schedule</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
