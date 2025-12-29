import { useState, useCallback, useEffect, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Store, Loader2, WifiOff, Undo2, X } from "lucide-react";
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

// --- Constants ---
const CANVAS_WIDTH = 150;
const CANVAS_HEIGHT = 150;
const PIXEL_SIZE = 4;
const MAX_PIXELS_PER_PURCHASE = 1000;
const DRAFT_EXPIRY_HOURS = 1;
const SELECTION_HISTORY_LIMIT = 10;
const PURCHASE_BATCH_SIZE = 10;

// --- Interfaces ---
interface SelectedPixel {
  x: number;
  y: number;
  price: number;
  id: string;
}

interface PixelDraft {
  pixels: SelectedPixel[];
  timestamp: number;
}

const BuyPixels = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // --- State ---
  const [selectedPixels, setSelectedPixels] = useState<SelectedPixel[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMyPixels, setShowMyPixels] = useState(false);
  const [showPurchasePreview, setShowPurchasePreview] = useState(false);
  const [mode, setMode] = useState<'idle' | 'buying' | 'selling'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [selectionHistory, setSelectionHistory] = useState<SelectedPixel[][]>([]);

  // --- Online/Offline Detection ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You're back online!");
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You're offline. Please check your connection.");
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape to clear selection
      if (e.key === 'Escape' && mode === 'buying') {
        if (selectedPixels.length > 0) {
          setShowClearDialog(true);
        } else {
          handleClearSelection();
        }
      }
      
      // Ctrl+Z / Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && mode === 'buying') {
        e.preventDefault();
        handleUndoLastSelection();
      }
      
      // Ctrl+A to select all (prevent default)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && mode === 'buying') {
        e.preventDefault();
        toast.info("Use Quick Select tools to select areas");
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, selectedPixels.length]);

  // --- Auto-save to localStorage (Draft Feature) ---
  useEffect(() => {
    if (mode === 'buying' && selectedPixels.length > 0) {
      const draft: PixelDraft = {
        pixels: selectedPixels,
        timestamp: Date.now()
      };
      localStorage.setItem('pixelDraft', JSON.stringify(draft));
    }
  }, [selectedPixels, mode]);

  // --- Restore draft on mount ---
  useEffect(() => {
    const draft = localStorage.getItem('pixelDraft');
    if (!draft) return;
    
    try {
      const { pixels, timestamp }: PixelDraft = JSON.parse(draft);
      const expiryTime = Date.now() - (DRAFT_EXPIRY_HOURS * 60 * 60 * 1000);
      
      if (timestamp > expiryTime && pixels.length > 0) {
        toast.info("Draft selection found", {
          description: `${pixels.length} pixels from your last session`,
          action: {
            label: "Restore",
            onClick: () => {
              setSelectedPixels(pixels);
              setMode('buying');
              setIsSelecting(true);
              toast.success("Draft restored!");
            }
          }
        });
      } else {
        // Clean up expired draft
        localStorage.removeItem('pixelDraft');
      }
    } catch (e) {
      console.error('Failed to restore draft:', e);
      localStorage.removeItem('pixelDraft');
    }
  }, []);

  // --- Memoized Calculations ---
  const calculatePixelPrice = useCallback((x: number, y: number) => {
    const centerX = CANVAS_WIDTH / 2.0;
    const centerY = CANVAS_HEIGHT / 2.0;
    const distanceFromCenter = Math.sqrt(
      Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
    const normalizedDistance = distanceFromCenter / maxDistance;
    
    if (normalizedDistance < 0.212) return 299; // Premium
    if (normalizedDistance < 0.424) return 199; // Standard
    return 99; // Economy
  }, []);

  const totalCost = useMemo(() => {
    return selectedPixels.reduce((sum, pixel) => sum + pixel.price, 0);
  }, [selectedPixels]);

  const priceBreakdown = useMemo(() => {
    const premium = selectedPixels.filter(p => p.price === 299).length;
    const standard = selectedPixels.filter(p => p.price === 199).length;
    const economy = selectedPixels.filter(p => p.price === 99).length;
    
    return { premium, standard, economy };
  }, [selectedPixels]);

  // --- Event Handlers ---
  const handleBuyClick = useCallback(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Please check your internet connection"
      });
      return;
    }

    if (!user) {
      toast.error("Please sign in to buy pixels", {
        description: "Create an account or log in to purchase pixels",
        action: {
          label: "Sign In",
          onClick: () => navigate('/signin')
        }
      });
      return;
    }
    
    setIsLoading(true);
    
    // Small delay for smooth transition
    setTimeout(() => {
      setMode('buying');
      setIsSelecting(true);
      setIsLoading(false);
      toast.success("Start selecting pixels", {
        description: "Click and drag on the canvas. Press ESC to cancel."
      });
    }, 200);
  }, [user, navigate, isOnline]);

  const handleSellClick = useCallback(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Please check your internet connection"
      });
      return;
    }

    if (!user) {
      toast.error("Please sign in to access marketplace", {
        description: "Create an account or log in to sell pixels",
        action: {
          label: "Sign In",
          onClick: () => navigate('/signin')
        }
      });
      return;
    }
    
    toast.info("Opening marketplace...");
    navigate('/marketplace');
  }, [user, navigate, isOnline]);

  const handleSelectionChange = useCallback((pixels: SelectedPixel[]) => {
    if (mode !== 'buying') return;
    
    // Check max limit
    if (pixels.length > MAX_PIXELS_PER_PURCHASE) {
      toast.warning(`Maximum ${MAX_PIXELS_PER_PURCHASE} pixels per purchase`, {
        description: "Please reduce your selection"
      });
      return;
    }
    
    // Save current state to history before updating
    setSelectionHistory(prev => 
      [...prev.slice(-SELECTION_HISTORY_LIMIT + 1), selectedPixels]
    );
    
    setSelectedPixels(pixels);
  }, [selectedPixels, mode]);

  const handleUndoLastSelection = useCallback(() => {
    if (selectionHistory.length === 0) {
      toast.info("Nothing to undo");
      return;
    }
    
    const previousState = selectionHistory[selectionHistory.length - 1];
    setSelectedPixels(previousState);
    setSelectionHistory(prev => prev.slice(0, -1));
    toast.success("Undo successful", {
      description: "Previous selection restored"
    });
  }, [selectionHistory]);

  const confirmClearSelection = useCallback(() => {
    setSelectionHistory(prev => [...prev, selectedPixels]);
    setSelectedPixels([]);
    setMode('idle');
    setIsSelecting(false);
    setShowClearDialog(false);
    localStorage.removeItem('pixelDraft');
    toast.success("Selection cleared");
  }, [selectedPixels]);

  const handleClearSelection = useCallback(() => {
    if (selectedPixels.length > 0) {
      setShowClearDialog(true);
    } else {
      setMode('idle');
      setIsSelecting(false);
      localStorage.removeItem('pixelDraft');
      toast.info("Selection mode exited");
    }
  }, [selectedPixels]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    toast.info("View reset to 100%");
  }, []);

  const handlePurchase = useCallback(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Please check your internet connection"
      });
      return;
    }

    if (!user) {
      toast.error("Please sign in to buy pixels", {
        description: "Create an account or log in to purchase pixels",
        action: {
          label: "Sign In",
          onClick: () => navigate('/signin')
        }
      });
      return;
    }
    
    if (selectedPixels.length === 0) {
      toast.error("Please select pixels to purchase");
      return;
    }
    
    setShowPurchasePreview(true);
  }, [user, selectedPixels.length, navigate, isOnline]);

  const handleConfirmPurchase = useCallback(async (
    pixelName: string, 
    linkUrl: string, 
    imageUrl: string | null
  ) => {
    if (!user || selectedPixels.length === 0 || isPurchasing || !isOnline) return;

    setIsPurchasing(true);
    const now = new Date().toISOString();
    
    try {
      const totalBatches = Math.ceil(selectedPixels.length / PURCHASE_BATCH_SIZE);
      let successCount = 0;
      let failedPixels: SelectedPixel[] = [];
      
      const progressToast = toast.loading(`Processing batch 1 of ${totalBatches}...`);
      
      for (let i = 0; i < totalBatches; i++) {
        const batch = selectedPixels.slice(
          i * PURCHASE_BATCH_SIZE, 
          (i + 1) * PURCHASE_BATCH_SIZE
        );
        
        toast.loading(`Processing batch ${i + 1} of ${totalBatches}...`, {
          id: progressToast
        });
        
        const updates = batch.map((p) => {
          const price_tier = p.price === 299 ? 3 : p.price === 199 ? 2 : 1;
          return supabase
            .from('pixels')
            .update({
              owner_id: user.id,
              price_paid: p.price,
              price_tier,
              purchased_at: now,
              is_active: true,
              image_url: imageUrl,
              link_url: linkUrl || null,
              alt_text: pixelName
            })
            .eq('x', p.x)
            .eq('y', p.y)
            .is('owner_id', null); // Optimistic locking
        });

        const results = await Promise.all(updates);
        
        results.forEach((result, index) => {
          if (!result.error) {
            successCount++;
          } else {
            failedPixels.push(batch[index]);
          }
        });
      }

      toast.dismiss(progressToast);

      if (successCount === 0) {
        toast.error("Purchase failed", {
          description: "These pixels were just purchased by someone else!"
        });
        return;
      }
      
      if (successCount < selectedPixels.length) {
        toast.warning(`Purchased ${successCount} pixels`, {
          description: `${failedPixels.length} pixels were already taken.`
        });
      } else {
        toast.success(`🎉 Successfully purchased ${selectedPixels.length} pixels!`, {
          description: "Your pixels are now live on the canvas!"
        });
      }
      
      setShowPurchasePreview(false);
      setSelectedPixels([]);
      setSelectionHistory([]);
      setMode('idle');
      setIsSelecting(false);
      localStorage.removeItem('pixelDraft');
      
      setTimeout(() => {
        toast.message("Purchase complete!", {
          description: "View your pixels in your profile.",
          action: {
            label: "Go to Profile",
            onClick: () => navigate('/profile')
          }
        });
      }, 1000);
      
    } catch (err) {
      console.error('Purchase failed:', err);
      toast.error("Purchase failed", {
        description: err instanceof Error ? err.message : "Please try again or contact support."
      });
    } finally {
      setIsPurchasing(false);
    }
  }, [user, selectedPixels, navigate, isPurchasing, isOnline]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OnboardingTutorial />
      <Header />
      
      {/* Offline Warning Banner */}
      {!isOnline && (
        <div className="bg-yellow-500/10 border-b border-yellow-500 text-yellow-700 dark:text-yellow-400 px-4 py-2 text-center flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">You're offline. Some features may not work.</span>
        </div>
      )}
      
      {/* --- MAIN LAYOUT --- */}
      <main className="flex-1 container mx-auto px-2 sm:px-4 lg:px-6 py-4 flex flex-col lg:grid lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CANVAS */}
        <div className="lg:col-span-9 order-1 flex flex-col gap-4">

          {/* Canvas Wrapper */}
          <div className="w-full relative z-0">
            {/* Desktop Toolbar */}
            {mode === 'buying' && (
              <div className="hidden lg:block absolute top-4 left-4 z-20">
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
            <div className="w-full rounded-xl shadow-2xl border bg-card overflow-hidden h-[65vh] sm:h-[70vh] lg:h-[80vh]">
              <VirtualizedPixelGrid
                selectedPixels={selectedPixels}
                onSelectionChange={handleSelectionChange}
                isSelecting={isSelecting && mode === 'buying'}
                gridWidth={CANVAS_WIDTH}
                gridHeight={CANVAS_HEIGHT}
                pixelSize={PIXEL_SIZE}
                zoom={zoom}
                onZoomChange={setZoom}
                showGrid={showGrid}
                showMyPixels={showMyPixels}
              />
            </div>
          </div>

          {/* Action Buttons - Below Canvas */}
          {mode === 'idle' && (
            <TooltipProvider>
              <div className="flex gap-2 sm:gap-3 w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleBuyClick}
                      disabled={isLoading || !isOnline}
                      size="default"
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-sm sm:text-base h-11 sm:h-12 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          Buy Pixels
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Purchase pixels to display your content</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleSellClick}
                      disabled={isLoading || !isOnline}
                      size="default"
                      className="flex-1 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-semibold text-sm sm:text-base h-11 sm:h-12 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Store className="w-4 h-4" />
                          Marketplace
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Browse and manage pixels in the marketplace</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}

          {/* Quick Action Bar in Buying Mode - SIMPLIFIED WITHOUT COUNT */}
          {mode === 'buying' && (
            <div className="flex gap-2 items-center bg-card p-3 rounded-lg border shadow-sm">
              <Button
                onClick={handleUndoLastSelection}
                disabled={selectionHistory.length === 0}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </Button>
              
              <Button
                onClick={() => setShowClearDialog(true)}
                disabled={selectedPixels.length === 0}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
              
              <div className="flex-1" />
              
              <Button
                onClick={handlePurchase}
                disabled={selectedPixels.length === 0 || !isOnline}
                size="sm"
                className="bg-primary hover:bg-primary/90 gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Proceed to Checkout
              </Button>
            </div>
          )}

          {/* Mobile Controls Bar */}
          {mode === 'buying' && (
            <div className="lg:hidden grid grid-cols-5 gap-2 bg-card p-2 rounded-lg border shadow-sm">
              <button
                onClick={() => setIsSelecting(!isSelecting)}
                className={`col-span-2 flex items-center justify-center gap-2 h-10 rounded-md text-sm font-medium transition-colors ${
                  isSelecting ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {isSelecting ? '👆 Select' : '✋ Pan'}
              </button>
              
              <button 
                onClick={() => setZoom(Math.max(0.5, zoom / 1.2))} 
                className="bg-muted hover:bg-muted/80 rounded-md font-bold transition-colors"
                aria-label="Zoom out"
              > 
                - 
              </button>
              
              <div className="flex items-center justify-center text-xs font-mono bg-background border rounded-md">
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
        <div className="lg:col-span-3 order-2 space-y-4">
          
          {/* Desktop Intro Box */}
          <div className="hidden lg:block bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border p-6 text-center">
            <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Select Pixels & Make History
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              Choose from {(CANVAS_WIDTH * CANVAS_HEIGHT).toLocaleString()} pixels to showcase your brand forever.
            </p>
            <div className="flex justify-center gap-2 text-xs font-medium">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded">₹99+</span>
              <span className="bg-accent/10 text-accent px-2 py-1 rounded">Permanent</span>
            </div>
            
            {/* Keyboard Shortcuts Hint */}
            {mode === 'buying' && (
              <div className="mt-4 pt-4 border-t text-left">
                <p className="text-xs font-semibold text-muted-foreground mb-2">⌨️ Shortcuts:</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Undo</span>
                    <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Cancel</span>
                    <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">ESC</kbd>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Price Breakdown Card */}
          {mode === 'buying' && selectedPixels.length > 0 && (
            <div className="hidden lg:block bg-card rounded-xl border p-4">
              <h3 className="text-sm font-semibold mb-3">Price Breakdown</h3>
              <div className="space-y-2 text-sm">
                {priceBreakdown.premium > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Premium (₹299)</span>
                    <span className="font-medium">{priceBreakdown.premium} × ₹299</span>
                  </div>
                )}
                {priceBreakdown.standard > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard (₹199)</span>
                    <span className="font-medium">{priceBreakdown.standard} × ₹199</span>
                  </div>
                )}
                {priceBreakdown.economy > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Economy (₹99)</span>
                    <span className="font-medium">{priceBreakdown.economy} × ₹99</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">₹{totalCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Sticky Stats & Tools */}
          {mode === 'buying' && (
            <div className="sticky top-4 space-y-4">
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
                />
              </div>

              <EnhancedStatsPanel selectedPixelsCount={selectedPixels.length} />
            </div>
          )}
        </div>

      </main>

      {/* --- MODALS & DIALOGS --- */}
      
      {/* Clear Selection Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Selection?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {selectedPixels.length} pixels selected (₹{totalCost.toLocaleString()}). 
              Are you sure you want to clear your selection?
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
      
      {/* Mobile Canvas Panel */}
      {mode === 'buying' && (
        <MobileCanvasPanel
          selectedPixels={selectedPixels}
          onPurchase={handlePurchase}
          totalCost={totalCost}
        />
      )}
      
      {/* Floating Action Button (Mobile fallback) */}
      {mode === 'buying' && selectedPixels.length > 0 && (
        <div className="lg:hidden">
          <FloatingActionButton 
            selectedCount={selectedPixels.length}
            onClick={handlePurchase}
          />
        </div>
      )}
    </div>
  );
};

export default BuyPixels;
