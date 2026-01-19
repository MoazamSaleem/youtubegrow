import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_LIMITS, getPlanDisplayName, SubscriptionPlan } from "@/lib/planLimits";
import { supabase } from "@/integrations/supabase/client";
import { UpgradeModal } from "./UpgradeModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Youtube,
  Sparkles,
  BarChart3,
  Search,
  Lightbulb,
  Users,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Brain,
  Crown,
  Lock,
  FileText,
  Image,
  Target,
  Shield,
  User,
  Coins,
  ArrowUpRight,
} from "lucide-react";

interface NavItem {
  name: string;
  icon: React.ElementType;
  href: string;
  locked?: boolean;
  requiredPlan?: SubscriptionPlan[];
  description?: string;
}

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function DashboardSidebar({ sidebarOpen, setSidebarOpen }: DashboardSidebarProps) {
  const { user, profile, subscription, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPlan = (subscription?.plan || "free") as SubscriptionPlan;
  const [aiCredits, setAiCredits] = useState<number>(0);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string>("");
  const [requiredPlanForFeature, setRequiredPlanForFeature] = useState<SubscriptionPlan>("basic");

  // Fetch AI credits balance
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("user_tokens")
        .select("ai_credits_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setAiCredits(data.ai_credits_balance || 0);
      }
    };

    fetchCredits();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('user_tokens_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_tokens',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload: any) => {
          if (payload.new?.ai_credits_balance !== undefined) {
            setAiCredits(payload.new.ai_credits_balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const navigation: NavItem[] = [
    { name: "Overview", icon: BarChart3, href: "/dashboard", description: "Your channel dashboard" },
    { name: "Channel Analysis", icon: Brain, href: "/dashboard/analysis", requiredPlan: ["basic", "pro", "advanced"], description: "AI-powered channel insights" },
    { name: "Keywords", icon: Search, href: "/dashboard/keywords", description: "Research trending keywords" },
    { name: "Topic Ideas", icon: Lightbulb, href: "/dashboard/topics", description: "Get video topic suggestions" },
    { name: "Script Writer", icon: FileText, href: "/dashboard/scripts", requiredPlan: ["pro", "advanced"], description: "AI-generated video scripts" },
    { name: "Thumbnails", icon: Image, href: "/dashboard/thumbnails", requiredPlan: ["pro", "advanced"], description: "Generate eye-catching thumbnails" },
    { name: "Competitors", icon: Users, href: "/dashboard/competitors", requiredPlan: ["basic", "pro", "advanced"], description: "Analyze competitor channels" },
    { name: "Growth Tasks", icon: Target, href: "/dashboard/growth", requiredPlan: ["basic", "pro", "advanced"], description: "Track your growth journey" },
    { name: "AI Credits", icon: Sparkles, href: "/dashboard/credits", description: "Manage your AI credits" },
    { name: "Leaderboard", icon: Crown, href: "/dashboard/leaderboard", description: "See top creators" },
    { name: "Profile", icon: User, href: "/dashboard/profile", description: "Your account settings" },
    { name: "AI Chat", icon: MessageSquare, href: "/dashboard/chat", description: "Chat with AI strategist" },
  ];

  const isLocked = (item: NavItem): boolean => {
    if (!item.requiredPlan) return false;
    return !item.requiredPlan.includes(currentPlan);
  };

  const getMinRequiredPlan = (item: NavItem): SubscriptionPlan => {
    if (!item.requiredPlan || item.requiredPlan.length === 0) return "free";
    const planOrder: SubscriptionPlan[] = ["free", "basic", "pro", "advanced"];
    let minPlan: SubscriptionPlan = "advanced";
    for (const plan of item.requiredPlan) {
      if (planOrder.indexOf(plan) < planOrder.indexOf(minPlan)) {
        minPlan = plan;
      }
    }
    return minPlan;
  };

  const handleLockedClick = (item: NavItem) => {
    setSelectedFeature(item.name);
    setRequiredPlanForFeature(getMinRequiredPlan(item));
    setUpgradeModalOpen(true);
  };

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  const planLimits = PLAN_LIMITS[currentPlan];

  return (
    <>
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass rounded-lg"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={`fixed lg:sticky lg:top-0 h-svh inset-y-0 left-0 z-50 w-64 glass-strong border-r border-border transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-20"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <Link to="/" className="flex items-center gap-2">
              <div className="relative">
                <Youtube className="h-8 w-8 text-primary" />
                <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
              </div>
              {sidebarOpen && (
                <span className="font-display font-bold text-lg">
                  Tube<span className="gradient-text">Grow</span>
                </span>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto sidebar-scroll">
            <TooltipProvider>
              {navigation.map((item) => {
                const locked = isLocked(item);
                const active = isActive(item.href);
                const minPlan = getMinRequiredPlan(item);
                
                const navContent = (
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    } ${locked ? "opacity-60 cursor-pointer hover:opacity-80" : ""}`}
                    onClick={locked ? () => handleLockedClick(item) : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="font-medium flex-1">{item.name}</span>
                        {locked && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-warning hidden group-hover:inline">
                              {getPlanDisplayName(minPlan)}+
                            </span>
                            <Lock className="h-4 w-4 text-warning" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );

                if (locked) {
                  return (
                    <Tooltip key={item.name} delayDuration={300}>
                      <TooltipTrigger asChild>
                        {navContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <div className="space-y-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          <div className="flex items-center gap-1 pt-1 text-warning">
                            <Lock className="h-3 w-3" />
                            <span className="text-xs">Requires {getPlanDisplayName(minPlan)} plan</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Link key={item.name} to={item.href}>
                    {navContent}
                  </Link>
                );
              })}
            </TooltipProvider>

            {/* Admin Link */}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  location.pathname.startsWith("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Shield className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span className="font-medium">Admin Panel</span>}
              </Link>
            )}
          </nav>

          {/* AI Credits Display */}
          {sidebarOpen && (
            <div className="px-4 pb-2">
              <Link 
                to="/dashboard/credits"
                className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Coins className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">AI Credits</p>
                  <p className="font-bold text-lg leading-tight">
                    {aiCredits.toLocaleString()}
                  </p>
                </div>
                <Sparkles className="h-4 w-4 text-primary" />
              </Link>
            </div>
          )}

          {/* Upgrade Banner */}
          {sidebarOpen && currentPlan !== "advanced" && (
            <div className="p-4 border-t border-border">
              <div className="glass rounded-xl p-4 bg-gradient-to-br from-primary/10 to-accent/10">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-warning" />
                  <span className="font-semibold text-sm">Upgrade Plan</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {currentPlan === "free" 
                    ? "Unlock AI analysis, competitors & more"
                    : currentPlan === "basic"
                      ? "Get Script Writer, Thumbnails & AI Chat"
                      : "Go unlimited with Advanced plan"}
                </p>
                <div className="text-xs text-muted-foreground mb-3">
                  <span className="font-medium text-foreground">
                    {currentPlan === "free" ? "From $7/mo" : currentPlan === "basic" ? "From $15/mo" : "$25/mo"}
                  </span>
                </div>
                <Button 
                  variant="premium" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    setSelectedFeature("");
                    setUpgradeModalOpen(true);
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  See What You'll Unlock
                </Button>
              </div>
            </div>
          )}

          {/* User */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="font-semibold text-primary-foreground">
                  {profile?.full_name?.charAt(0) || "U"}
                </span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {profile?.full_name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {getPlanDisplayName(currentPlan)} Plan
                  </p>
                </div>
              )}
              <button
                onClick={async () => {
                  await signOut();
                  navigate("/signin");
                }}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        currentPlan={currentPlan}
        targetFeature={selectedFeature}
        requiredPlan={requiredPlanForFeature}
      />
    </>
  );
}
