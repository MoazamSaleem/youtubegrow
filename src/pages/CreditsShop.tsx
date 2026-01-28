import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LIMITS } from "@/lib/planLimits";
import {
  Sparkles,
  Coins,
  CreditCard,
  Loader2,
  Check,
  Gift,
  Zap,
  TrendingUp,
  History,
} from "lucide-react";
import { Link } from "react-router-dom";

interface CreditPackage {
  id: string;
  name: string;
  credits_amount: number;
  token_cost: number | null;
  price_usd: number | null;
  bonus_percentage: number;
}

interface UserCredits {
  ai_credits_balance: number;
  ai_credits_used: number;
  balance: number; // token balance
}

const CreditsShop = () => {
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [userCredits, setUserCredits] = useState<UserCredits>({
    ai_credits_balance: 0,
    ai_credits_used: 0,
    balance: 0,
  });
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("tokens");

  const currentPlan = subscription?.plan || "free";
  const planLimits = PLAN_LIMITS[currentPlan];

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

  const normalizeFunctionError = (error: any) => {
    if (!error) return null;
    const rawBody = error?.context?.body;
    if (typeof rawBody === "string") {
      try {
        const parsed = JSON.parse(rawBody);
        return parsed?.error || parsed?.message || error.message;
      } catch {
        return rawBody || error.message;
      }
    }
    if (rawBody && typeof rawBody === "object") {
      return rawBody.error || rawBody.message || error.message;
    }
    return error.message;
  };

  const invokeWithAuthRetry = async <T,>(payload: {
    body: Record<string, unknown>;
    accessToken: string;
  }) => {
    let { data, error } = await supabase.functions.invoke<T>("purchase-credits", {
      body: payload.body,
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    if (!error) return { data, error };

    const status = (error as any)?.context?.status ?? (error as any)?.status;
    const message = error?.message?.toLowerCase() || "";
    if (status !== 401 && !message.includes("invalid jwt") && !message.includes("401")) {
      return { data, error };
    }

    const refreshed = await getSessionWithRefresh(true);
    if (!refreshed?.access_token) {
      return { data, error };
    }

    return supabase.functions.invoke<T>("purchase-credits", {
      body: payload.body,
      headers: {
        Authorization: `Bearer ${refreshed.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch credit packages
      const { data: packagesData } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("credits_amount");
      setPackages(packagesData || []);

      // Fetch user credits
      const { data: userData } = await supabase
        .from("user_tokens")
        .select("ai_credits_balance, ai_credits_used, balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (userData) {
        setUserCredits(userData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseWithTokens = async (pkg: CreditPackage) => {
    if (!user || !pkg.token_cost) return;

    if (userCredits.balance < pkg.token_cost) {
      toast({
        title: "Insufficient tokens",
        description: `You need ${pkg.token_cost} tokens. Current balance: ${userCredits.balance}`,
        variant: "destructive",
      });
      return;
    }

    setPurchasing(pkg.id);

    try {
      const bonusCredits = Math.floor((pkg.credits_amount * pkg.bonus_percentage) / 100);
      const totalCredits = pkg.credits_amount + bonusCredits;
      const newTokenBalance = userCredits.balance - pkg.token_cost;
      const newCreditsBalance = userCredits.ai_credits_balance + totalCredits;

      // First get current total_spent
      const { data: currentData } = await supabase
        .from("user_tokens")
        .select("total_spent")
        .eq("user_id", user.id)
        .single();

      const currentSpent = (currentData as any)?.total_spent || 0;

      // Update user tokens
      await supabase
        .from("user_tokens")
        .update({
          balance: newTokenBalance,
          ai_credits_balance: newCreditsBalance,
          total_spent: currentSpent + pkg.token_cost,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      // Record purchase
      await supabase.from("credits_purchases").insert({
        user_id: user.id,
        package_id: pkg.id,
        credits_amount: totalCredits,
        payment_method: "tokens",
        tokens_spent: pkg.token_cost,
      });

      // Log to credits history
      await supabase.from("credits_history").insert({
        user_id: user.id,
        amount: totalCredits,
        type: "purchase",
        description: `Purchased ${pkg.name} with tokens`,
        balance_after: newCreditsBalance,
      });

      setUserCredits({
        ...userCredits,
        balance: newTokenBalance,
        ai_credits_balance: newCreditsBalance,
      });

      toast({
        title: "Purchase successful!",
        description: `+${totalCredits.toLocaleString()} AI credits added to your balance`,
      });
    } catch (error: any) {
      toast({
        title: "Purchase failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  const purchaseWithStripe = async (pkg: CreditPackage) => {
    if (!user || !pkg.price_usd) return;

    setPurchasing(pkg.id);

    try {
      const session = await getSessionWithRefresh(true);
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const { data, error } = await invokeWithAuthRetry<{ url?: string }>({
        body: { packageId: pkg.id },
        accessToken: session.access_token,
      });

      if (error) throw new Error(normalizeFunctionError(error) || "Unable to start checkout");
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Checkout failed",
        description: error.message || "Unable to start checkout",
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  const creditsPercentage =
    planLimits.aiStrategistCredits > 0
      ? Math.min((userCredits.ai_credits_balance / planLimits.aiStrategistCredits) * 100, 100)
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <div className="w-full">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">AI Credits Shop</h1>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                Purchase additional AI Strategist credits to power your YouTube growth.
              </p>
              <Link to="/dashboard/credits/history">
                <Button variant="outline" size="sm" className="gap-2">
                  <History className="h-4 w-4" />
                  View History
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Current Balance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6 mb-8"
          >
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-cyan-500" />
                  <span className="font-semibold">AI Credits Balance</span>
                </div>
                <p className="text-3xl font-bold text-primary">{userCredits.ai_credits_balance.toLocaleString()}</p>
                <Progress value={creditsPercentage} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {userCredits.ai_credits_used.toLocaleString()} credits used total
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">Token Balance</span>
                </div>
                <p className="text-3xl font-bold text-yellow-500">{userCredits.balance.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Earn tokens by completing growth tasks</p>
              </div>
            </div>
          </motion.div>

          {/* Credit Cost Reference */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-xl p-4 mb-8 bg-muted/30"
          >
            <p className="font-semibold mb-2">Credit Usage per Query:</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-500/10 text-green-500">20</Badge>
                <span>Basic queries</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">50</Badge>
                <span>Standard analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-red-500/10 text-red-500">100</Badge>
                <span>Extensive research</span>
              </div>
            </div>
          </motion.div>

          {/* Purchase Options */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="tokens" className="gap-2">
                <Coins className="h-4 w-4" />
                Buy with Tokens
              </TabsTrigger>
              <TabsTrigger value="stripe" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Buy with Card
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tokens">
              <div className="grid sm:grid-cols-2 gap-4">
                {packages.map((pkg, index) => {
                  const bonusCredits = Math.floor((pkg.credits_amount * pkg.bonus_percentage) / 100);
                  const canAfford = pkg.token_cost ? userCredits.balance >= pkg.token_cost : false;

                  return (
                    <motion.div
                      key={pkg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.05 }}
                      className={`glass rounded-xl p-6 ${!canAfford ? "opacity-60" : ""}`}
                    >
                      {pkg.bonus_percentage > 0 && (
                        <Badge className="absolute -top-2 -right-2 bg-green-500 text-white">
                          +{pkg.bonus_percentage}% Bonus
                        </Badge>
                      )}

                      <h3 className="font-display text-lg font-bold mb-2">{pkg.name}</h3>

                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-3xl font-bold text-primary">
                          {pkg.credits_amount.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">credits</span>
                      </div>

                      {bonusCredits > 0 && (
                        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
                          <Gift className="h-4 w-4" />
                          <span>+{bonusCredits.toLocaleString()} bonus credits</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-4">
                        <Coins className="h-5 w-5 text-yellow-500" />
                        <span className="text-xl font-bold">{pkg.token_cost?.toLocaleString()}</span>
                        <span className="text-muted-foreground">tokens</span>
                      </div>

                      <Button
                        className="w-full"
                        disabled={!canAfford || purchasing === pkg.id}
                        onClick={() => purchaseWithTokens(pkg)}
                      >
                        {purchasing === pkg.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : canAfford ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Purchase
                          </>
                        ) : (
                          `Need ${((pkg.token_cost || 0) - userCredits.balance).toLocaleString()} more tokens`
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="stripe">
              <div className="grid sm:grid-cols-2 gap-4">
                {packages.map((pkg, index) => {
                  const bonusCredits = Math.floor((pkg.credits_amount * pkg.bonus_percentage) / 100);

                  return (
                    <motion.div
                      key={pkg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.05 }}
                      className="glass rounded-xl p-6 relative"
                    >
                      {pkg.bonus_percentage > 0 && (
                        <Badge className="absolute -top-2 -right-2 bg-green-500 text-white">
                          +{pkg.bonus_percentage}% Bonus
                        </Badge>
                      )}

                      <h3 className="font-display text-lg font-bold mb-2">{pkg.name}</h3>

                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-3xl font-bold text-primary">
                          {pkg.credits_amount.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">credits</span>
                      </div>

                      {bonusCredits > 0 && (
                        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
                          <Gift className="h-4 w-4" />
                          <span>+{bonusCredits.toLocaleString()} bonus credits</span>
                        </div>
                      )}

                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-2xl font-bold">${pkg.price_usd?.toFixed(2)}</span>
                        <span className="text-muted-foreground">USD</span>
                      </div>

                      <Button
                        className="w-full"
                        disabled={purchasing === pkg.id}
                        onClick={() => purchaseWithStripe(pkg)}
                      >
                        {purchasing === pkg.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Buy Now
                          </>
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-xl p-6 mt-8 bg-primary/5"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Tips to Earn More Tokens</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Complete daily and weekly growth tasks for consistent token income</li>
              <li>• Reach milestones to unlock larger token rewards</li>
              <li>• Higher tier plans include more monthly AI credits</li>
            </ul>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default CreditsShop;
