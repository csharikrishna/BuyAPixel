import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { VirtualizedPixelGrid } from "@/components/VirtualizedPixelGrid";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { QuickSelectTools } from "@/components/QuickSelectTools";
import { EnhancedSelectionSummary } from "@/components/EnhancedSelectionSummary";
import { EnhancedCanvasControls } from "@/components/EnhancedCanvasControls";
import { PurchasePreview } from "@/components/PurchasePreview";
import { EnhancedStatsPanel } from "@/components/EnhancedStatsPanel";
import { MobileCanvasPanel } from "@/components/MobileCanvasPanel";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Store, Loader2, WifiOff, Undo2, X, AlertTriangle } from "lucide-react";
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
import confetti from "canvas-confetti";
import debounce from "lodash/debounce";
import { SelectedPixel } from "@/types/grid";
import { GRID_CONFIG, PIXEL_PRICING, AD_TIER_CONFIG, calculatePixelPrice } from "@/utils/gridConstants";

// --- Constants ---
const CANVAS_WIDTH = GRID_CONFIG.CANVAS_WIDTH;
const CANVAS_HEIGHT = GRID_CONFIG.CANVAS_HEIGHT;
const PIXEL_SIZE = 4;
const MAX_PIXELS_PER_PURCHASE = 1000;
const DRAFT_EXPIRY_HOURS = 1;
const SELECTION_HISTORY_LIMIT = 10;
const PURCHASE_BATCH_SIZE = 10;
const DRAFT_STORAGE_KEY = "pixelDraft";
const AUTOSAVE_DEBOUNCE_MS = 500;



// --- Interfaces ---

interface PixelDraft {
  pixels: SelectedPixel[];
  timestamp: number;
  version: number; // Add versioning for future compatibility
}

type Mode = "idle" | "buying" | "selling";

// --- Utility Functions ---

/**
 * Safely parse localStorage draft with error handling
 */
function parseDraft(draftString: string | null): PixelDraft | null {
  if (!draftString) return null;

  try {
    const draft = JSON.parse(draftString) as PixelDraft;

    // Validate draft structure
    if (
      !draft.pixels ||
      !Array.isArray(draft.pixels) ||
      typeof draft.timestamp !== "number"
    ) {
      return null;
    }

    return draft;
  } catch (error: unknown) {
    console.error("Failed to parse draft:", error);
    return null;
  }
}

/**
 * Check if draft is expired
 */
function isDraftExpired(draft: PixelDraft): boolean {
  const expiryTime = Date.now() - DRAFT_EXPIRY_HOURS * 60 * 60 * 1000;
  return draft.timestamp <= expiryTime;
}

const BuyPixels = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setTickerVisible } = useLayout();

  // Refs for cleanup and optimization
  const isMountedRef = useRef(true);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout>();
  const transitionTimeoutRef = useRef<NodeJS.Timeout>();

  // Network status
  const { isOnline } = useNetworkStatus();



  // --- State ---
  const [selectedPixels, setSelectedPixels] = useState<SelectedPixel[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMyPixels, setShowMyPixels] = useState(false);
  const [showPurchasePreview, setShowPurchasePreview] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [selectionHistory, setSelectionHistory] = useState<SelectedPixel[][]>([]);
  const [sharePixel, setSharePixel] = useState<{ x: number; y: number } | null>(null);
  const [showDraftRestorePrompt, setShowDraftRestorePrompt] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<PixelDraft | null>(null);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      saveDraft.cancel?.();
    };
  }, []);

  const totalCost = useMemo(() => {
    return selectedPixels.reduce((sum, pixel) => sum + pixel.price, 0);
  }, [selectedPixels]);

  const priceBreakdown = useMemo(() => {
    const gold = selectedPixels.filter((p) => p.price === PIXEL_PRICING.GOLD_PRICE).length;
    const premium = selectedPixels.filter((p) => p.price === PIXEL_PRICING.PREMIUM_PRICE).length;
    const economy = selectedPixels.filter((p) => p.price === PIXEL_PRICING.ECONOMY_PRICE).length;

    return { gold, premium, economy };
  }, [selectedPixels]);

  // --- Auto-save to localStorage with debouncing ---
  const saveDraft = useCallback(
    debounce((pixels: SelectedPixel[]) => {
      if (pixels.length === 0) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }

      const draft: PixelDraft = {
        pixels,
        timestamp: Date.now(),
        version: 1,
      };

      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (error: unknown) {
        console.error("Failed to save draft:", error);
        // Handle quota exceeded error
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          toast.error("Storage limit reached", {
            description: "Unable to auto-save selection",
          });
        }
      }
    }, AUTOSAVE_DEBOUNCE_MS),
    []
  );

  useEffect(() => {
    if (mode === "buying" && selectedPixels.length > 0) {
      saveDraft(selectedPixels);
    }
  }, [selectedPixels, mode, saveDraft]);

  // --- Sync Ticker Visibility ---
  useEffect(() => {
    setTickerVisible(!showPurchasePreview);

    return () => {
      if (isMountedRef.current) {
        setTickerVisible(true);
      }
    };
  }, [showPurchasePreview, setTickerVisible]);

  // --- Restore draft on mount ---
  useEffect(() => {
    const draftString = localStorage.getItem(DRAFT_STORAGE_KEY);
    const draft = parseDraft(draftString);

    if (!draft) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }

    if (isDraftExpired(draft)) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }

    if (draft.pixels.length > 0) {
      setDraftToRestore(draft);
      setShowDraftRestorePrompt(true);
    }
  }, []);

  // --- Handle draft restore ---
  const handleRestoreDraft = useCallback(() => {
    if (!draftToRestore) return;

    const normalizedDraftPixels = draftToRestore.pixels;
    setSelectedPixels(normalizedDraftPixels);
    setMode("buying");
    setIsSelecting(true);

    setShowDraftRestorePrompt(false);
    toast.success("Draft restored!", {
      description: `${draftToRestore.pixels.length} pixels from your last session`,
    });
  }, [draftToRestore]);

  const handleDismissDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setShowDraftRestorePrompt(false);
    setDraftToRestore(null);
  }, []);

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
  }, [mode, selectedPixels.length, showPurchasePreview]);

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

      setMode("buying");
      setIsSelecting(true);
      setIsLoading(false);

      toast.success("Start selecting pixels", {
        description: "Click and drag on the canvas. Press ESC to cancel.",
      });
    }, 200);
  }, [user, navigate, isOnline]);

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

  const handleSelectionChange = useCallback(
    (pixels: SelectedPixel[]) => {
      if (mode !== "buying") return;

      // Check max limit
      if (pixels.length > MAX_PIXELS_PER_PURCHASE) {
        toast.warning(`Maximum ${MAX_PIXELS_PER_PURCHASE} pixels per purchase`, {
          description: "Please reduce your selection",
        });
        return;
      }

      // Save current state to history before updating (limit history size)
      if (pixels.length !== selectedPixels.length) {
        setSelectionHistory((prev) => {
          const newHistory = [...prev, selectedPixels].slice(-SELECTION_HISTORY_LIMIT);
          return newHistory;
        });
      }

      setSelectedPixels(pixels);
    },
    [selectedPixels, mode]
  );

  const handleUndoLastSelection = useCallback(() => {
    if (selectionHistory.length === 0) {
      toast.info("Nothing to undo");
      return;
    }

    const previousState = selectionHistory[selectionHistory.length - 1];

    setSelectedPixels(previousState);
    setSelectionHistory((prev) => prev.slice(0, -1));

    toast.success("Undo successful", {
      description: "Previous selection restored",
    });
  }, [selectionHistory]);

  const confirmClearSelection = useCallback(() => {
    // Save to history before clearing
    if (selectedPixels.length > 0) {
      setSelectionHistory((prev) => [...prev, selectedPixels].slice(-SELECTION_HISTORY_LIMIT));
    }

    setSelectedPixels([]);

    setShowClearDialog(false);
    localStorage.removeItem(DRAFT_STORAGE_KEY);

    toast.success("Selection cleared");
  }, [selectedPixels]);

  const handleExitBuyingMode = useCallback(() => {
    setMode("idle");
    setIsSelecting(false);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    toast.info("Selection mode exited");
  }, []);

  const handleClearSelection = useCallback(() => {
    if (selectedPixels.length > 0) {
      setShowClearDialog(true);
    } else {
      handleExitBuyingMode();
    }
  }, [selectedPixels, handleExitBuyingMode]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    toast.info("View reset to 100%");
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

      // Trigger celebration
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#EF4444", "#10B981", "#F59E0B", "#6366F1"],
      });

      // Reset UI state with transition
      setShowPurchasePreview(false);

      setSelectedPixels([]);
      setSelectionHistory([]);
      setMode("idle");
      setIsSelecting(false);

      localStorage.removeItem(DRAFT_STORAGE_KEY);

      // Delayed actions
      setTimeout(() => {
        if (!isMountedRef.current) return;

        // Open share dialog for the first pixel
        if (purchasedPixels.length > 0) {
          setSharePixel(purchasedPixels[0]);
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
    [selectedPixels, navigate]
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
      <main className="flex-1 w-full overflow-hidden flex flex-col lg:grid lg:grid-cols-12 lg:gap-0">
        {/* LEFT COLUMN: CANVAS */}
        <div className="lg:col-span-9 order-1 flex flex-col gap-1 lg:gap-4 lg:h-[calc(100vh-64px)] lg:border-r border-border/40">
          {/* Canvas Wrapper with Overlay Controls */}
          <div className="w-full relative aspect-square lg:aspect-auto lg:flex-1">
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
                  onToggleSelecting={() => setIsSelecting(!isSelecting)}
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
                onClick={() => setIsSelecting(!isSelecting)}
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
                onClick={() => setZoom(Math.max(0.5, zoom / 1.2))}
                className="bg-muted hover:bg-muted/80 rounded-md font-bold transition-colors"
                aria-label="Zoom out"
              >
                -
              </button>

              <div
                className="flex items-center justify-center text-xs font-mono bg-background border rounded-md"
                aria-label={`Current zoom level: ${Math.round(zoom * 100)}%`}
              >
                {Math.round(zoom * 100)}%
              </div>

              <button
                onClick={() => setZoom(Math.min(8, zoom * 1.2))}
                className="bg-muted hover:bg-muted/80 rounded-md font-bold transition-colors"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SIDEBAR */}
        <div className="hidden lg:flex lg:flex-col lg:col-span-3 order-2 bg-gradient-to-b from-muted/20 to-background overflow-y-auto lg:h-[calc(100vh-64px)]">
          <div className="p-6 xl:p-8 space-y-6 flex-1">
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
                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-base h-14 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed gap-2.5"
                        aria-label="Buy pixels"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5" />
                            Buy Pixels
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
                        className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-semibold text-base h-14 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed gap-2.5"
                        aria-label="Open marketplace"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Store className="w-5 h-5" />
                            Marketplace
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
            <div className="hidden lg:block rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-7 text-center shadow-sm">
              <h1 className="text-2xl xl:text-3xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
                Select Pixels &<br />Make History
              </h1>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Choose from {(CANVAS_WIDTH * CANVAS_HEIGHT).toLocaleString()} pixels to showcase
                your brand forever.
              </p>
              <div className="flex justify-center gap-3 text-xs font-semibold">
                <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">₹99+</span>
                <span className="bg-accent/10 text-accent px-3 py-1.5 rounded-full border border-accent/20">Permanent</span>
              </div>

              {/* Keyboard Shortcuts Hint */}
              {mode === "buying" && (
                <div className="mt-5 pt-5 border-t border-border/50 text-left">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">⌨️ Shortcuts:</p>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between items-center">
                      <span>Undo</span>
                      <kbd className="px-2.5 py-1 bg-muted rounded-md text-xs font-mono border border-border/50">Ctrl+Z</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Cancel</span>
                      <kbd className="px-2.5 py-1 bg-muted rounded-md text-xs font-mono border border-border/50">ESC</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Clear</span>
                      <kbd className="px-2.5 py-1 bg-muted rounded-md text-xs font-mono border border-border/50">Del</kbd>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Zone Pricing Guide (Idle Mode) - Enhanced with Color Borders */}
            {mode === "idle" && (
              <div className="hidden lg:block rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-sm overflow-hidden">
                <h3 className="text-sm font-semibold mb-4 text-foreground/80">Pricing Zones</h3>
                <div className="space-y-2.5">
                  {/* Gold Tier */}
                  <div className="flex items-center justify-between rounded-lg border-l-4 border-l-amber-400 bg-amber-50/5 dark:bg-amber-950/10 px-4 py-3 transition-all hover:bg-amber-50/10 dark:hover:bg-amber-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-400 shadow-md shadow-amber-400/40" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Gold Center</span>
                        <span className="text-xs text-muted-foreground">Central premium area</span>
                      </div>
                    </div>
                    <span className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">₹499</span>
                  </div>
                  
                  {/* Premium Tier */}
                  <div className="flex items-center justify-between rounded-lg border-l-4 border-l-violet-400 bg-violet-50/5 dark:bg-violet-950/10 px-4 py-3 transition-all hover:bg-violet-50/10 dark:hover:bg-violet-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-violet-400 shadow-md shadow-violet-400/40" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Premium</span>
                        <span className="text-xs text-muted-foreground">Featured position</span>
                      </div>
                    </div>
                    <span className="text-base font-bold text-violet-600 dark:text-violet-400 tabular-nums">₹299</span>
                  </div>
                  
                  {/* Economy Tier */}
                  <div className="flex items-center justify-between rounded-lg border-l-4 border-l-emerald-400 bg-emerald-50/5 dark:bg-emerald-950/10 px-4 py-3 transition-all hover:bg-emerald-50/10 dark:hover:bg-emerald-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/40" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Economy</span>
                        <span className="text-xs text-muted-foreground">Standard placement</span>
                      </div>
                    </div>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">₹99</span>
                  </div>
                </div>
              </div>
            )}

            {/* Price Breakdown Card - Enhanced with Color Borders */}
            {mode === "buying" && selectedPixels.length > 0 && (
              <div className="hidden lg:block rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-sm overflow-hidden">
                <h3 className="text-sm font-semibold mb-4 text-foreground/80">Price Breakdown</h3>
                <div className="space-y-2.5 text-sm">
                  {priceBreakdown.gold > 0 && (
                    <div className="flex justify-between items-center rounded-lg border-l-4 border-l-amber-400 bg-amber-50/5 dark:bg-amber-950/10 px-3 py-2 transition-all hover:bg-amber-50/10 dark:hover:bg-amber-950/20">
                      <span className="text-muted-foreground flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="font-semibold text-amber-700 dark:text-amber-300">Gold (₹499)</span>
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {priceBreakdown.gold} × ₹499
                      </span>
                    </div>
                  )}
                  {priceBreakdown.premium > 0 && (
                    <div className="flex justify-between items-center rounded-lg border-l-4 border-l-violet-400 bg-violet-50/5 dark:bg-violet-950/10 px-3 py-2 transition-all hover:bg-violet-50/10 dark:hover:bg-violet-950/20">
                      <span className="text-muted-foreground flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-violet-400" />
                        <span className="font-semibold text-violet-700 dark:text-violet-300">Premium (₹299)</span>
                      </span>
                      <span className="font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                        {priceBreakdown.premium} × ₹299
                      </span>
                    </div>
                  )}
                  {priceBreakdown.economy > 0 && (
                    <div className="flex justify-between items-center rounded-lg border-l-4 border-l-emerald-400 bg-emerald-50/5 dark:bg-emerald-950/10 px-3 py-2 transition-all hover:bg-emerald-50/10 dark:hover:bg-emerald-950/20">
                      <span className="text-muted-foreground flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">Economy (₹99)</span>
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {priceBreakdown.economy} × ₹99
                      </span>
                    </div>
                  )}
                  <div className="pt-3 mt-2.5 border-t border-border/50 flex justify-between items-center font-bold">
                    <span className="text-foreground">Total</span>
                    <span className="text-lg text-primary tabular-nums">₹{totalCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sticky Stats & Tools */}
            {mode === "buying" && (
              <div className="sticky top-4 space-y-5">
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

                <EnhancedStatsPanel selectedPixelsCount={selectedPixels.length} />
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

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
        onClose={() => !isPurchasing && setShowPurchasePreview(false)}
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
            className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg text-white font-semibold h-12 rounded-xl"
            aria-label="Buy pixels"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-5 h-5 mr-2" />
            )}
            Buy Pixels
          </Button>
          <Button
            onClick={handleSellClick}
            disabled={isLoading || !isOnline}
            className="flex-1 bg-gradient-to-r from-rose-600 to-rose-700 shadow-lg text-white font-semibold h-12 rounded-xl"
            aria-label="Open marketplace"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Store className="w-5 h-5 mr-2" />
            )}
            Marketplace
          </Button>
        </div>
      )}
    </div>
  );
};

export default BuyPixels;
