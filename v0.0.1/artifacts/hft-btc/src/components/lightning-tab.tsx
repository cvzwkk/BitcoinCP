import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Globe, Loader2, Copy } from "lucide-react";
import {
  useGetLightningNetwork,
  getGetLightningNetworkQueryKey,
  useDecodeLightningInvoice,
  useResolveLnurl,
  useLnurlPay,
  type DecodedInvoice,
  type LnurlResolved,
  type LnurlPayResult,
  type LightningNetwork,
} from "@workspace/api-client-react";
import { format } from "date-fns";

const SAT = 100_000_000;
const btc = (s: number) => (s / SAT).toFixed(8);

export function LightningTab() {
  const network = useGetLightningNetwork({
    query: { refetchInterval: 60_000, queryKey: getGetLightningNetworkQueryKey() },
  });
  const decode = useDecodeLightningInvoice();
  const lnurl = useResolveLnurl();
  const pay = useLnurlPay();
  const [invoice, setInvoice] = useState("");
  const [lnurlInput, setLnurlInput] = useState("");
  const [payAmount, setPayAmount] = useState("1000");
  const [payComment, setPayComment] = useState("");

  const decoded = decode.data as DecodedInvoice | undefined;
  const lnurlData = lnurl.data as LnurlResolved | undefined;
  const payResult = pay.data as LnurlPayResult | undefined;
  const lnurlPayMeta = (lnurlData?.data as { callback?: string; minSendable?: number; maxSendable?: number; metadata?: string } | undefined);

  return (
    <div className="grid gap-4">
      <NetworkStats data={network.data} loading={network.isLoading} />

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> Decode BOLT-11 Invoice</CardTitle></CardHeader>
          <CardContent>
            <Label className="text-xs">Invoice (lnbc…)</Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="lnbc1pj…" className="font-mono text-xs mt-1" />
            <Button size="sm" className="mt-2" onClick={() => decode.mutate({ data: { invoice: invoice.trim() } })} disabled={decode.isPending || !invoice.trim()}>
              {decode.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Decoding…</> : "Decode"}
            </Button>
            {decode.error && <div className="text-xs text-rose-400 mt-2">{(decode.error as Error).message}</div>}
            {decoded && (
              <div className="mt-3 text-xs space-y-1 font-mono bg-background/40 border border-border/30 rounded p-3">
                <div><span className="text-muted-foreground">network:</span> {decoded.network}</div>
                <div><span className="text-muted-foreground">amount:</span> {decoded.amountSats != null ? `${decoded.amountSats.toLocaleString()} sats (${btc(decoded.amountSats)} BTC)` : "any (zero-amount invoice)"}</div>
                <div><span className="text-muted-foreground">desc:</span> {decoded.description ?? "—"}</div>
                <div><span className="text-muted-foreground">payee:</span> {decoded.payeeNodeKey ? decoded.payeeNodeKey.slice(0, 30) + "…" : "—"}</div>
                <div><span className="text-muted-foreground">expires:</span> {format(decoded.expiresAt, "yyyy-MM-dd HH:mm:ss")}</div>
                <div><span className="text-muted-foreground">payment hash:</span> {decoded.paymentHash}</div>
                <div><span className="text-muted-foreground">route hints:</span> {decoded.routeHints}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Resolve LNURL / Lightning Address</CardTitle></CardHeader>
          <CardContent>
            <Label className="text-xs">LNURL or you@host</Label>
            <Input value={lnurlInput} onChange={(e) => setLnurlInput(e.target.value)} placeholder="LNURL1… or alice@walletof.satoshi.com" className="font-mono text-xs mt-1" />
            <Button size="sm" className="mt-2" onClick={() => lnurl.mutate({ data: { lnurl: lnurlInput.trim() } })} disabled={lnurl.isPending || !lnurlInput.trim()}>
              {lnurl.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Resolving…</> : "Resolve"}
            </Button>
            {lnurl.error && <div className="text-xs text-rose-400 mt-2">{(lnurl.error as Error).message}</div>}
            {lnurlData && (
              <div className="mt-3 text-xs">
                <Badge>{lnurlData.type}</Badge>
                <div className="font-mono break-all bg-background/40 border border-border/30 rounded p-2 mt-2 text-[10px]">{JSON.stringify(lnurlData.data, null, 2)}</div>
                {lnurlData.type === "payRequest" && lnurlPayMeta?.callback && (
                  <div className="mt-3 space-y-2">
                    <div className="text-muted-foreground">Min: {lnurlPayMeta.minSendable ? lnurlPayMeta.minSendable / 1000 : "?"} sats · Max: {lnurlPayMeta.maxSendable ? lnurlPayMeta.maxSendable / 1000 : "?"} sats</div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="text-xs" placeholder="amount sats" />
                      <Input value={payComment} onChange={(e) => setPayComment(e.target.value)} className="text-xs col-span-2" placeholder="comment (optional)" />
                    </div>
                    <Button size="sm" onClick={() => pay.mutate({ data: { callback: lnurlPayMeta.callback!, amountSats: Number(payAmount), comment: payComment || undefined } })} disabled={pay.isPending}>
                      {pay.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Request invoice
                    </Button>
                    {pay.error && <div className="text-xs text-rose-400">{(pay.error as Error).message}</div>}
                    {payResult && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs space-y-1">
                        <div className="text-amber-300 font-bold">Lightning invoice generated</div>
                        <div className="font-mono break-all">{payResult.pr}</div>
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(payResult.pr)}><Copy className="w-3 h-3 mr-1" /> Copy</Button>
                        <div className="text-muted-foreground mt-1">Pay this invoice from any Lightning wallet (Phoenix, Wallet of Satoshi, Alby, Zeus, etc.).</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NetworkStats({ data, loading }: { data: LightningNetwork | undefined; loading: boolean }) {
  if (loading) {
    return <div className="flex items-center justify-center p-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading network…</div>;
  }
  if (!data) return null;
  const stats = data.stats as { node_count?: number; channel_count?: number; total_capacity?: number; clearnet_nodes?: number; tor_nodes?: number; avg_capacity?: number } | null;
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Lightning Network — Live Stats</CardTitle></CardHeader>
      <CardContent>
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Nodes" value={stats.node_count?.toLocaleString() ?? "—"} />
            <Stat label="Channels" value={stats.channel_count?.toLocaleString() ?? "—"} />
            <Stat label="Capacity" value={stats.total_capacity != null ? btc(stats.total_capacity) + " BTC" : "—"} />
            <Stat label="Clearnet" value={stats.clearnet_nodes?.toLocaleString() ?? "—"} />
            <Stat label="Tor" value={stats.tor_nodes?.toLocaleString() ?? "—"} />
          </div>
        ) : <div className="text-xs text-muted-foreground">Stats unavailable</div>}
        {data.topNodes.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Top Connectivity Nodes</div>
            <div className="grid md:grid-cols-2 gap-1.5">
              {data.topNodes.slice(0, 6).map((n) => (
                <div key={n.publicKey} className="flex items-center justify-between text-xs bg-background/40 border border-border/30 rounded px-2 py-1.5 font-mono">
                  <span className="truncate">{n.alias || n.publicKey.slice(0, 14) + "…"}</span>
                  <span className="text-muted-foreground">{n.channels} ch · {btc(n.capacity)} BTC</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/40 border border-border/30 rounded p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-mono font-bold mt-1">{value}</div>
    </div>
  );
}
