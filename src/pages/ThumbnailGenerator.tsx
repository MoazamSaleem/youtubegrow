import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Image, Sparkles, Download, Loader2, Lock, Wand2, Menu } from "lucide-react";
import { getPlanLimits, canAccessFeature } from "@/lib/planLimits";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionPlan = Database["public"]["Enums"]["subscription_plan"];

interface GeneratedThumbnail {
  imageUrl: string;
  topic: string;
  style: string;
  createdAt: Date;
}

const ThumbnailGenerator = () => {
  const { user, loading, subscription } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("vibrant");
  const [channelNiche, setChannelNiche] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<GeneratedThumbnail[]>([]);
  const [dailyUsage, setDailyUsage] = useState(0);
  
  const userPlan: SubscriptionPlan = subscription?.plan || "free";

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUsageData();
    }
  }, [user]);

  const fetchUsageData = async () => {
    if (!user) return;

    // Fetch today's usage
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("thumbnails_generated")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (usage) {
      setDailyUsage(usage.thumbnails_generated || 0);
    }
  };

  const planLimits = getPlanLimits(userPlan);
  const canGenerate = canAccessFeature(userPlan, "thumbnailsPerDay");
  const dailyLimit = planLimits.thumbnailsPerDay;
  const isUnlimited = dailyLimit === -1;
  const hasReachedLimit = !isUnlimited && dailyUsage >= dailyLimit;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a video topic to generate a thumbnail.",
        variant: "destructive",
      });
      return;
    }

    if (!canGenerate) {
      toast({
        title: "Upgrade required",
        description: "Thumbnail generation is available on Pro and Advanced plans.",
        variant: "destructive",
      });
      return;
    }

    if (hasReachedLimit) {
      toast({
        title: "Daily limit reached",
        description: `You've reached your daily limit of ${dailyLimit} thumbnails. Upgrade to Advanced for unlimited.`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-thumbnail", {
        body: { topic, style, channelNiche },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const newThumbnail: GeneratedThumbnail = {
        imageUrl: data.imageUrl,
        topic,
        style,
        createdAt: new Date(),
      };

      setGeneratedThumbnails((prev) => [newThumbnail, ...prev]);
      setDailyUsage((prev) => prev + 1);

      toast({
        title: "Thumbnail generated!",
        description: "Your YouTube thumbnail has been created successfully.",
      });
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate thumbnail",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadThumbnail = (imageUrl: string, topic: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `thumbnail-${topic.slice(0, 30).replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "ml-0"}`}>
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
                  <Image className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-display text-lg sm:text-xl font-bold">Thumbnail Generator</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                    Create eye-catching YouTube thumbnails with AI
                  </p>
                </div>
              </div>
            </div>
            {canGenerate && (
              <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
                {isUnlimited ? (
                  <span className="text-primary font-medium">Unlimited</span>
                ) : (
                  <>
                    <span className="font-medium text-foreground">{dailyUsage}</span>
                    <span className="hidden sm:inline"> / {dailyLimit} today</span>
                    <span className="sm:hidden">/{dailyLimit}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {!canGenerate ? (
              <Card className="border-dashed max-w-2xl mx-auto">
                <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-center">Upgrade to Unlock</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6 px-4">
                    Thumbnail generation is available on Pro (5/day) and Advanced (unlimited) plans.
                  </p>
                  <Button onClick={() => navigate("/dashboard/billing")}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrade Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Generator Form */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5" />
                      Generate Thumbnail
                    </CardTitle>
                    <CardDescription>
                      Describe your video topic and we'll create the perfect thumbnail
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="topic">Video Topic *</Label>
                      <Input
                        id="topic"
                        placeholder="e.g., How to make $10k/month passive income"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="style">Thumbnail Style</Label>
                      <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vibrant">Vibrant & Eye-catching</SelectItem>
                          <SelectItem value="dramatic">Dramatic & Cinematic</SelectItem>
                          <SelectItem value="minimal">Clean & Minimal</SelectItem>
                          <SelectItem value="professional">Professional & Polished</SelectItem>
                          <SelectItem value="playful">Fun & Playful</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="niche">Channel Niche (optional)</Label>
                      <Input
                        id="niche"
                        placeholder="e.g., Tech, Gaming, Finance"
                        value={channelNiche}
                        onChange={(e) => setChannelNiche(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleGenerate}
                      disabled={isGenerating || hasReachedLimit || !topic.trim()}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Thumbnail
                        </>
                      )}
                    </Button>

                    {hasReachedLimit && (
                      <p className="text-sm text-destructive text-center">
                        Daily limit reached. Upgrade for more.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Generated Thumbnails */}
                <div className="lg:col-span-2">
                  <h2 className="text-xl font-semibold mb-4">Generated Thumbnails</h2>
                  
                  {generatedThumbnails.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                        <Image className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-center">
                          Your generated thumbnails will appear here
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {generatedThumbnails.map((thumbnail, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Card className="overflow-hidden group">
                            <div className="relative aspect-video">
                              <img
                                src={thumbnail.imageUrl}
                                alt={thumbnail.topic}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => downloadThumbnail(thumbnail.imageUrl, thumbnail.topic)}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </Button>
                              </div>
                            </div>
                            <CardContent className="p-3">
                              <p className="text-sm font-medium truncate">{thumbnail.topic}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {thumbnail.style} style
                              </p>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default ThumbnailGenerator;
