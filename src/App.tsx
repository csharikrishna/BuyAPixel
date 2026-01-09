import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "sonner";
import { useState, useEffect } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import AdminDashboard from "./pages/AdminDashboard";
import Index from "./pages/Index";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import BuyPixels from "./pages/BuyPixels";
import Leaderboard from "./pages/Leaderboard";
import Contact from "./pages/Contact";
import Help from "./pages/Help";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MarketplacePage from "./pages/MarketplacePage";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BlogAdmin from "./pages/BlogAdmin";
import Canvas from "./pages/Canvas";
import ScanPixel from "./pages/ScanPixel";
import LiveTicker from "./components/LiveTicker";
import { LayoutProvider } from "./contexts/LayoutContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <LayoutProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Global LiveTicker - Shows on all pages */}
            <AppContent />
          </BrowserRouter>
        </LayoutProvider>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider >
);

const AppContent = () => {
  const { isOnline, connectionQuality } = useNetworkStatus();
  const [hasWarnedWeakConnection, setHasWarnedWeakConnection] = useState(false);

  useEffect(() => {
    if (isOnline && (connectionQuality === '2g' || connectionQuality === 'slow-2g') && !hasWarnedWeakConnection) {
      toast.warning("Weak internet connection detected", {
        description: "This webpage may use more internet due to advertisements and dynamic content. A Wi-Fi connection is recommended.",
        duration: 8000,
      });
      setHasWarnedWeakConnection(true);
    }
  }, [isOnline, connectionQuality, hasWarnedWeakConnection]);

  return (
    <>
      <LiveTicker />
      {!isOnline && <OfflineBanner />}

      <Routes>
        {/* Admin Page */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Main Pages */}
        <Route path="/" element={<BuyPixels />} />
        <Route path="/about" element={<Index />} />
        <Route path="/canvas" element={<Canvas />} />
        <Route path="/scan" element={<ScanPixel />} />

        {/* Authentication */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* User Pages */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/help" element={<Help />} />

        {/* Blog Routes */}
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/admin" element={<BlogAdmin />} />
        <Route path="/blog/:slug" element={<BlogPost />} />

        {/* Legal Pages */}
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Catch-all 404 - MUST BE LAST */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;
