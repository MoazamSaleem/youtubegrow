import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LIMITS } from "@/lib/planLimits";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Menu,
  Lightbulb,
  TrendingUp,
  Target,
  Youtube,
  Coins,
  AlertCircle,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UserCredits {
  ai_credits_balance: number;
  ai_credits_used: number;
}

const CREDIT_COSTS = {
  basic: 20,
  standard: 50,
  extensive: 100,
};

const AIChat = () => {
  const { user, profile, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userCredits, setUserCredits] = useState<UserCredits>({ ai_credits_balance: 0, ai_credits_used: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentPlan = subscription?.plan || "free";
  const planLimits = PLAN_LIMITS[currentPlan];

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUserCredits();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUserCredits = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_tokens")
      .select("ai_credits_balance, ai_credits_used")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setUserCredits(data);
    } else {
      // Initialize user tokens with plan credits
      const { data: newData } = await supabase
        .from("user_tokens")
        .insert({
          user_id: user.id,
          ai_credits_balance: planLimits.aiStrategistCredits,
        })
        .select("ai_credits_balance, ai_credits_used")
        .single();
      if (newData) setUserCredits(newData);
    }
  };

  const estimateQueryComplexity = (query: string): "basic" | "standard" | "extensive" => {
    const wordCount = query.split(/\s+/).length;
    const hasAnalysis = /analyz|research|compare|strateg|plan|comprehensive|detail/i.test(query);
    const hasMultiple = /multiple|several|all|complete|full/i.test(query);

    if (wordCount > 50 || (hasAnalysis && hasMultiple)) {
      return "extensive";
    } else if (wordCount > 20 || hasAnalysis) {
      return "standard";
    }
    return "basic";
  };

  const deductCredits = async (complexity: "basic" | "standard" | "extensive") => {
    if (!user) return false;

    const cost = CREDIT_COSTS[complexity];
    if (userCredits.ai_credits_balance < cost) {
      toast({
        title: "Insufficient credits",
        description: `You need ${cost} credits for this query. Current balance: ${userCredits.ai_credits_balance}`,
        variant: "destructive",
      });
      return false;
    }

    const newBalance = userCredits.ai_credits_balance - cost;
    const newUsed = userCredits.ai_credits_used + cost;

    // Update user tokens
    await supabase
      .from("user_tokens")
      .update({
        ai_credits_balance: newBalance,
        ai_credits_used: newUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // Log usage
    await supabase.from("ai_credits_usage").insert({
      user_id: user.id,
      credits_used: cost,
      query_type: "ai_chat",
      query_complexity: complexity,
    });

    setUserCredits({ ai_credits_balance: newBalance, ai_credits_used: newUsed });
    return true;
  };

  const quickPrompts = [
    { icon: Lightbulb, text: "Give me 5 viral video ideas for my niche" },
    { icon: TrendingUp, text: "How can I improve my video retention?" },
    { icon: Target, text: "What's the best posting schedule for growth?" },
    { icon: Youtube, text: "How do I optimize my channel for the algorithm?" },
  ];

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    // Estimate complexity and check credits
    const complexity = estimateQueryComplexity(input);
    const cost = CREDIT_COSTS[complexity];

    if (planLimits.aiStrategistCredits > 0 && userCredits.ai_credits_balance < cost) {
      toast({
        title: "Insufficient AI credits",
        description: `This query requires ${cost} credits. Upgrade your plan or complete tasks to earn more.`,
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      // Deduct credits if plan has credits
      if (planLimits.aiStrategistCredits > 0) {
        const success = await deductCredits(complexity);
        if (!success) {
          setIsStreaming(false);
          return;
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            channelContext: {
              channelName: profile?.full_name,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const creditsPercentage = planLimits.aiStrategistCredits > 0 
    ? (userCredits.ai_credits_balance / planLimits.aiStrategistCredits) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "ml-0"} flex flex-col h-screen`}>
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b border-border px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
                  <MessageSquare className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold">AI YouTube Strategist</h1>
                  <p className="text-sm text-muted-foreground">Your personal growth advisor</p>
                </div>
              </div>
            </div>

            {/* Credits Display */}
            {planLimits.aiStrategistCredits > 0 && (
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm sm:text-base">{userCredits.ai_credits_balance}</span>
                    <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">/ {planLimits.aiStrategistCredits}</span>
                  </div>
                  <Progress value={creditsPercentage} className="h-1.5 w-20 sm:w-32" />
                </div>
                <Badge variant="outline" className="gap-1 hidden sm:flex">
                  <Coins className="h-3 w-3" />
                  Credits
                </Badge>
              </div>
            )}
          </div>
        </header>

        {/* Credits Warning */}
        {planLimits.aiStrategistCredits > 0 && userCredits.ai_credits_balance < 100 && (
          <div className="px-4 lg:px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-600 dark:text-yellow-400">
              Low credits! Complete growth tasks or upgrade to earn more AI credits.
            </span>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
              <div className="text-center max-w-2xl mx-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex p-6 rounded-3xl glass mb-8"
                >
                  <Sparkles className="h-16 w-16 text-primary" />
                </motion.div>
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="font-display text-2xl lg:text-3xl font-bold mb-4"
                >
                  How can I help grow your channel?
                </motion.h2>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-muted-foreground mb-4"
                >
                  Ask me anything about YouTube strategy, content ideas, SEO, thumbnails, or audience growth.
                </motion.p>

                {/* Credit Cost Info */}
                {planLimits.aiStrategistCredits > 0 && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="flex justify-center gap-4 mb-8 text-sm"
                  >
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="bg-green-500/10 text-green-500">20</Badge>
                      <span className="text-muted-foreground">Basic</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">50</Badge>
                      <span className="text-muted-foreground">Standard</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="bg-red-500/10 text-red-500">100</Badge>
                      <span className="text-muted-foreground">Extensive</span>
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {quickPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickPrompt(prompt.text)}
                      className="flex items-center gap-3 p-4 rounded-xl glass hover:bg-secondary/50 transition-all text-left group"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <prompt.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {prompt.text}
                      </span>
                    </button>
                  ))}
                </motion.div>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4 lg:p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0 p-2 rounded-xl bg-gradient-to-br from-primary to-accent h-fit">
                          <Bot className="h-5 w-5 text-primary-foreground" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] p-4 rounded-2xl ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "glass"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                          {message.role === "assistant" && isStreaming && index === messages.length - 1 && (
                            <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                          )}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <div className="flex-shrink-0 p-2 rounded-xl bg-secondary h-fit">
                          <User className="h-5 w-5 text-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}

          {/* Input Area */}
          <div className="border-t border-border p-4 glass-strong">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Ask about YouTube growth strategies..."
                  disabled={isStreaming}
                  className="flex-1 h-12 text-base"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  className="h-12 w-12 shrink-0"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  AI responses are for guidance. Always verify advice before implementation.
                </p>
                {planLimits.aiStrategistCredits > 0 && input && (
                  <Badge variant="outline" className="text-xs">
                    ~{CREDIT_COSTS[estimateQueryComplexity(input)]} credits
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIChat;
