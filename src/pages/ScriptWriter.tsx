import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getPlanLimits, canAccessFeature } from "@/lib/planLimits";
import {
  FileText,
  Menu,
  Loader2,
  Clock,
  Lightbulb,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
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
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

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

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
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

    setIsGenerating(true);
    setScript(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate script");
      }

      const data = await response.json();
      setScript(data.script);
      setExpandedSections(new Set([0]));

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

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const copyFullScript = async () => {
    if (!script) return;

    const fullText = `
# ${script.title}

## Hook
${script.hook}

## Introduction
${script.introduction}

${script.sections.map((s) => `## [${s.timestamp}] ${s.title}\n${s.content}\n${s.notes ? `\n*Notes: ${s.notes}*` : ""}`).join("\n\n")}

## Conclusion
${script.conclusion}

## Call to Action
${script.callToAction}

---
Estimated Duration: ${script.estimatedDuration}
Tips: ${script.tips.join(", ")}
    `.trim();

    await navigator.clipboard.writeText(fullText);
    setCopiedSection("full");
    setTimeout(() => setCopiedSection(null), 2000);
    toast({ title: "Full script copied!" });
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
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
      <DashboardSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "ml-0"}`}>
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
              className="max-w-2xl mx-auto text-center py-16"
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
                    disabled={isGenerating || !formData.topic.trim()}
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
                    <div className="p-6 space-y-6">
                      {/* Header */}
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

                      {/* Hook */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-primary uppercase tracking-wider">
                            Hook (First 10 Seconds)
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(script.hook, "hook")}
                          >
                            {copiedSection === "hook" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-foreground font-medium">{script.hook}</p>
                      </div>

                      {/* Introduction */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Introduction</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(script.introduction, "intro")}
                          >
                            {copiedSection === "intro" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-sm">{script.introduction}</p>
                      </div>

                      {/* Sections */}
                      <div className="space-y-3">
                        <span className="text-sm font-medium text-muted-foreground">Main Content</span>
                        {script.sections.map((section, index) => (
                          <div key={index} className="glass rounded-xl overflow-hidden">
                            <button
                              onClick={() => toggleSection(index)}
                              className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                                  {section.timestamp}
                                </span>
                                <span className="font-medium">{section.title}</span>
                              </div>
                              {expandedSections.has(index) ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <AnimatePresence>
                              {expandedSections.has(index) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-border"
                                >
                                  <div className="p-4 space-y-3">
                                    <p className="text-sm whitespace-pre-wrap">{section.content}</p>
                                    {section.notes && (
                                      <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                                        <Lightbulb className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground">{section.notes}</p>
                                      </div>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(section.content, `section-${index}`)}
                                    >
                                      {copiedSection === `section-${index}` ? (
                                        <Check className="h-4 w-4 mr-2" />
                                      ) : (
                                        <Copy className="h-4 w-4 mr-2" />
                                      )}
                                      Copy Section
                                    </Button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>

                      {/* Conclusion */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Conclusion</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(script.conclusion, "conclusion")}
                          >
                            {copiedSection === "conclusion" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-sm">{script.conclusion}</p>
                      </div>

                      {/* CTA */}
                      <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-accent uppercase tracking-wider">
                            Call to Action
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(script.callToAction, "cta")}
                          >
                            {copiedSection === "cta" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-foreground">{script.callToAction}</p>
                      </div>

                      {/* Tips */}
                      {script.tips.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Pro Tips</span>
                          <div className="flex flex-wrap gap-2">
                            {script.tips.map((tip, index) => (
                              <span
                                key={index}
                                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-muted-foreground"
                              >
                                💡 {tip}
                              </span>
                            ))}
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
