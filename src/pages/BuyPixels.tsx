import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { VirtualizedPixelGrid, GridHandle } from "@/components/VirtualizedPixelGrid";
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
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
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
import SEO from "@/components/SEO";
import { generateOrganizationSchema, generateWebsiteSchema, generateFAQSchema, generateServiceSchema, generateLocalBusinessSchema, generateBreadcrumbSchema } from "@/lib/seo-utils";
import confetti from "canvas-confetti";
import debounce from "lodash/debounce";
import { SelectedPixel } from "@/types/grid";
import { GRID_CONFIG, PIXEL_PRICING, calculatePixelPrice } from "@/utils/gridConstants";

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
  const gridRef = useRef<GridHandle>(null);

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
                enableInteraction={true}
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

                <EnhancedStatsPanel selectedPixelsCount={selectedPixels.length} />
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
