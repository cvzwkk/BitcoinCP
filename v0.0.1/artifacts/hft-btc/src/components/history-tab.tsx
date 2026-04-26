import { useGetTrades, getGetTradesQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function HistoryTab() {
  const { data, isLoading } = useGetTrades({ query: { refetchInterval: 1000, queryKey: getGetTradesQueryKey() } });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading history...
    </div>;
  }

  const trades = data?.trades || [];

  return (
    <Card className="bg-card/50 border-border/50 overflow-hidden">
      <div className="max-h-[600px] overflow-auto">
        <Table>
          <TableHeader className="bg-background/80 sticky top-0 backdrop-blur z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider">Opened At</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider">Side</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Entry</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Exit</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Size ($)</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">P&L ($)</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">P&L %</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Duration</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map(t => {
              const isWin = t.pnl > 0;
              return (
                <TableRow key={t.id} className="border-border/40 hover:bg-muted/20">
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {format(t.openedAt, "HH:mm:ss.SSS")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.side === "BUY" ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {t.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right whitespace-nowrap">
                    ${t.entryPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right whitespace-nowrap">
                    ${t.exitPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right">
                    {t.notional.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn("font-mono text-xs text-right font-bold", isWin ? "text-emerald-400" : "text-red-400")}>
                    {isWin ? "+" : ""}{t.pnl.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn("font-mono text-xs text-right", isWin ? "text-emerald-400/80" : "text-red-400/80")}>
                    {isWin ? "+" : ""}{(t.pnlPct * 100).toFixed(3)}%
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground">
                    {(t.durationMs / 1000).toFixed(1)}s
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-right text-muted-foreground">
                    {t.reason}
                  </TableCell>
                </TableRow>
              );
            })}
            {trades.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center font-mono text-muted-foreground">
                  No trade history
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
