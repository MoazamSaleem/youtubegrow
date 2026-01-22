import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { canAccessFeature } from "@/lib/planLimits";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Menu,
  Loader2,
  Clock,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScriptSection {
  timestamp: string;
  title: string;
  content: string;
  notes?: string;
}

interface GeneratedScript {
  title: string;
  hook: string;
  introduction: string;
  sections: ScriptSection[];
  conclusion: string;
  callToAction: string;
  estimatedDuration: string;
  tips: string[];
}

const ScriptWriter = () => {
  const { user, subscription, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const autoGenerateRef = useRef(false);

  const [formData, setFormData] = useState({
    topic: "",
    targetAudience: "",
    tone: "engaging",
    duration: "8-10",
    includeHook: true,
    includeCTA: true,
  });

  const currentPlan = subscription?.plan || "free";
  const hasAccess = canAccessFeature(currentPlan, "hasScriptWriter");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const key = `script_writer_generated:${user.id}`;
    const cached = localStorage.getItem(key);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as {
        script?: GeneratedScript;
        formData?: typeof formData;
      };
      if (parsed.formData) {
        setFormData((prev) => ({ ...prev, ...parsed.formData }));
      }
      if (parsed.script) {
        setScript(parsed.script);
      }
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Failed to load generated script:", error);
    }
  }, [user]);

  useEffect(() => {
    const topicParam = searchParams.get("topic");
    const auto = searchParams.get("auto");
    if (!topicParam || auto !== "1") return;
    if (autoGenerateRef.current) return;
    autoGenerateRef.current = true;
    const decoded = decodeURIComponent(topicParam);
    handleGenerate(decoded);
    navigate("/dashboard/scripts", { replace: true });
  }, [searchParams, navigate]);

  const handleGenerate = async (topicOverride?: string) => {
    const topicValue = String(topicOverride ?? formData.topic ?? "");
    if (!topicValue.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a video topic",
        variant: "destructive",
      });
      return;
    }

    if (!hasAccess) {
      toast({
        title: "Upgrade Required",
        description: "Script Writer is available on Pro and Advanced plans",
        variant: "destructive",
      });
      return;
    }

    if (topicOverride) {
      setFormData((prev) => ({ ...prev, topic: topicValue }));
    }
    setIsGenerating(true);
    setScript(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...formData, topic: topicValue }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate script");
      }

      const data = await response.json();
      setScript(data.script);

      toast({
        title: "Script Generated!",
        description: "Your video script is ready",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate script",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyFullScript = async () => {
    if (!script) return;

    const fullText = buildDocumentedScript(script);

    await navigator.clipboard.writeText(fullText);
    setCopiedSection("full");
    setTimeout(() => setCopiedSection(null), 2000);
    toast({ title: "Full script copied!" });
  };

  const buildDocumentedScript = (data: GeneratedScript) => {
    const sections = (data.sections || [])
      .map((section) => {
        const timestamp = section.timestamp ? ` [${section.timestamp}]` : "";
        const notes = section.notes ? `\nNotes: ${section.notes}` : "";
        return `## ${section.title}${timestamp}\n${section.content}${notes}`;
      })
      .join("\n\n");

    const tips = (data.tips || []).length > 0 ? `\nTips: ${(data.tips || []).join(", ")}` : "";

    return `
# ${data.title}

## Main Content
${sections || data.hook || data.introduction || data.conclusion || data.callToAction
      ? sections || [data.hook, data.introduction, data.conclusion, data.callToAction].filter(Boolean).join("\n\n")
      : ""}

---
Estimated Duration: ${data.estimatedDuration}${tips}
    `.trim();
  };

  const getDocumentedBlocks = (data: GeneratedScript) => {
    const blocks: Array<{ title: string; subtitle?: string; content: string }> = [];
    (data.sections || []).forEach((section) => {
      blocks.push({
        title: section.title || "Main Section",
        subtitle: section.timestamp || undefined,
        content: section.content || "",
      });
    });
    if (blocks.length === 0) {
      const fallback = [data.hook, data.introduction, data.conclusion, data.callToAction]
        .filter(Boolean)
        .join("\n\n");
      if (fallback) {
        blocks.push({ title: "Full Script", content: fallback });
      }
    }
    return blocks;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 transition-all duration-300">
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b border-border px-4 lg:px-6 py-4">
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
              <div className="p-2 rounded-xl bg-gradient-to-br from-warning to-destructive">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold">AI Script Writer</h1>
                <p className="text-sm text-muted-foreground">Generate engaging video scripts</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          {!hasAccess ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full text-center py-16"
            >
              <div className="inline-flex p-6 rounded-3xl glass mb-8">
                <FileText className="h-16 w-16 text-warning" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-4">
                Unlock AI Script Writer
              </h2>
              <p className="text-muted-foreground mb-8">
                Generate professional video scripts with AI. Available on Pro and Advanced plans.
              </p>
              <Button variant="hero" onClick={() => navigate("/dashboard/billing")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            </motion.div>
          ) : (
            <div className="grid lg:grid-cols-[400px,1fr] gap-8">
              {/* Input Form */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="glass rounded-2xl p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="topic">Video Topic *</Label>
                    <Textarea
                      id="topic"
                      placeholder="E.g., How to start a successful YouTube channel in 2025"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audience">Target Audience</Label>
                    <Input
                      id="audience"
                      placeholder="E.g., Beginner content creators aged 18-35"
                      value={formData.targetAudience}
                      onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tone</Label>
                      <Select
                        value={formData.tone}
                        onValueChange={(value) => setFormData({ ...formData, tone: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engaging">Engaging</SelectItem>
                          <SelectItem value="educational">Educational</SelectItem>
                          <SelectItem value="entertaining">Entertaining</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Duration (mins)</Label>
                      <Select
                        value={formData.duration}
                        onValueChange={(value) => setFormData({ ...formData, duration: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3-5">3-5 mins</SelectItem>
                          <SelectItem value="5-8">5-8 mins</SelectItem>
                          <SelectItem value="8-10">8-10 mins</SelectItem>
                          <SelectItem value="10-15">10-15 mins</SelectItem>
                          <SelectItem value="15-20">15-20 mins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hook">Include Strong Hook</Label>
                      <Switch
                        id="hook"
                        checked={formData.includeHook}
                        onCheckedChange={(checked) => setFormData({ ...formData, includeHook: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cta">Include Call to Action</Label>
                      <Switch
                        id="cta"
                        checked={formData.includeCTA}
                        onCheckedChange={(checked) => setFormData({ ...formData, includeCTA: checked })}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !String(formData.topic ?? "").trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Script...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Script
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>

              {/* Script Output */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass rounded-2xl overflow-hidden"
              >
                {!script && !isGenerating ? (
                  <div className="flex items-center justify-center h-[600px] text-center p-8">
                    <div>
                      <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Your generated script will appear here
                      </p>
                    </div>
                  </div>
                ) : isGenerating ? (
                  <div className="flex items-center justify-center h-[600px]">
                    <div className="text-center">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">Crafting your script...</p>
                    </div>
                  </div>
                ) : script ? (
                  <ScrollArea className="h-[600px]">
                    <div className="p-6 space-y-6">                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-display text-2xl font-bold mb-2">{script.title}</h2>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {script.estimatedDuration}
                            </span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={copyFullScript}>
                          {copiedSection === "full" ? (
                            <Check className="h-4 w-4 mr-2" />
                          ) : (
                            <Copy className="h-4 w-4 mr-2" />
                          )}
                          Copy All
                        </Button>
                      </div>
                      <div className="space-y-6">
                        <h3 className="font-display text-lg font-semibold">Main Content</h3>
                        {getDocumentedBlocks(script).map((block, index) => (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-base">{block.title}</h4>
                              {block.subtitle ? (
                                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                                  {block.subtitle}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm whitespace-pre-wrap text-foreground">
                              {block.content}
                            </p>
                          </div>
                        ))}
                      </div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : null}
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ScriptWriter;



