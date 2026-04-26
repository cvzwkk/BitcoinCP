import { useGetSnapshot, getGetSnapshotQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, History, LineChart, Cpu, Layers, TrendingUp, Search,
  KeyRound, Wallet, Zap, Boxes, Target, BarChart3,
} from "lucide-react";
import { LiveTab } from "@/components/live-tab";
import { PaperTradingTab } from "@/components/paper-trading-tab";
import { HistoryTab } from "@/components/history-tab";
import { AiAssistantTab } from "@/components/ai-assistant-tab";
import { AccuracyTab } from "@/components/accuracy-tab";
import { ChartForecastTab } from "@/components/chart-forecast-tab";
import { MempoolTab } from "@/components/mempool-tab";
import { StockToFlowTab } from "@/components/stock-to-flow-tab";
import { WalletSearchTab } from "@/components/wallet-search-tab";
import { WalletCreateTab } from "@/components/wallet-create-tab";
import { WalletOpenTab } from "@/components/wallet-open-tab";
import { LightningTab } from "@/components/lightning-tab";
import { OnchainAssetsTab } from "@/components/onchain-assets-tab";

const TRIGGER_CLASS = "text-[11px] uppercase tracking-wider font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary";

export default function Dashboard() {
  const { data: snapshot, isLoading } = useGetSnapshot({
    query: { refetchInterval: 250, queryKey: getGetSnapshotQueryKey() }
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="h-14 border-b border-border/40 bg-background/95 backdrop-blur z-50 flex items-center px-4 justify-between sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-widest uppercase">BTC HFT Predictor</h1>
            <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981] animate-pulse" />
              SYSTEM ONLINE
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-[1600px] mx-auto w-full">
        {!snapshot || isLoading ? (
          <div className="flex items-center justify-center h-[50vh] flex-col gap-4 text-primary">
            <Activity className="w-8 h-8 animate-pulse" />
            <div className="font-mono text-sm uppercase tracking-widest">Connecting to datastream...</div>
          </div>
        ) : (
          <Tabs defaultValue="live" className="space-y-6">
            <div className="flex justify-center md:justify-start overflow-x-auto">
              <TabsList className="bg-muted/50 border border-border/50 p-1 flex-wrap h-auto">
                <TabsTrigger value="live" className={TRIGGER_CLASS}><Activity className="w-3.5 h-3.5 mr-1.5" /> Live</TabsTrigger>
                <TabsTrigger value="paper" className={TRIGGER_CLASS}><LineChart className="w-3.5 h-3.5 mr-1.5" /> Control</TabsTrigger>
                <TabsTrigger value="history" className={TRIGGER_CLASS}><History className="w-3.5 h-3.5 mr-1.5" /> History</TabsTrigger>
                <TabsTrigger value="accuracy" className={TRIGGER_CLASS}><Target className="w-3.5 h-3.5 mr-1.5" /> Accuracy</TabsTrigger>
                <TabsTrigger value="forecast" className={TRIGGER_CLASS}><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Forecast</TabsTrigger>
                <TabsTrigger value="ai" className={TRIGGER_CLASS}><Cpu className="w-3.5 h-3.5 mr-1.5" /> AI Assist</TabsTrigger>
                <TabsTrigger value="s2f" className={TRIGGER_CLASS}><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Stock-to-Flow</TabsTrigger>
                <TabsTrigger value="mempool" className={TRIGGER_CLASS}><Layers className="w-3.5 h-3.5 mr-1.5" /> Mempool</TabsTrigger>
                <TabsTrigger value="search" className={TRIGGER_CLASS}><Search className="w-3.5 h-3.5 mr-1.5" /> Address</TabsTrigger>
                <TabsTrigger value="create" className={TRIGGER_CLASS}><KeyRound className="w-3.5 h-3.5 mr-1.5" /> Create Wallet</TabsTrigger>
                <TabsTrigger value="open" className={TRIGGER_CLASS}><Wallet className="w-3.5 h-3.5 mr-1.5" /> Open / Send</TabsTrigger>
                <TabsTrigger value="lightning" className={TRIGGER_CLASS}><Zap className="w-3.5 h-3.5 mr-1.5" /> Lightning</TabsTrigger>
                <TabsTrigger value="assets" className={TRIGGER_CLASS}><Boxes className="w-3.5 h-3.5 mr-1.5" /> Assets</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="live" className="m-0 focus-visible:outline-none"><LiveTab snapshot={snapshot} /></TabsContent>
            <TabsContent value="paper" className="m-0 focus-visible:outline-none"><PaperTradingTab paper={snapshot.paper} recentTrades={snapshot.recentTrades} /></TabsContent>
            <TabsContent value="history" className="m-0 focus-visible:outline-none"><HistoryTab /></TabsContent>
            <TabsContent value="accuracy" className="m-0 focus-visible:outline-none"><AccuracyTab /></TabsContent>
            <TabsContent value="forecast" className="m-0 focus-visible:outline-none"><ChartForecastTab /></TabsContent>
            <TabsContent value="ai" className="m-0 focus-visible:outline-none"><AiAssistantTab /></TabsContent>
            <TabsContent value="s2f" className="m-0 focus-visible:outline-none"><StockToFlowTab /></TabsContent>
            <TabsContent value="mempool" className="m-0 focus-visible:outline-none"><MempoolTab /></TabsContent>
            <TabsContent value="search" className="m-0 focus-visible:outline-none"><WalletSearchTab /></TabsContent>
            <TabsContent value="create" className="m-0 focus-visible:outline-none"><WalletCreateTab /></TabsContent>
            <TabsContent value="open" className="m-0 focus-visible:outline-none"><WalletOpenTab /></TabsContent>
            <TabsContent value="lightning" className="m-0 focus-visible:outline-none"><LightningTab /></TabsContent>
            <TabsContent value="assets" className="m-0 focus-visible:outline-none"><OnchainAssetsTab /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
