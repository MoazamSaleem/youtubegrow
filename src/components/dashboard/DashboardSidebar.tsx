import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getPlanDisplayName } from "@/lib/planLimits";
import {
  Youtube,
  Sparkles,
  BarChart3,
  Search,
  Lightbulb,
  Users,
  MessageSquare,
  Settings,
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
} from "lucide-react";

interface NavItem {
  name: string;
  icon: React.ElementType;
  href: string;
  locked?: boolean;
  requiredPlan?: string[];
}

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function DashboardSidebar({ sidebarOpen, setSidebarOpen }: DashboardSidebarProps) {
  const { profile, subscription, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const currentPlan = subscription?.plan || "free";

  const navigation: NavItem[] = [
    { name: "Overview", icon: BarChart3, href: "/dashboard" },
    { name: "Channel Analysis", icon: Brain, href: "/dashboard/analysis", requiredPlan: ["basic", "pro", "advanced"] },
    { name: "Keywords", icon: Search, href: "/dashboard/keywords" },
    { name: "Topic Ideas", icon: Lightbulb, href: "/dashboard/topics" },
    { name: "Script Writer", icon: FileText, href: "/dashboard/scripts", requiredPlan: ["pro", "advanced"] },
    { name: "Thumbnails", icon: Image, href: "/dashboard/thumbnails", requiredPlan: ["pro", "advanced"] },
    { name: "Competitors", icon: Users, href: "/dashboard/competitors", requiredPlan: ["basic", "pro", "advanced"] },
    { name: "Growth Tasks", icon: Target, href: "/dashboard/growth", requiredPlan: ["basic", "pro", "advanced"] },
    { name: "Leaderboard", icon: Crown, href: "/dashboard/leaderboard" },
    { name: "AI Chat", icon: MessageSquare, href: "/dashboard/chat" },
  ];

  const isLocked = (item: NavItem): boolean => {
    if (!item.requiredPlan) return false;
    return !item.requiredPlan.includes(currentPlan);
  };

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-strong border-r border-border transform transition-transform duration-200 ${
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
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const locked = isLocked(item);
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.name}
                  to={locked ? "#" : item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                  onClick={(e) => locked && e.preventDefault()}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="font-medium">{item.name}</span>
                      {locked && (
                        <Lock className="h-4 w-4 ml-auto text-warning" />
                      )}
                    </>
                  )}
                </Link>
              );
            })}

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

          {/* Upgrade Banner */}
          {sidebarOpen && currentPlan !== "advanced" && (
            <div className="p-4 border-t border-border">
              <div className="glass rounded-xl p-4 bg-gradient-to-br from-primary/10 to-accent/10">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-warning" />
                  <span className="font-semibold text-sm">Upgrade Plan</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Unlock more features and grow faster
                </p>
                <Button variant="premium" size="sm" className="w-full" asChild>
                  <Link to="/dashboard/billing">Upgrade Now</Link>
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
                onClick={() => signOut()}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
