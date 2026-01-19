import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import PaymentSuccess from "./pages/PaymentSuccess";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import TopicIdeas from "./pages/TopicIdeas";
import KeywordsResearch from "./pages/KeywordsResearch";
import Billing from "./pages/Billing";
import AIChat from "./pages/AIChat";
import ScriptWriter from "./pages/ScriptWriter";
import CompetitorAnalysis from "./pages/CompetitorAnalysis";
import ChannelAnalysis from "./pages/ChannelAnalysis";
import GrowthTasks from "./pages/GrowthTasks";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import CreditsShop from "./pages/CreditsShop";
import CreditsHistory from "./pages/CreditsHistory";
import ThumbnailGenerator from "./pages/ThumbnailGenerator";
import YouTubeCallback from "./pages/YouTubeCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/dashboard/topics" element={<TopicIdeas />} />
              <Route path="/dashboard/keywords" element={<KeywordsResearch />} />
              <Route path="/dashboard/billing" element={<Billing />} />
              <Route path="/dashboard/chat" element={<AIChat />} />
              <Route path="/dashboard/scripts" element={<ScriptWriter />} />
              <Route path="/dashboard/competitors" element={<CompetitorAnalysis />} />
              <Route path="/dashboard/analysis" element={<ChannelAnalysis />} />
              <Route path="/dashboard/growth" element={<GrowthTasks />} />
              <Route path="/dashboard/leaderboard" element={<Leaderboard />} />
              <Route path="/dashboard/profile" element={<Profile />} />
              <Route path="/dashboard/credits" element={<CreditsShop />} />
              <Route path="/dashboard/credits/history" element={<CreditsHistory />} />
              <Route path="/dashboard/thumbnails" element={<ThumbnailGenerator />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/youtube-callback" element={<YouTubeCallback />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
