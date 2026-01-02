import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import PageTransition from "@/components/PageTransition";
import Index from "./pages/Index";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import TopicIdeas from "./pages/TopicIdeas";
import KeywordsResearch from "./pages/KeywordsResearch";
import Billing from "./pages/Billing";
import AIChat from "./pages/AIChat";
import ScriptWriter from "./pages/ScriptWriter";
import CompetitorAnalysis from "./pages/CompetitorAnalysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/signin" element={<PageTransition><SignIn /></PageTransition>} />
        <Route path="/signup" element={<PageTransition><SignUp /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><UserDashboard /></PageTransition>} />
        <Route path="/dashboard/topics" element={<PageTransition><TopicIdeas /></PageTransition>} />
        <Route path="/dashboard/keywords" element={<PageTransition><KeywordsResearch /></PageTransition>} />
        <Route path="/dashboard/billing" element={<PageTransition><Billing /></PageTransition>} />
        <Route path="/dashboard/chat" element={<PageTransition><AIChat /></PageTransition>} />
        <Route path="/dashboard/scripts" element={<PageTransition><ScriptWriter /></PageTransition>} />
        <Route path="/dashboard/competitors" element={<PageTransition><CompetitorAnalysis /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><AdminDashboard /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AnimatedRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;