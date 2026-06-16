import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
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
import TextToSpeech from "./pages/TextToSpeech";
import TextToVideo from "./pages/TextToVideo";
import CompetitorAnalysis from "./pages/CompetitorAnalysis";
import ChannelAnalysis from "./pages/ChannelAnalysis";
import GrowthTasks from "./pages/GrowthTasks";
import Profile from "./pages/Profile";
import CreditsShop from "./pages/CreditsShop";
import CreditsHistory from "./pages/CreditsHistory";
import ThumbnailGenerator from "./pages/ThumbnailGenerator";
import SeoAnalyzer from "./pages/SeoAnalyzer";
import YouTubeCallback from "./pages/YouTubeCallback";
import About from "./pages/About";
import Blog from "./pages/Blog";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CookiePolicy from "./pages/CookiePolicy";
import NotFound from "./pages/NotFound";
import { SEO } from "./components/seo/SEO";

const queryClient = new QueryClient();

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    return <Navigate to={`/signin?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
};

const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    return <Navigate to={`/signin?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <Routes>
              <Route path="/" element={<><SEO title="AI YouTube Growth Platform" description="AI-powered YouTube analytics, keyword research, competitor insights, scripts, thumbnails, and growth tasks." path="/" /><Index /></>} />
              <Route path="/signin" element={<><SEO title="Sign In" description="Sign in to access your YouTube Growth Partner dashboard." path="/signin" noindex /><SignIn /></>} />
              <Route path="/signup" element={<><SEO title="Sign Up" description="Create your account and choose a subscription plan." path="/signup" noindex /><SignUp /></>} />
              <Route path="/payment-success" element={<><SEO title="Payment Success" description="Subscription payment status and activation page." path="/payment-success" noindex /><RequireAuth><PaymentSuccess /></RequireAuth></>} />
              <Route path="/dashboard" element={<><SEO title="Dashboard Overview" description="Your private YouTube channel overview dashboard." path="/dashboard" noindex /><RequireAuth><UserDashboard /></RequireAuth></>} />
              <Route path="/dashboard/topics" element={<><SEO title="Topic Ideas" description="Generate AI topic ideas for your YouTube content." path="/dashboard/topics" noindex /><RequireAuth><TopicIdeas /></RequireAuth></>} />
              <Route path="/dashboard/keywords" element={<><SEO title="Keyword Research" description="Research high-opportunity keywords for YouTube videos." path="/dashboard/keywords" noindex /><RequireAuth><KeywordsResearch /></RequireAuth></>} />
              <Route path="/dashboard/billing" element={<><SEO title="Billing & Plans" description="Manage your subscription and billing settings." path="/dashboard/billing" noindex /><RequireAuth><Billing /></RequireAuth></>} />
              <Route path="/dashboard/chat" element={<><SEO title="AI YouTube Strategist" description="Private AI strategist chat for creators." path="/dashboard/chat" noindex /><RequireAuth><AIChat /></RequireAuth></>} />
              <Route path="/dashboard/scripts" element={<><SEO title="AI Script Writer" description="Generate scripts for YouTube videos with AI." path="/dashboard/scripts" noindex /><RequireAuth><ScriptWriter /></RequireAuth></>} />
              <Route path="/dashboard/text-to-speech" element={<><SEO title="Text to Speech" description="Generate voiceovers and clone voices." path="/dashboard/text-to-speech" noindex /><RequireAuth><TextToSpeech /></RequireAuth></>} />
              <Route path="/dashboard/text-to-video" element={<><SEO title="Text to Video" description="Generate short-form videos from text prompts." path="/dashboard/text-to-video" noindex /><RequireAuth><TextToVideo /></RequireAuth></>} />
              <Route path="/dashboard/competitors" element={<><SEO title="Competitor Analysis" description="Analyze competitor channels to find growth opportunities." path="/dashboard/competitors" noindex /><RequireAuth><CompetitorAnalysis /></RequireAuth></>} />
              <Route path="/dashboard/analysis" element={<><SEO title="Channel Analysis" description="AI-powered analysis of your YouTube channel." path="/dashboard/analysis" noindex /><RequireAuth><ChannelAnalysis /></RequireAuth></>} />
              <Route path="/dashboard/growth" element={<><SEO title="Growth Tasks" description="Track and complete your YouTube growth tasks." path="/dashboard/growth" noindex /><RequireAuth><GrowthTasks /></RequireAuth></>} />
              <Route path="/dashboard/profile" element={<><SEO title="Profile Settings" description="Manage your profile and account settings." path="/dashboard/profile" noindex /><RequireAuth><Profile /></RequireAuth></>} />
              <Route path="/dashboard/credits" element={<><SEO title="AI Credits" description="Purchase and manage AI credits." path="/dashboard/credits" noindex /><RequireAuth><CreditsShop /></RequireAuth></>} />
              <Route path="/dashboard/credits/history" element={<><SEO title="Credits History" description="Review AI credits transactions and usage history." path="/dashboard/credits/history" noindex /><RequireAuth><CreditsHistory /></RequireAuth></>} />
              <Route path="/dashboard/thumbnails" element={<><SEO title="Thumbnail Generator" description="Create YouTube thumbnails with AI." path="/dashboard/thumbnails" noindex /><RequireAuth><ThumbnailGenerator /></RequireAuth></>} />
              <Route path="/dashboard/seo-analyzer" element={<><SEO title="SEO Analyzer" description="Analyze YouTube video SEO performance." path="/dashboard/seo-analyzer" noindex /><RequireAuth><SeoAnalyzer /></RequireAuth></>} />
              <Route path="/admin" element={<><SEO title="Admin Dashboard" description="Private admin interface." path="/admin" noindex /><RequireAdmin><AdminDashboard /></RequireAdmin></>} />
              <Route path="/youtube-callback" element={<><SEO title="YouTube Callback" description="OAuth callback handling." path="/youtube-callback" noindex /><RequireAuth><YouTubeCallback /></RequireAuth></>} />
              <Route path="/about" element={<><SEO title="About" description="Learn about YouTube Growth Partner." path="/about" /><About /></>} />
              <Route path="/blog" element={<><SEO title="Blog" description="YouTube growth guides, SEO tips, and creator strategies." path="/blog" /><Blog /></>} />
              <Route path="/careers" element={<><SEO title="Careers" description="Join the team behind YouTube Growth Partner." path="/careers" /><Careers /></>} />
              <Route path="/contact" element={<><SEO title="Contact" description="Contact support and sales." path="/contact" /><Contact /></>} />
              <Route path="/privacy" element={<><SEO title="Privacy Policy" description="Read our privacy policy and data practices." path="/privacy" /><Privacy /></>} />
              <Route path="/terms" element={<><SEO title="Terms of Service" description="Review terms and conditions." path="/terms" /><Terms /></>} />
              <Route path="/cookies" element={<><SEO title="Cookie Policy" description="Cookie usage and preferences policy." path="/cookies" /><CookiePolicy /></>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<><SEO title="Page Not Found" description="The requested page could not be found." path="/404" noindex /><NotFound /></>} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
