import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getPlanDisplayName, PLAN_ORDER, SubscriptionPlan } from "@/lib/planLimits";
import { getActiveSubscriptionPlan } from "@/lib/subscription";
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
  AudioLines,
  Film,
  Target,
  Shield,
  User,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const currentPlan = getActiveSubscriptionPlan(subscription);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string>("");
  const [requiredPlanForFeature, setRequiredPlanForFeature] = useState<SubscriptionPlan>("basic");
  const isTestUser = user?.email?.toLowerCase() === "moazamm.dev@gmail.com";
  const desktopInitRef = useRef(false);

  const navigation: NavItem[] = [
    { name: "Overview", icon: BarChart3, href: "/dashboard", requiredPlan: ["basic", "pro", "advanced"], description: "Your channel dashboard" },
    { name: "Channel Analysis", icon: Brain, href: "/dashboard/analysis", requiredPlan: ["basic", "pro", "advanced"], description: "AI-powered channel insights" },
    { name: "Keywords", icon: Search, href: "/dashboard/keywords", requiredPlan: ["basic", "pro", "advanced"], description: "Research trending keywords" },
    { name: "Topic Ideas", icon: Lightbulb, href: "/dashboard/topics", requiredPlan: ["basic", "pro", "advanced"], description: "Get video topic suggestions" },
    { name: "Script Writer", icon: FileText, href: "/dashboard/scripts", requiredPlan: ["pro", "advanced"], description: "AI-generated video scripts" },
    { name: "Text to Speech", icon: AudioLines, href: "/dashboard/text-to-speech", requiredPlan: ["pro", "advanced"], description: "Generate voiceovers with preset voices or voice clones" },
    { name: "Text to Video", icon: Film, href: "/dashboard/text-to-video", requiredPlan: ["basic", "pro", "advanced"], description: "Generate short videos from text prompts" },
    { name: "Thumbnails", icon: Image, href: "/dashboard/thumbnails", requiredPlan: ["pro", "advanced"], description: "Generate eye-catching thumbnails" },
    { name: "SEO Analyzer", icon: Search, href: "/dashboard/seo-analyzer", requiredPlan: ["basic", "pro", "advanced"], description: "Audit any YouTube video SEO" },
    { name: "Competitors", icon: Users, href: "/dashboard/competitors", requiredPlan: ["basic", "pro", "advanced"], description: "Analyze competitor channels" },
    { name: "Growth Tasks", icon: Target, href: "/dashboard/growth", requiredPlan: ["basic", "pro", "advanced"], description: "Track your growth journey" },
    { name: "AI Credits", icon: Sparkles, href: "/dashboard/credits", description: "Manage your AI credits" },
    { name: "Profile", icon: User, href: "/dashboard/profile", description: "Your account settings" },
    { name: "AI Chat", icon: MessageSquare, href: "/dashboard/chat", requiredPlan: ["pro", "advanced"], description: "Chat with AI strategist" },
  ];
  const mobileQuickNav: NavItem[] = [
    { name: "Overview", icon: Home, href: "/dashboard", requiredPlan: ["basic", "pro", "advanced"] },
    { name: "Channel Analysis", icon: Brain, href: "/dashboard/analysis", requiredPlan: ["basic", "pro", "advanced"] },
    { name: "Growth Tasks", icon: Target, href: "/dashboard/growth", requiredPlan: ["basic", "pro", "advanced"] },
    { name: "Profile", icon: User, href: "/dashboard/profile" },
  ];
  const currentNavItem =
    navigation.find((item) => (item.href === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(item.href))) ??
    (isAdmin && location.pathname.startsWith("/admin")
      ? ({ name: "Admin Panel", icon: Shield, href: "/admin" } as NavItem)
      : ({ name: "Overview", icon: Home, href: "/dashboard" } as NavItem));

  const isLocked = (item: NavItem): boolean => {
    if (isTestUser && item.href === "/dashboard/analysis") return false;
    if (!item.requiredPlan) return false;
    return !item.requiredPlan.includes(currentPlan);
  };

  const getMinRequiredPlan = (item: NavItem): SubscriptionPlan => {
    if (!item.requiredPlan || item.requiredPlan.length === 0) return "basic";
    let minPlan: SubscriptionPlan = "advanced";
    for (const plan of item.requiredPlan) {
      if (PLAN_ORDER.indexOf(plan) < PLAN_ORDER.indexOf(minPlan)) {
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
  const closeDrawerOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  useEffect(() => {
    if (!desktopInitRef.current && typeof window !== "undefined" && window.innerWidth >= 1024) {
      desktopInitRef.current = true;
      if (!sidebarOpen) {
        setSidebarOpen(true);
      }
    }
  }, [setSidebarOpen, sidebarOpen]);

  useEffect(() => {
    const previousPaddingBottom = document.body.style.paddingBottom;
    const previousPaddingTop = document.body.style.paddingTop;
    const previousPaddingLeft = document.body.style.paddingLeft;
    const applyPadding = () => {
      if (window.innerWidth < 1024) {
        document.body.style.paddingBottom = "72px";
        document.body.style.paddingTop = "66px";
        document.body.style.paddingLeft = "";
      } else {
        document.body.style.paddingBottom = "";
        document.body.style.paddingTop = "";
        document.body.style.paddingLeft = sidebarOpen ? "256px" : "80px";
      }
    };

    applyPadding();
    window.addEventListener("resize", applyPadding);
    return () => {
      window.removeEventListener("resize", applyPadding);
      document.body.style.paddingBottom = previousPaddingBottom;
      document.body.style.paddingTop = previousPaddingTop;
      document.body.style.paddingLeft = previousPaddingLeft;
    };
  }, [sidebarOpen]);

  return (
    <>
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 h-[66px] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent shrink-0">
            <currentNavItem.icon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-base truncate">{currentNavItem.name}</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-[10px] glass rounded-lg shrink-0"
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <aside
        className={`fixed lg:fixed lg:top-0 h-screen inset-y-0 left-0 z-50 w-64 glass-strong border-r border-border transform transition-transform duration-200 ${
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
                <span className="font-display font-bold text-sm leading-tight max-w-[132px]">
                  YouTube <span className="gradient-text">Growth Partner</span>
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="ml-auto hidden lg:inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-secondary transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
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
                  <Link key={item.name} to={item.href} onClick={closeDrawerOnMobile}>
                    {navContent}
                  </Link>
                );
              })}
            </TooltipProvider>

            {/* Admin Link */}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={closeDrawerOnMobile}
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

          {/* User */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
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
                    {currentPlan ? `${getPlanDisplayName(currentPlan)} Plan` : "No active subscription"}
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

      {sidebarOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="grid grid-cols-4">
          {mobileQuickNav.map((item) => {
            const active = isActive(item.href);
            const locked = isLocked(item);
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (locked) {
                    handleLockedClick(item);
                    return;
                  }
                  navigate(item.href);
                  closeDrawerOnMobile();
                }}
                className={`flex flex-col items-center justify-center gap-1 py-2 text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

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
