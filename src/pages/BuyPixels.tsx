import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import { VirtualizedPixelGrid, GridHandle } from "@/components/VirtualizedPixelGrid";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { QuickSelectTools } from "@/components/QuickSelectTools";
import { EnhancedSelectionSummary } from "@/components/EnhancedSelectionSummary";
import { EnhancedCanvasControls } from "@/components/EnhancedCanvasControls";
import { PurchasePreview } from "@/components/PurchasePreview";
// Lazy-load stats panel - not critical for initial paint
const EnhancedStatsPanel = lazy(() => import("@/components/EnhancedStatsPanel").then(m => ({ default: m.EnhancedStatsPanel })));
import { MobileCanvasPanel } from "@/components/MobileCanvasPanel";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Store, Loader2, WifiOff, Undo2, X, GripVertical, PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SharePixelDialog } from "@/components/SharePixelDialog";

import { useLayout } from "@/contexts/LayoutContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { usePixelSelectionWorkflow } from "@/hooks/usePixelSelectionWorkflow";
import SEO from "@/components/SEO";
import { generateOrganizationSchema, generateWebsiteSchema, generateFAQSchema, generateServiceSchema, generateLocalBusinessSchema, generateBreadcrumbSchema } from "@/lib/seo-utils";
import { SelectedPixel } from "@/types/grid";
import { GRID_CONFIG, calculatePixelPrice } from "@/utils/gridConstants";

// --- Constants ---
const CANVAS_WIDTH = GRID_CONFIG.CANVAS_WIDTH;
const CANVAS_HEIGHT = GRID_CONFIG.CANVAS_HEIGHT;
const PIXEL_SIZE = 4;
const MAX_PIXELS_PER_PURCHASE = 1000;
const DRAFT_EXPIRY_HOURS = 1;
const SELECTION_HISTORY_LIMIT = 10;
const DRAFT_STORAGE_KEY = "pixelDraft";
const AUTOSAVE_DEBOUNCE_MS = 500;

// Sidebar constants
const SIDEBAR_MIN_WIDTH = 260;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 320;
const SIDEBAR_STORAGE_KEY = "sidebarWidth";



// --- Interfaces ---

type SharePixel = SelectedPixel & {
  imageUrl: string | null;
  linkUrl: string | null;
  pricePaid: number;
  pixelName: string;
};

const BuyPixels = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setTickerVisible } = useLayout();

  // Refs for cleanup and optimization
  const isMountedRef = useRef(true);
  const transitionTimeoutRef = useRef<NodeJS.Timeout>();
  const gridRef = useRef<GridHandle>(null);

  // Network status
  const { isOnline } = useNetworkStatus();

  // --- State ---
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showMyPixels, setShowMyPixels] = useState(false);
  const [showPurchasePreview, setShowPurchasePreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [sharePixel, setSharePixel] = useState<SharePixel | null>(null);

  const {
    selectedPixels,
    totalCost,
    mode,
    isSelecting,
    toggleSelecting,
    selectionHistory,
    showClearDialog,
    setShowClearDialog,
    showDraftRestorePrompt,
    setShowDraftRestorePrompt,
    draftToRestore,
    handleSelectionChange,
    handleUndoLastSelection,
    confirmClearSelection,
    handleExitBuyingMode,
    handleClearSelection,
    handleRestoreDraft,
    handleDismissDraft,
    enterBuyingMode,
    resetAfterPurchase,
    selectFocusedPixel,
  } = usePixelSelectionWorkflow({
    gridRef,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    maxPixelsPerPurchase: MAX_PIXELS_PER_PURCHASE,
    draftStorageKey: DRAFT_STORAGE_KEY,
    draftExpiryHours: DRAFT_EXPIRY_HOURS,
    selectionHistoryLimit: SELECTION_HISTORY_LIMIT,
    autosaveDebounceMs: AUTOSAVE_DEBOUNCE_MS,
  });

  // --- Resizable Sidebar State ---
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (w === 0 || (w >= SIDEBAR_MIN_WIDTH && w <= SIDEBAR_MAX_WIDTH)) return w;
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const latestWidthRef = useRef(sidebarWidth);

  // Keep ref in sync for mouseUp handler
  useEffect(() => {
    latestWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const sidebarCollapsed = sidebarWidth === 0;

  const handleSidebarToggle = useCallback(() => {
    const newWidth = sidebarCollapsed ? SIDEBAR_DEFAULT_WIDTH : 0;
    setSidebarWidth(newWidth);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newWidth));
  }, [sidebarCollapsed]);

  // Drag-to-resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX;
      let newWidth = resizeStartWidth.current + delta;
      if (newWidth < SIDEBAR_MIN_WIDTH - 40) {
        newWidth = 0;
      } else {
        newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth));
      }
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(latestWidthRef.current));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // --- Sync Ticker Visibility ---
  useEffect(() => {
    setTickerVisible(!showPurchasePreview);

    return () => {
      if (isMountedRef.current) {
        setTickerVisible(true);
      }
    };
  }, [showPurchasePreview, setTickerVisible]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      // Escape to clear selection or exit mode
      if (e.key === "Escape") {
        if (mode === "buying") {
          if (selectedPixels.length > 0) {
            setShowClearDialog(true);
          } else {
            handleExitBuyingMode();
          }
        } else if (showPurchasePreview) {
          setShowPurchasePreview(false);
        }
        return;
      }

      // Only process other shortcuts in buying mode
      if (mode !== "buying") return;

      // Ctrl+Z / Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndoLastSelection();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z to redo (future enhancement)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        toast.info("Redo not yet implemented");
        return;
      }

      // Ctrl+A to prevent default (inform user to use Quick Select)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        toast.info("Use Quick Select tools to select areas");
        return;
      }

      // Delete to clear selection
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedPixels.length > 0) {
          e.preventDefault();
          setShowClearDialog(true);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    mode,
    selectedPixels.length,
    showPurchasePreview,
    setShowClearDialog,
    handleExitBuyingMode,
    handleUndoLastSelection,
  ]);

  // --- Event Handlers ---
  const handleBuyClick = useCallback(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Please check your internet connection",
        icon: <WifiOff className="w-4 h-4" />,
      });
      return;
    }

    if (!user) {
      toast.error("Please sign in to buy pixels", {
        description: "Create an account or log in to purchase pixels",
        action: {
          label: "Sign In",
          onClick: () => navigate("/signin"),
        },
      });
      return;
    }

    setIsLoading(true);

    // Smooth transition with loading state
    transitionTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      enterBuyingMode();
      setIsLoading(false);

      toast.success("Start selecting pixels", {
        description: "Click and drag on the canvas. Press ESC to cancel.",
      });
    }, 200);
  }, [user, navigate, isOnline, enterBuyingMode]);

  const handleSellClick = useCallback(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Please check your internet connection",
        icon: <WifiOff className="w-4 h-4" />,
      });
      return;
    }

    if (!user) {
      toast.error("Please sign in to access marketplace", {
        description: "Create an account or log in to sell pixels",
        action: {
          label: "Sign In",
          onClick: () => navigate("/signin"),
        },
      });
      return;
    }

    toast.info("Opening marketplace...");
    navigate("/marketplace");
  }, [user, navigate, isOnline]);

  const handleResetView = useCallback(() => {
    gridRef.current?.resetViewport();
    toast.info("View reset");
  }, []);

  const handlePurchase = useCallback(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Please check your internet connection",
        icon: <WifiOff className="w-4 h-4" />,
      });
      return;
    }

    if (!user) {
      toast.error("Please sign in to buy pixels", {
        description: "Create an account or log in to purchase pixels",
        action: {
          label: "Sign In",
          onClick: () => navigate("/signin"),
        },
      });
      return;
    }

    if (selectedPixels.length === 0) {
      toast.error("Please select pixels to purchase");
      return;
    }

    setShowPurchasePreview(true);
  }, [user, selectedPixels.length, navigate, isOnline]);

  const handleConfirmPurchase = useCallback(
    async (pixelName: string, linkUrl: string, imageUrl: string | null) => {
      if (!isMountedRef.current) return;

      const purchasedPixels = [...selectedPixels];

      // Trigger celebration (dynamically imported to save ~15KB from critical path)
      import("canvas-confetti").then((mod) => {
        const confetti = mod.default;
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#EF4444", "#10B981", "#F59E0B", "#6366F1"],
        });
      });

      // Reset UI state with transition
      setShowPurchasePreview(false);
      resetAfterPurchase();

      // Force an immediate background refresh of the grid data
      // so it updates before the user sees the share dialog
      if (gridRef.current) {
        gridRef.current.refetchData();
      }

      // Delayed actions
      setTimeout(() => {
        if (!isMountedRef.current) return;

        // Open share dialog for the first pixel
        if (purchasedPixels.length > 0) {
          setSharePixel({
            ...purchasedPixels[0],
            pixelName: pixelName,
            linkUrl: linkUrl,
            imageUrl: imageUrl,
            pricePaid: purchasedPixels[0].price
          });
        }

        toast.success("Purchase complete! 🎉", {
          description: "View your pixels in your profile.",
          action: {
            label: "Go to Profile",
            onClick: () => navigate("/profile"),
          },
        });
      }, 1000);
    },
    [selectedPixels, navigate, resetAfterPurchase]
  );

  // --- Network Status Change Handler ---
  useEffect(() => {
    if (!isOnline && mode === "buying") {
      toast.warning("Connection lost", {
        description: "Your selection is saved locally",
        icon: <WifiOff className="w-4 h-4" />,
      });
    }
  }, [isOnline, mode]);

  // --- Performance Monitoring (Development Only) ---
  useEffect(() => {
    if (import.meta.env.DEV) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 16) {
            console.warn("Slow render:", entry.name, entry.duration);
          }
        }
      });
      observer.observe({ entryTypes: ["measure"] });
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="BuyASpot - Buy & Own Pixels Forever | Digital Real Estate Marketplace"
        description="Own a piece of internet history on BuyASpot. Buy pixels from ₹1-₹299, upload your image/brand, and reach millions globally. Permanent digital real estate for startups, businesses & creators."
        canonical="https://buyaspot.in/"
        image="https://buyaspot.in/bap_logo.png"
        imageAlt="BuyASpot - Digital pixel marketplace with 100x100 grid"
        keywords={[
          'buy pixels',
          'pixel advertising',
          'digital real estate',
          'pixel marketplace',
          'permanent ads',
          'affordable advertising India',
          'pixel grid',
          'digital canvas',
          'cheap online advertising',
          'startup marketing'
        ]}
        type="website"
        structuredData={[
          generateBreadcrumbSchema([
            { name: 'Home', url: 'https://buyaspot.in' }
          ]),
          generateWebsiteSchema(),
          generateOrganizationSchema(),
          generateServiceSchema(),
          generateLocalBusinessSchema(),
          generateFAQSchema([
            { 
              question: 'What is BuyASpot?', 
              answer: 'BuyASpot is a global digital real estate marketplace where you can buy permanent pixels on a shared 100x100 grid. Purchase pixels starting at ₹1, upload your brand/image, add a link, and reach worldwide audience forever. No recurring fees - it\'s a one-time permanent purchase.' 
            },
            { 
              question: 'How does BuyASpot work?', 
              answer: 'Select pixels on the interactive canvas (Gold/Silver/Bronze zones), upload your image or brand logo (JPG, PNG, GIF up to 5MB), add a clickable link to your website or social media, checkout securely with card/UPI, and your content goes live permanently on the global grid visible to millions.' 
            },
            { 
              question: 'How much does it cost?', 
              answer: 'Pixel prices vary by location: Gold Zone (₹299 per pixel - center premium spots), Silver Zone (₹99 per pixel - high visibility areas), Bronze Zone (₹49 per pixel - outer edges). Bulk purchases get discounts. One-time payment = permanent placement.' 
            },
            { 
              question: 'Who can use BuyASpot?', 
              answer: 'Startups looking for affordable marketing, freelancers building portfolios, artists showcasing work, small businesses expanding globally, indie developers promoting apps, creators building personal brands, and anyone wanting permanent web presence can use BuyASpot.' 
            },
            { 
              question: 'How long do my pixels stay live?', 
              answer: 'Your pixels remain live permanently under your account indefinitely. Unlike traditional ads with expiration dates, BuyASpot offers lifetime placement. You can update content anytime or remove it yourself if needed.' 
            },
            { 
              question: 'Can I edit my pixels after purchase?', 
              answer: 'Yes! You can edit your pixel content anytime - change the image, update the link, modify alt text. Just login to your profile and click Edit. Changes go live instantly.' 
            },
            { 
              question: 'What payment methods do you accept?', 
              answer: 'BuyASpot accepts all major payment methods including credit/debit cards (Visa, Mastercard, Amex), digital wallets (Google Pay, Apple Pay), and UPI (popular in India). All transactions are processed securely through Razorpay, India\'s leading payment gateway with 256-bit SSL encryption and PCI-DSS compliance. Your payment information is never stored on our servers.' 
            },
            { 
              question: 'Is my payment secure on BuyASpot?', 
              answer: 'Yes, 100% secure. We use Razorpay (trusted by 500K+ businesses) for all payments with 256-bit SSL encryption, tokenization, and fraud detection. Your card/UPI details are encrypted and never stored. Every transaction includes HMAC signature verification for extra security. We also comply with PCI-DSS Level 1 standards - the highest security certification for payment processing.' 
            },
            { 
              question: 'What is your refund policy?', 
              answer: 'Permanent pixel purchases are generally non-refundable once content goes live (usually within minutes). However, if you experience a technical issue preventing your content from displaying correctly, contact support@buyaspot.in within 24 hours with proof, and we\'ll provide a full refund or help fix the issue at no charge. For accidental duplicate purchases, we offer refunds within 1 hour of purchase.' 
            },
            { 
              question: 'What if my image doesn\'t display correctly?', 
              answer: 'First, try refreshing the page (hard refresh: Ctrl+Shift+R). If the issue persists, check that your image is JPG/PNG/GIF format and under 5MB. Log into your profile, click Edit, and reupload the image. If it still doesn\'t work, contact support@buyaspot.in with your pixel ID and screenshots. Our team responds within 2 hours and will resolve the issue or provide a refund.' 
            },
            { 
              question: 'Why can\'t I select certain pixels?', 
              answer: 'Pixels are unavailable if: (1) Already owned by another user, (2) Reserved for premium customers, (3) Temporarily locked during high traffic. Try selecting nearby pixels instead, or check back in a few minutes if the page is experiencing high load. If pixels remain unavailable for hours, contact support@buyaspot.in for assistance.' 
            },
            { 
              question: 'Can I get a refund if I change my mind?', 
              answer: 'Since BuyASpot offers permanent, lifetime placement for a one-time fee, refunds after content goes live are not available (it\'s a permanent purchase, like buying real estate). However, you can remove your content anytime from your profile. If you haven\'t confirmed purchase yet, you can modify your selection before checkout. For genuine technical issues within 24 hours, contact support@buyaspot.in for a full refund.' 
            },
          ])
        ]}
      />
      {/* Top banner intentionally removed per user preference */}
      <OnboardingTutorial />
      <Header />

      {/* Offline Warning Banner */}
      {!isOnline && (
        <div
          className="bg-orange-500/90 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2"
          role="alert"
          aria-live="polite"
        >
          <WifiOff className="w-4 h-4" />
          You're offline - selections are saved locally
        </div>
      )}

      {/* Draft Restore Prompt */}
      <AlertDialog open={showDraftRestorePrompt} onOpenChange={setShowDraftRestorePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Previous Selection?</AlertDialogTitle>
            <AlertDialogDescription>
              You have a saved draft with {draftToRestore?.pixels.length || 0} pixels (
              ₹
              {(draftToRestore?.pixels.reduce((sum, p) => sum + p.price, 0) || 0).toLocaleString()}
              ) from your last session. Would you like to restore it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDismissDraft}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft} className="bg-primary">
              Restore Selection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MAIN LAYOUT */}
      <main className="flex-1 w-full flex flex-col lg:flex-row lg:overflow-hidden">
        {/* LEFT COLUMN: CANVAS */}
        <div className="order-1 flex-1 min-w-0 flex flex-col gap-1 lg:gap-0 lg:overflow-hidden transition-all duration-300">
          {/* Canvas Wrapper with Overlay Controls */}
          <div className="w-full relative h-[56vh] sm:h-[60vh] lg:flex-1 lg:overflow-hidden">
            {/* Desktop Toolbar */}
            {mode === "buying" && (
              <div
                className="hidden lg:flex flex-col shrink-0 absolute left-4 top-4 z-10"
                role="toolbar"
                aria-label="Canvas controls"
              >
                <EnhancedCanvasControls
                  zoom={zoom}
                  onZoomChange={setZoom}
                  isSelecting={isSelecting}
                  onToggleSelecting={toggleSelecting}
                  showGrid={showGrid}
                  onToggleGrid={() => setShowGrid(!showGrid)}
                  showMyPixels={showMyPixels}
                  onToggleMyPixels={() => setShowMyPixels(!showMyPixels)}
                  onResetView={handleResetView}
                  selectedCount={selectedPixels.length}
                />
              </div>
            )}

            {/* THE GRID */}
            <div className="flex-1 overflow-hidden h-full w-full relative z-0">
              <VirtualizedPixelGrid
                ref={gridRef}
                selectedPixels={selectedPixels}
                onSelectionChange={handleSelectionChange}
                isSelecting={isSelecting && mode === "buying"}
                gridWidth={CANVAS_WIDTH}
                gridHeight={CANVAS_HEIGHT}
                pixelSize={PIXEL_SIZE}
                zoom={zoom}
                onZoomChange={setZoom}
                showGrid={showGrid}
                showMyPixels={showMyPixels}
                enableInteraction={mode === "buying"}
                onAvailablePixelFocused={selectFocusedPixel}
              />
            </div>
          </div>

          {/* Quick Action Bar in Buying Mode */}
          {mode === "buying" && (
            <div
              className="flex gap-2 items-center bg-card p-3 rounded-lg border shadow-sm"
              role="toolbar"
              aria-label="Selection actions"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleUndoLastSelection}
                      disabled={selectionHistory.length === 0}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      aria-label="Undo last selection"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Undo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Undo last selection (Ctrl+Z)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setShowClearDialog(true)}
                      disabled={selectedPixels.length === 0}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      aria-label="Clear all selections"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clear</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear selection (ESC)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex-1" />

              <Button
                onClick={handlePurchase}
                disabled={selectedPixels.length === 0 || !isOnline}
                size="sm"
                className="bg-primary hover:bg-primary/90 gap-1.5"
                aria-label={`Proceed to checkout with ${selectedPixels.length} pixels`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Proceed to Checkout
                {selectedPixels.length > 0 && (
                  <span className="ml-1 font-mono">({selectedPixels.length})</span>
                )}
              </Button>
            </div>
          )}

          {/* Mobile Controls Bar */}
          {mode === "buying" && (
            <div
              className="lg:hidden grid grid-cols-5 gap-2 bg-card p-2 rounded-lg border shadow-sm"
              role="toolbar"
              aria-label="Mobile canvas controls"
            >
              <button
                onClick={toggleSelecting}
                className={`col-span-2 flex items-center justify-center gap-2 h-10 rounded-md text-sm font-medium transition-colors ${isSelecting
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
                  }`}
                aria-label={isSelecting ? "Switch to pan mode" : "Switch to select mode"}
                aria-pressed={isSelecting}
              >
                {isSelecting ? "👆 Select" : "✋ Pan"}
              </button>

              <button
                onClick={() => {
                  const newZoom = Math.max(0.5, zoom / 1.2);
                  setZoom(newZoom);
                }}
                className="bg-muted hover:bg-muted/80 rounded-md font-bold transition-colors"
                aria-label="Zoom out"
              >
                -
              </button>

              <div
                className="flex items-center justify-center text-xs font-mono bg-background border rounded-md"
                aria-label={`Current zoom level: ${Math.round(zoom * 100)}%`}
                onClick={handleResetView}
              >
                {Math.round(zoom * 100)}%
              </div>

              <button
                onClick={() => {
                  const newZoom = Math.min(8, zoom * 1.2);
                  setZoom(newZoom);
                }}
                className="bg-muted hover:bg-muted/80 rounded-md font-bold transition-colors"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* SIDEBAR TOGGLE BUTTON — lives at main level, never clipped */}
        <div className="hidden lg:flex items-center order-2 flex-shrink-0 relative z-20">
          <button
            onClick={handleSidebarToggle}
            className="h-9 w-7 -mr-px rounded-l-lg bg-card text-muted-foreground shadow-sm border border-r-0 border-border/60 hover:bg-accent hover:text-accent-foreground transition-all duration-200 flex items-center justify-center active:scale-95"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* RIGHT COLUMN: SIDEBAR */}
        <div
          className={`hidden lg:block order-3 flex-shrink-0 relative ${
            isResizing ? '' : 'transition-[width] duration-300 ease-in-out'
          }`}
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        >
          {/* Drag Handle - on left edge */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={handleResizeStart}
              className={`absolute left-0 top-0 bottom-0 w-1.5 z-30 cursor-col-resize group/handle ${
                isResizing ? 'bg-primary/50' : 'hover:bg-primary/30'
              }`}
              title="Drag to resize"
            >
              <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity ${
                isResizing ? 'opacity-100' : 'opacity-0 group-hover/handle:opacity-100'
              }`}>
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Sidebar Content Container */}
          <div
            ref={sidebarRef}
            className="flex flex-col bg-gradient-to-b from-muted/20 to-background h-[calc(100vh-64px)] border-l border-border/40 w-full overflow-hidden"
          >
          {/* Scrollable Content */}
          <div className={`overflow-y-auto w-full h-full ${
            sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } ${isResizing ? '' : 'transition-opacity duration-200'}`}>
            <div className="p-4 space-y-5 pb-10">
            {/* Action Buttons - Idle Mode */}
            {mode === "idle" && (
              <TooltipProvider>
                <div className="flex flex-col gap-3 w-full" role="group" aria-label="Main actions">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleBuyClick}
                        disabled={isLoading || !isOnline}
                        size="lg"
                        className="group relative overflow-hidden w-full bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-lg h-14 rounded-2xl shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-emerald-500/50 transition-all duration-300 hover:shadow-[0_12px_25px_-6px_rgba(16,185,129,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] hover:-translate-y-1 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 gap-2.5"
                        aria-label="Buy pixels"
                      >
                        {/* Premium Shine Effect */}
                        <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                        
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                            <span className="relative z-10">Loading...</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5 relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300" />
                            <span className="relative z-10 drop-shadow-sm tracking-wide">Buy Pixels</span>
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Purchase pixels to display your content</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSellClick}
                        disabled={isLoading || !isOnline}
                        size="lg"
                        className="group relative overflow-hidden w-full bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-lg h-14 rounded-2xl shadow-[0_8px_20px_-6px_rgba(225,29,72,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-rose-500/50 transition-all duration-300 hover:shadow-[0_12px_25px_-6px_rgba(225,29,72,0.7),inset_0_1px_1px_rgba(255,255,255,0.5)] hover:-translate-y-1 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 gap-2.5"
                        aria-label="Open marketplace"
                      >
                        {/* Premium Shine Effect */}
                        <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />

                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                            <span className="relative z-10">Loading...</span>
                          </>
                        ) : (
                          <>
                            <Store className="w-5 h-5 relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300" />
                            <span className="relative z-10 drop-shadow-sm tracking-wide">Marketplace</span>
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Browse and manage pixels in the marketplace</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}

            {/* Desktop Intro Box */}
            <div className="hidden lg:block rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 text-center shadow-sm">
              <h1 className="text-xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
                Select Pixels &<br />Make History
              </h1>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Choose from {(CANVAS_WIDTH * CANVAS_HEIGHT).toLocaleString()} pixels to showcase
                your brand forever.
              </p>
              <div className="flex justify-center gap-2 text-xs font-semibold">
                <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">₹99+</span>
                <span className="bg-accent/10 text-accent px-3 py-1.5 rounded-full border border-accent/20">Permanent</span>
              </div>
            </div>

            {/* Zone Pricing Guide (Idle Mode) - Enhanced with Color Borders */}
            {mode === "idle" && (
              <div className="hidden lg:block rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 shadow-sm overflow-hidden">
                <h3 className="text-sm font-bold mb-4 text-foreground">Pricing Zones</h3>
                <div className="space-y-2.5">
                  {/* Gold Tier */}
                  <div className="flex items-center justify-between rounded-xl border-l-4 border-l-amber-400 bg-amber-50/5 dark:bg-amber-950/10 px-3 py-3 transition-all hover:bg-amber-50/10 dark:hover:bg-amber-950/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full bg-amber-400 shadow-md shadow-amber-400/40 flex-shrink-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300 truncate">Gold Center</span>
                        <span className="text-xs text-muted-foreground truncate">Central premium area</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums flex-shrink-0 ml-2">₹499</span>
                  </div>
                  
                  {/* Premium Tier */}
                  <div className="flex items-center justify-between rounded-xl border-l-4 border-l-violet-400 bg-violet-50/5 dark:bg-violet-950/10 px-3 py-3 transition-all hover:bg-violet-50/10 dark:hover:bg-violet-950/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full bg-violet-400 shadow-md shadow-violet-400/40 flex-shrink-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-semibold text-violet-700 dark:text-violet-300 truncate">Premium</span>
                        <span className="text-xs text-muted-foreground truncate">Featured position</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-violet-600 dark:text-violet-400 tabular-nums flex-shrink-0 ml-2">₹299</span>
                  </div>
                  
                  {/* Economy Tier */}
                  <div className="flex items-center justify-between rounded-xl border-l-4 border-l-emerald-400 bg-emerald-50/5 dark:bg-emerald-950/10 px-3 py-3 transition-all hover:bg-emerald-50/10 dark:hover:bg-emerald-950/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/40 flex-shrink-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate">Economy</span>
                        <span className="text-xs text-muted-foreground truncate">Standard placement</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0 ml-2">₹99</span>
                  </div>
                </div>
              </div>
            )}



            {/* Sticky Stats & Tools */}
            {mode === "buying" && (
              <div className="sticky top-4 space-y-6">
                <EnhancedSelectionSummary
                  selectedPixels={selectedPixels}
                  onClearSelection={handleClearSelection}
                  onUndoLastSelection={handleUndoLastSelection}
                  onPurchase={handlePurchase}
                />

                <div className="hidden sm:block">
                  <QuickSelectTools
                    onPixelsSelected={handleSelectionChange}
                    gridWidth={CANVAS_WIDTH}
                    gridHeight={CANVAS_HEIGHT}
                    calculatePixelPrice={calculatePixelPrice}
                    anchorPixel={
                      selectedPixels.length > 0
                        ? selectedPixels[selectedPixels.length - 1]
                        : null
                    }
                  />
                </div>

                <Suspense fallback={<div className="h-32 bg-muted rounded-lg animate-pulse" />}>
                  <EnhancedStatsPanel selectedPixelsCount={selectedPixels.length} />
                </Suspense>
              </div>
            )}
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* Footer hidden on desktop — full-viewport canvas experience */}
      <div className="lg:hidden">
        <Footer />
      </div>

      {/* --- MODALS & DIALOGS --- */}

      {/* Clear Selection Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Selection?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {selectedPixels.length} pixels selected (₹{totalCost.toLocaleString()}).
              Are you sure you want to clear your selection? This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearSelection}
              className="bg-destructive hover:bg-destructive/90"
            >
              Clear Selection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Preview Modal */}
      <PurchasePreview
        isOpen={showPurchasePreview}
        onClose={() => setShowPurchasePreview(false)}
        selectedPixels={selectedPixels}
        onConfirmPurchase={handleConfirmPurchase}
      />

      {/* Share Pixel Dialog */}
      <SharePixelDialog
        isOpen={!!sharePixel}
        onClose={() => setSharePixel(null)}
        pixel={sharePixel}
      />

      {/* Mobile Canvas Panel */}
      {mode === "buying" && (
        <MobileCanvasPanel
          selectedPixels={selectedPixels}
          onPurchase={handlePurchase}
          totalCost={totalCost}
        />
      )}

      {/* Floating Action Button (Mobile fallback) */}
      {mode === "buying" && selectedPixels.length > 0 && (
        <div className="lg:hidden">
          <FloatingActionButton
            selectedCount={selectedPixels.length}
            onClick={handlePurchase}
          />
        </div>
      )}

      {/* Mobile Fixed Action Buttons (Idle Mode) */}
      {mode === "idle" && (
        <div className="fixed bottom-16 left-4 right-4 z-50 lg:hidden flex gap-3">
          <Button
            onClick={handleBuyClick}
            disabled={isLoading || !isOnline}
            className="group relative overflow-hidden flex-1 bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-emerald-500/50 text-white font-bold h-12 rounded-xl transition-all duration-300 active:scale-95"
            aria-label="Buy pixels"
          >
            <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
            
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin relative z-10" />
            ) : (
              <ShoppingCart className="w-5 h-5 mr-1.5 relative z-10 drop-shadow-sm" />
            )}
            <span className="relative z-10 drop-shadow-sm">Buy Pixels</span>
          </Button>
          <Button
            onClick={handleSellClick}
            disabled={isLoading || !isOnline}
            className="group relative overflow-hidden flex-1 bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_4px_12px_-4px_rgba(225,29,72,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-rose-500/50 text-white font-bold h-12 rounded-xl transition-all duration-300 active:scale-95"
            aria-label="Open marketplace"
          >
            <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />

            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin relative z-10" />
            ) : (
              <Store className="w-5 h-5 mr-1.5 relative z-10 drop-shadow-sm" />
            )}
            <span className="relative z-10 drop-shadow-sm">Marketplace</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default BuyPixels;
