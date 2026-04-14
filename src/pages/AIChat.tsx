import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionRequiredState } from "@/components/dashboard/SubscriptionRequiredState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LIMITS } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
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

type DocumentationBlock =
  | { type: "paragraph"; content: string }
  | { type: "heading"; content: string; level: number }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; content: string };

const CREDIT_COSTS = {
  basic: 20,
  standard: 50,
  extensive: 100,
};

const parseInlineDocumentation = (text: string) => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-[0.8em] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
};

const parseDocumentationBlocks = (content: string): DocumentationBlock[] => {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: DocumentationBlock[] = [];
  let paragraphBuffer: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({
      type: "paragraph",
      content: paragraphBuffer.join(" "),
    });
    paragraphBuffer = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: "code",
        content: codeLines.join("\n"),
      });
      continue;
    }

    const markdownHeadingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (markdownHeadingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: markdownHeadingMatch[1].length,
        content: markdownHeadingMatch[2],
      });
      index += 1;
      continue;
    }

    const boldHeadingMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (boldHeadingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: 3,
        content: boldHeadingMatch[1],
      });
      index += 1;
      continue;
    }

    const unorderedItems: string[] = [];
    while (index < lines.length) {
      const unorderedMatch = lines[index].trim().match(/^[-*]\s+(.+)$/);
      if (!unorderedMatch) break;
      unorderedItems.push(unorderedMatch[1]);
      index += 1;
    }
    if (unorderedItems.length) {
      flushParagraph();
      blocks.push({ type: "unordered-list", items: unorderedItems });
      continue;
    }

    const orderedItems: string[] = [];
    while (index < lines.length) {
      const orderedMatch = lines[index].trim().match(/^\d+\.\s+(.+)$/);
      if (!orderedMatch) break;
      orderedItems.push(orderedMatch[1]);
      index += 1;
    }
    if (orderedItems.length) {
      flushParagraph();
      blocks.push({ type: "ordered-list", items: orderedItems });
      continue;
    }

    paragraphBuffer.push(trimmed);
    index += 1;
  }

  flushParagraph();

  return blocks;
};

const AssistantDocumentation = ({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) => {
  const blocks = parseDocumentationBlocks(content);

  return (
    <div className="space-y-4 text-sm leading-7 text-foreground/90">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const headingClass =
            block.level <= 2
              ? "font-display text-base font-semibold tracking-tight text-foreground"
              : "font-display text-sm font-semibold tracking-wide text-foreground";

          return (
            <h3 key={index} className={headingClass}>
              {parseInlineDocumentation(block.content)}
            </h3>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul
              key={index}
              className="space-y-2 pl-5 text-muted-foreground marker:text-primary"
              style={{ listStyleType: "disc" }}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{parseInlineDocumentation(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol
              key={index}
              className="space-y-2 pl-5 text-muted-foreground marker:text-primary"
              style={{ listStyleType: "decimal" }}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{parseInlineDocumentation(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-xl border border-border/70 bg-background/80 p-4 text-xs leading-6 text-primary"
            >
              <code>{block.content}</code>
            </pre>
          );
        }

        return (
          <p key={index} className="text-muted-foreground">
            {parseInlineDocumentation(block.content)}
          </p>
        );
      })}

      {isStreaming && (
        <span className="inline-block h-4 w-2 rounded-sm bg-primary align-middle animate-pulse" />
      )}
    </div>
  );
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

  const currentPlan = getActiveSubscriptionPlan(subscription);
  const planLimits = currentPlan ? PLAN_LIMITS[currentPlan] : null;
  const hasAccess = currentPlan ? planLimits.hasYoutubeStrategist : false;

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

  const getSessionWithRefresh = async (forceRefresh = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000;
      if (!forceRefresh && !shouldRefresh) return session;
    }

    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) return refreshed.session;

    return session ?? null;
  };

  const parseErrorResponse = async (response: Response) => {
    const text = await response.text();
    if (!text) return response.statusText || "Request failed";

    try {
      const parsed = JSON.parse(text);
      return parsed?.error || parsed?.message || text;
    } catch {
      return text;
    }
  };

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.functions.invoke("init-user-tokens", {
          body: { reason: "ensure" },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const { data: refreshed } = await supabase
          .from("user_tokens")
          .select("ai_credits_balance, ai_credits_used")
          .eq("user_id", user.id)
          .maybeSingle();
        if (refreshed) setUserCredits(refreshed);
      }
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
      const session = await getSessionWithRefresh();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
        throw new Error(await parseErrorResponse(response));
      }

      const responseType = response.headers.get("content-type") || "";
      if (responseType.includes("application/json")) {
        const data = await response.json();
        const content = data?.content;
        if (!content || typeof content !== "string") {
          throw new Error("Empty AI response");
        }

        setMessages((prev) => [...prev, { role: "assistant", content }]);
        return;
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
      fetchUserCredits();
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

  if (!hasAccess || !planLimits) {
    return (
      <div className="min-h-screen bg-background flex">
        <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <SubscriptionRequiredState
            title={currentPlan ? "Upgrade to unlock AI Chat" : "Active subscription required"}
            description={
              currentPlan
                ? "AI YouTube Strategist is available on Pro and Advanced plans."
                : "AI YouTube Strategist is available on Pro and Advanced plans after you activate a paid subscription."
            }
          />
        </main>
      </div>
    );
  }

  const creditsPercentage = planLimits.aiStrategistCredits > 0 
    ? (userCredits.ai_credits_balance / planLimits.aiStrategistCredits) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 transition-all duration-300 flex flex-col h-screen">
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
              <div className="text-center w-full">
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
              <div className="w-full space-y-6">
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
                        className={`rounded-2xl ${
                          message.role === "user"
                            ? "max-w-[80%] bg-primary p-4 text-primary-foreground"
                            : "w-full max-w-4xl border border-border/70 bg-card/50 p-5 shadow-sm backdrop-blur-md"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <AssistantDocumentation
                            content={message.content}
                            isStreaming={isStreaming && index === messages.length - 1}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.content}
                          </p>
                        )}
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
            <div className="w-full">
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
