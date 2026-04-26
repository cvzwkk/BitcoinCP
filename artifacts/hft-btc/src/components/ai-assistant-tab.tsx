import { useState, useRef, useEffect } from "react";
import { useGetAiInsights, useAiChat, useUpdatePaperConfig, getGetSnapshotQueryKey, getGetAiInsightsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Sparkles, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export function AiAssistantTab() {
  const { data: insights } = useGetAiInsights({ query: { refetchInterval: 5000, queryKey: getGetAiInsightsQueryKey() } });
  const chatMutation = useAiChat();
  const updateConfig = useUpdatePaperConfig();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "I'm analyzing the high-frequency microprice drift and order book imbalances. How can I help adjust the strategy?" }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);

    chatMutation.mutate({ data: { message: userMsg } }, {
      onSuccess: (data) => {
        setMessages(prev => [...prev, { role: "ai", text: data.reply }]);
        // data.appliedAdjustments could be used here if needed
      }
    });
  };

  const handleApplySuggestions = () => {
    if (!insights) return;
    updateConfig.mutate({
      data: {
        entrySize: insights.recommendedEntrySize,
        minConfidence: insights.recommendedMinConfidence,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSnapshotQueryKey() });
      }
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-12 h-[600px]">
      <Card className="col-span-full md:col-span-8 bg-card/50 flex flex-col h-full border-border/50">
        <CardHeader className="py-4 border-b border-border/50">
          <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" /> Strategy Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`rounded-xl p-3 text-sm max-w-[80%] ${m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm text-foreground"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex gap-3 flex-row">
                <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="rounded-xl p-3 bg-muted rounded-tl-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-3 border-t border-border/50 bg-background/50">
          <form onSubmit={handleSend} className="flex w-full gap-2">
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Ask about market conditions..." 
              className="flex-1 bg-background/50"
              disabled={chatMutation.isPending}
            />
            <Button type="submit" disabled={chatMutation.isPending || !input.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>

      <Card className="col-span-full md:col-span-4 bg-card/50 border-border/50 flex flex-col">
        <CardHeader className="py-4 border-b border-border/50">
          <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-4 space-y-6">
          {insights ? (
            <>
              <div className="space-y-2">
                <div className="text-xs uppercase text-muted-foreground font-medium tracking-wider">Analysis Notes</div>
                <ul className="space-y-2">
                  {insights.notes.map((note, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 bg-muted/50 p-4 rounded-lg border border-border/50">
                <div className="text-xs uppercase text-muted-foreground font-medium tracking-wider">Recommendations</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Min Conf</div>
                    <div className="font-mono font-bold">{(insights.recommendedMinConfidence * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Size</div>
                    <div className="font-mono font-bold">${insights.recommendedEntrySize.toFixed(2)}</div>
                  </div>
                </div>
                <Button 
                  className="w-full mt-2 font-mono text-xs uppercase" 
                  size="sm"
                  onClick={handleApplySuggestions}
                  disabled={updateConfig.isPending}
                >
                  {updateConfig.isPending ? "Applying..." : <><Check className="w-3 h-3 mr-1" /> Apply Config</>}
                </Button>
              </div>

              <div className="text-[10px] font-mono text-muted-foreground text-center">
                Last updated: {format(insights.updatedAt, "HH:mm:ss")}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
              Waiting for insights...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
