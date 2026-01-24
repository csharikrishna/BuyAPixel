import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "sonner";
import { useState, useEffect, lazy, Suspense } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LayoutProvider } from "./contexts/LayoutContext";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ============================================
// STATIC IMPORTS (Critical Path - Always Loaded)
// ============================================
import BuyPixels from "./pages/BuyPixels";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";

// ============================================
// LAZY IMPORTS (Code Splitting - Loaded on Demand)
// ============================================

// Admin (rarely accessed, very large)
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BlogAdmin = lazy(() => import("./pages/BlogAdmin"));

// Secondary Pages
const Profile = lazy(() => import("./pages/Profile"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const Canvas = lazy(() => import("./pages/Canvas"));
const ScanPixel = lazy(() => import("./pages/ScanPixel"));

// Blog
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

// Auth
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

// Info Pages (rarely accessed)
const Index = lazy(() => import("./pages/Index"));
const Contact = lazy(() => import("./pages/Contact"));
const Help = lazy(() => import("./pages/Help"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

// LiveTicker (not critical for first paint)
const LiveTicker = lazy(() => import("./components/LiveTicker"));

// ============================================
// LOADING FALLBACK
// ============================================
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const TickerLoader = () => null; // LiveTicker can load silently

// ============================================
// QUERY CLIENT WITH OPTIMIZED DEFAULTS
// ============================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 1, // Only retry once on failure
    },
  },
});

// ============================================
// APP COMPONENT
// ============================================
const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <LayoutProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </LayoutProvider>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

// ============================================
// APP CONTENT WITH ROUTES
// ============================================
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
      {/* LiveTicker - Lazy loaded, non-blocking */}
      <Suspense fallback={<TickerLoader />}>
        <LiveTicker />
      </Suspense>

      {!isOnline && <OfflineBanner />}

      <ErrorBoundary pageName="BuyAPixel">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Admin Page */}
            <Route path="/admin" element={<AdminDashboard />} />

            {/* Main Pages (BuyPixels is static for fast first load) */}
            <Route path="/" element={<BuyPixels />} />
            <Route path="/about" element={<Index />} />
            <Route path="/canvas" element={<Canvas />} />
            <Route path="/scan" element={<ScanPixel />} />

            {/* Authentication (SignIn/SignUp static for fast access) */}
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
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default App;
