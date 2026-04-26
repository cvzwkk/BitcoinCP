import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wallet, Send, Loader2, Server, ExternalLink } from "lucide-react";
import { useWalletBalance, useWalletSend, type WalletBalance, type WalletSendResult } from "@workspace/api-client-react";

const SAT = 100_000_000;
const btc = (s: number) => (s / SAT).toFixed(8);

export function WalletOpenTab() {
  const [mnemonic, setMnemonic] = useState("");
  const [bip, setBip] = useState<44 | 49 | 84>(84);
  const [network, setNetwork] = useState<"mainnet" | "testnet">("testnet");
  const [passphrase, setPassphrase] = useState("");
  const [scanCount, setScanCount] = useState(10);

  const balance = useWalletBalance();
  const data = balance.data as WalletBalance | undefined;

  function loadBalance() {
    if (!mnemonic.trim()) return;
    balance.mutate({ data: { mnemonic: mnemonic.trim(), bip, network, passphrase, scanCount } });
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-sky-500/10 border-sky-500/40">
        <CardContent className="p-3 flex items-start gap-2 text-xs text-sky-100">
          <Server className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>This wallet is fully external-node based. UTXOs and broadcasts go through the public mempool.space API — no local node is required. Use a testnet wallet first to verify the flow.</div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> Open Wallet</CardTitle></CardHeader>
        <CardContent>
          <Label className="text-xs">Mnemonic seed</Label>
          <Input value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} placeholder="12 or 24 word mnemonic..." className="font-mono text-xs mt-1" />
          <div className="grid md:grid-cols-4 gap-3 mt-3">
            <div>
              <Label className="text-xs">BIP</Label>
              <select value={bip} onChange={(e) => setBip(Number(e.target.value) as 44 | 49 | 84)} className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-xs mt-1">
                <option value={44}>44 Legacy</option>
                <option value={49}>49 Nested SegWit</option>
                <option value={84}>84 Native SegWit</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Network</Label>
              <select value={network} onChange={(e) => setNetwork(e.target.value as "mainnet" | "testnet")} className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-xs mt-1">
                <option value="mainnet">mainnet</option>
                <option value="testnet">testnet</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Passphrase</Label>
              <Input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="optional" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Scan addresses</Label>
              <Input type="number" min={1} max={40} value={scanCount} onChange={(e) => setScanCount(Math.max(1, Math.min(40, Number(e.target.value))))} className="text-xs mt-1" />
            </div>
          </div>
          <Button size="sm" className="mt-3" onClick={loadBalance} disabled={balance.isPending || !mnemonic.trim()}>
            {balance.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Scanning…</> : "Load wallet"}
          </Button>
          {balance.error && <div className="text-xs text-rose-400 mt-2">{(balance.error as Error).message}</div>}
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-primary">{btc(data.totalSats)} <span className="text-sm font-normal text-muted-foreground">BTC</span></div>
                <div className="text-xs text-muted-foreground mt-1">{data.totalSats.toLocaleString()} sats</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Confirmed</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-mono">{btc(data.confirmedSats)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Used Addresses</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-mono">{data.addresses.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Unconfirmed: {btc(data.unconfirmedSats)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Funded Addresses</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data.addresses.length === 0 && <div className="text-xs text-muted-foreground">No funded addresses found in scan range.</div>}
                {data.addresses.map((a) => (
                  <div key={a.address} className="flex items-center justify-between text-xs font-mono bg-background/40 border border-border/30 rounded px-3 py-2">
                    <span className="text-muted-foreground">m/.../{a.derivationPath}</span>
                    <span className="truncate flex-1 mx-2">{a.address}</span>
                    <span>{btc(a.sats)} BTC</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <SendForm mnemonic={mnemonic} bip={bip} network={network} passphrase={passphrase} scanCount={scanCount} />
        </>
      )}
    </div>
  );
}

function SendForm({ mnemonic, bip, network, passphrase, scanCount }: { mnemonic: string; bip: 44 | 49 | 84; network: "mainnet" | "testnet"; passphrase: string; scanCount: number }) {
  const [toAddress, setToAddress] = useState("");
  const [amountSats, setAmountSats] = useState("10000");
  const [feeRate, setFeeRate] = useState("5");
  const send = useWalletSend();
  const result = send.data as WalletSendResult | undefined;

  function broadcast() {
    send.mutate({
      data: {
        mnemonic,
        bip,
        network,
        passphrase,
        scanCount,
        toAddress: toAddress.trim(),
        amountSats: Math.floor(Number(amountSats)),
        feeRate: Number(feeRate),
      },
    });
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Send className="w-3.5 h-3.5" /> Send Bitcoin</CardTitle></CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Recipient address</Label>
            <Input value={toAddress} onChange={(e) => setToAddress(e.target.value)} placeholder="bc1q… or tb1q…" className="font-mono text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs">Amount (sats)</Label>
            <Input type="number" min={547} value={amountSats} onChange={(e) => setAmountSats(e.target.value)} className="text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs">Fee rate (sat/vB)</Label>
            <Input type="number" min={1} value={feeRate} onChange={(e) => setFeeRate(e.target.value)} className="text-xs mt-1" />
          </div>
        </div>
        <Button className="mt-3" onClick={broadcast} disabled={send.isPending || !toAddress.trim()}>
          {send.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Building & broadcasting…</> : <><Send className="w-3 h-3 mr-1" /> Sign & broadcast</>}
        </Button>
        {send.error && <div className="text-xs text-rose-400 mt-2">{(send.error as Error).message}</div>}
        {result && (
          <div className="mt-3 bg-emerald-500/10 border border-emerald-500/40 rounded p-3 text-xs">
            <div className="font-bold text-emerald-300 mb-1">Broadcast OK!</div>
            <div className="font-mono break-all">txid: {result.txid}</div>
            <div className="text-muted-foreground mt-1">fee: {result.fee} sats · vsize: {result.vsize} vB · inputs: {result.inputsUsed} · change: {result.changeSats} sats</div>
            <a href={`https://mempool.space/${network === "testnet" ? "testnet/" : ""}tx/${result.txid}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 inline-flex items-center gap-1 mt-1">
              View on mempool.space <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
