import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateWallet, useCreateMultisig, type WalletData, type MultisigData } from "@workspace/api-client-react";
import { Sparkles, Copy, ShieldCheck, AlertTriangle } from "lucide-react";

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

export function WalletCreateTab() {
  return (
    <div className="grid gap-4">
      <Card className="bg-amber-500/10 border-amber-500/40">
        <CardContent className="p-3 flex items-start gap-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>Wallets are generated server-side from your inputs. Mnemonics are returned to your browser and never stored. Treat the seed as cash; copy it to safe offline storage before funding.</div>
        </CardContent>
      </Card>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single" className="text-xs">Single-sig (BIP44/49/84/86)</TabsTrigger>
          <TabsTrigger value="multi" className="text-xs">Multisig (P2WSH / P2SH)</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="mt-3"><SingleWallet /></TabsContent>
        <TabsContent value="multi" className="mt-3"><MultisigWallet /></TabsContent>
      </Tabs>
    </div>
  );
}

function SingleWallet() {
  const [bip, setBip] = useState<44 | 49 | 84 | 86>(84);
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [strength, setStrength] = useState<128 | 256>(128);
  const [passphrase, setPassphrase] = useState("");
  const [importMnemonic, setImportMnemonic] = useState("");
  const create = useCreateWallet();
  const result = create.data as WalletData | undefined;

  function generate() {
    create.mutate({ data: { bip, network, strength, passphrase: passphrase || undefined, count: 5 } });
  }
  function importIt() {
    if (!importMnemonic.trim()) return;
    create.mutate({ data: { bip, network, mnemonic: importMnemonic.trim(), passphrase: passphrase || undefined, count: 5 } });
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Generate / Import Wallet</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">BIP</Label>
              <select value={bip} onChange={(e) => setBip(Number(e.target.value) as 44 | 49 | 84 | 86)} className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-xs mt-1">
                <option value={44}>BIP44 — Legacy P2PKH</option>
                <option value={49}>BIP49 — Nested SegWit</option>
                <option value={84}>BIP84 — Native SegWit</option>
                <option value={86}>BIP86 — Taproot</option>
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
              <Label className="text-xs">Mnemonic words</Label>
              <select value={strength} onChange={(e) => setStrength(Number(e.target.value) as 128 | 256)} className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-xs mt-1">
                <option value={128}>12 words (128 bits)</option>
                <option value={256}>24 words (256 bits)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Passphrase (BIP39)</Label>
              <Input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="optional" className="text-xs mt-1" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={generate} disabled={create.isPending}>Generate new wallet</Button>
            <div className="flex-1 flex gap-2">
              <Input placeholder="Or import 12/24-word mnemonic to derive…" value={importMnemonic} onChange={(e) => setImportMnemonic(e.target.value)} className="text-xs flex-1" />
              <Button size="sm" variant="outline" onClick={importIt} disabled={create.isPending || !importMnemonic.trim()}>Import</Button>
            </div>
          </div>
          {create.error && <div className="text-xs text-rose-400 mt-2">{(create.error as Error).message}</div>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Seed (KEEP SECRET)</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-background/40 border border-amber-500/30 rounded p-3 font-mono text-sm break-words">{result.mnemonic}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variant="outline">{result.scheme}</Badge>
                <Badge variant="outline">{result.network}</Badge>
                <Badge variant="outline">{result.derivationPath}</Badge>
                <Badge variant="outline">fp: {result.fingerprint}</Badge>
                <Button size="sm" variant="outline" onClick={() => copy(result.mnemonic)}><Copy className="w-3 h-3 mr-1" /> Copy seed</Button>
                <Button size="sm" variant="outline" onClick={() => copy(result.xpub)}><Copy className="w-3 h-3 mr-1" /> Copy xpub</Button>
              </div>
              <div className="mt-2 text-[10px] font-mono text-muted-foreground break-all">xpub: {result.xpub}</div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <AddressList title="Receive addresses" addresses={result.receive} />
            <AddressList title="Change addresses" addresses={result.change} />
          </div>
        </>
      )}
    </div>
  );
}

function AddressList({ title, addresses }: { title: string; addresses: WalletData["receive"] }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-1">
          {addresses.map((a) => (
            <div key={a.address} className="flex items-center justify-between text-xs font-mono bg-background/40 border border-border/30 rounded px-2 py-1.5">
              <span className="text-muted-foreground">m/.../{a.path}</span>
              <span className="truncate ml-2">{a.address}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(a.address)}><Copy className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MultisigWallet() {
  const [m, setM] = useState(2);
  const [n, setN] = useState(3);
  const [type, setType] = useState<"p2sh" | "p2wsh" | "p2sh-p2wsh">("p2wsh");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const create = useCreateMultisig();
  const result = create.data as MultisigData | undefined;

  function generate() {
    create.mutate({ data: { m, cosigners: n, type, network } });
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> Multisig Wallet</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Required signers (m)</Label>
              <Input type="number" min={1} max={n} value={m} onChange={(e) => setM(Math.max(1, Math.min(n, Number(e.target.value))))} className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Total cosigners (n)</Label>
              <Input type="number" min={m} max={15} value={n} onChange={(e) => setN(Math.max(m, Math.min(15, Number(e.target.value))))} className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value as "p2sh" | "p2wsh" | "p2sh-p2wsh")} className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-xs mt-1">
                <option value="p2wsh">P2WSH (native segwit)</option>
                <option value="p2sh-p2wsh">P2SH-P2WSH (nested)</option>
                <option value="p2sh">P2SH (legacy)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Network</Label>
              <select value={network} onChange={(e) => setNetwork(e.target.value as "mainnet" | "testnet")} className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-xs mt-1">
                <option value="mainnet">mainnet</option>
                <option value="testnet">testnet</option>
              </select>
            </div>
          </div>
          <Button size="sm" className="mt-3" onClick={generate} disabled={create.isPending}>Generate {m}-of-{n} multisig</Button>
          {create.error && <div className="text-xs text-rose-400 mt-2">{(create.error as Error).message}</div>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Multisig Address — {result.m}-of-{result.n} {result.type}</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-background/40 border border-emerald-500/30 rounded p-3 font-mono text-sm break-all">{result.address}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => copy(result.address)}><Copy className="w-3 h-3 mr-1" /> Copy address</Button>
                <Badge variant="outline">{result.network}</Badge>
              </div>
              <div className="mt-3 text-xs">
                <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Witness script</div>
                <div className="font-mono break-all bg-background/40 border border-border/30 rounded p-2 text-[10px]">{result.witnessScript || result.redeemScript}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Cosigner Seeds (KEEP SECRET — distribute one to each signer)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.signers.map((s) => (
                  <div key={s.index} className="bg-background/40 border border-amber-500/20 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">Signer {s.index + 1}</Badge>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(s.mnemonic)}><Copy className="w-3 h-3 mr-1" />Copy</Button>
                    </div>
                    <div className="font-mono text-xs break-words">{s.mnemonic}</div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1 break-all">pubkey: {s.publicKey}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
