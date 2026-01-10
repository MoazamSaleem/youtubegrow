import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  History,
  ArrowUp,
  ArrowDown,
  Package,
  Loader2,
  CreditCard,
  Coins,
  RefreshCw,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface CreditsHistoryEntry {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  balance_after: number | null;
  created_at: string;
}

interface CreditsPurchase {
  id: string;
  credits_amount: number;
  payment_method: string;
  tokens_spent: number | null;
  amount_usd: number | null;
  created_at: string;
  package_id: string | null;
}

interface CreditsUsage {
  id: string;
  credits_used: number;
  query_type: string;
  query_complexity: string;
  created_at: string;
}

const CreditsHistory = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [history, setHistory] = useState<CreditsHistoryEntry[]>([]);
  const [purchases, setPurchases] = useState<CreditsPurchase[]>([]);
  const [usage, setUsage] = useState<CreditsUsage[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch credits history
      const { data: historyData } = await supabase
        .from("credits_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setHistory(historyData || []);

      // Fetch purchases
      const { data: purchasesData } = await supabase
        .from("credits_purchases")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setPurchases(purchasesData || []);

      // Fetch usage
      const { data: usageData } = await supabase
        .from("ai_credits_usage")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setUsage(usageData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "subscription":
        return <CreditCard className="h-4 w-4 text-primary" />;
      case "purchase":
        return <Package className="h-4 w-4 text-green-500" />;
      case "usage":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case "bonus":
        return <Sparkles className="h-4 w-4 text-yellow-500" />;
      case "refund":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <Coins className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      subscription: { variant: "default", className: "bg-primary/10 text-primary" },
      purchase: { variant: "secondary", className: "bg-green-500/10 text-green-500" },
      usage: { variant: "destructive", className: "bg-red-500/10 text-red-500" },
      bonus: { variant: "secondary", className: "bg-yellow-500/10 text-yellow-500" },
      refund: { variant: "secondary", className: "bg-blue-500/10 text-blue-500" },
    };
    const config = variants[type] || { variant: "outline" as const, className: "" };
    return (
      <Badge variant={config.variant} className={config.className}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

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
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Link to="/dashboard/credits">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Shop
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <History className="h-6 w-6 text-white" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Credits History</h1>
            </div>
            <p className="text-muted-foreground">
              Track all your AI credits transactions, purchases, and usage.
            </p>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all" className="gap-2">
                <History className="h-4 w-4" />
                All Activity
              </TabsTrigger>
              <TabsTrigger value="purchases" className="gap-2">
                <Package className="h-4 w-4" />
                Purchases
              </TabsTrigger>
              <TabsTrigger value="usage" className="gap-2">
                <ArrowDown className="h-4 w-4" />
                Usage
              </TabsTrigger>
            </TabsList>

            {/* All Activity Tab */}
            <TabsContent value="all">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl overflow-hidden"
              >
                {history.length === 0 ? (
                  <div className="p-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No activity yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your credits history will appear here once you start using AI features.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(entry.type)}
                              {getTypeBadge(entry.type)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {entry.description || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={entry.amount > 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                              {entry.amount > 0 ? "+" : ""}{entry.amount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {entry.balance_after?.toLocaleString() || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </motion.div>
            </TabsContent>

            {/* Purchases Tab */}
            <TabsContent value="purchases">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl overflow-hidden"
              >
                {purchases.length === 0 ? (
                  <div className="p-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No purchases yet</p>
                    <Link to="/dashboard/credits">
                      <Button className="mt-4">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Buy Credits
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment Method</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {purchase.payment_method === "tokens" ? (
                                <>
                                  <Coins className="h-4 w-4 text-yellow-500" />
                                  <span>Tokens</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4 text-primary" />
                                  <span>Card</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-green-500 font-semibold">
                              +{purchase.credits_amount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {purchase.payment_method === "tokens" ? (
                              <span className="text-yellow-500">{purchase.tokens_spent?.toLocaleString()} tokens</span>
                            ) : (
                              <span className="text-muted-foreground">${purchase.amount_usd?.toFixed(2)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(purchase.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </motion.div>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl overflow-hidden"
              >
                {usage.length === 0 ? (
                  <div className="p-12 text-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No usage yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start using AI features to see your usage history here.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query Type</TableHead>
                        <TableHead>Complexity</TableHead>
                        <TableHead className="text-right">Credits Used</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {entry.query_type}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              entry.query_complexity === "basic" ? "text-green-500 border-green-500/30" :
                              entry.query_complexity === "standard" ? "text-yellow-500 border-yellow-500/30" :
                              "text-red-500 border-red-500/30"
                            }>
                              {entry.query_complexity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-red-500 font-semibold">
                              -{entry.credits_used.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* Summary Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8"
          >
            <div className="glass rounded-xl p-4 text-center">
              <ArrowUp className="h-5 w-5 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-500">
                {history.filter(h => h.amount > 0).reduce((sum, h) => sum + h.amount, 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Added</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <ArrowDown className="h-5 w-5 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-500">
                {Math.abs(history.filter(h => h.amount < 0).reduce((sum, h) => sum + h.amount, 0)).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Used</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <Package className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{purchases.length}</p>
              <p className="text-xs text-muted-foreground">Purchases</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <Calendar className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-2xl font-bold">{usage.length}</p>
              <p className="text-xs text-muted-foreground">Queries</p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default CreditsHistory;
