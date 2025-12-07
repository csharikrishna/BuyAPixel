import { useState, useCallback } from "react";
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

// --- Interfaces ---
interface SelectedPixel {
  x: number;
  y: number;
  price: number;
  id: string;
}

const BuyPixels = () => {
  const { user } = useAuth();
  
  // --- State ---
  const [selectedPixels, setSelectedPixels] = useState<SelectedPixel[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isSelecting, setIsSelecting] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showMyPixels, setShowMyPixels] = useState(false);
  const [showPurchasePreview, setShowPurchasePreview] = useState(false);
  
  // History for Undo functionality
  const [selectionHistory, setSelectionHistory] = useState<SelectedPixel[][]>([]);

  // --- Constants ---
  const CANVAS_WIDTH = 150;
  const CANVAS_HEIGHT = 150;
  const PIXEL_SIZE = 4;

  // --- Logic ---
  const calculatePixelPrice = useCallback((x: number, y: number) => {
    const centerX = CANVAS_WIDTH / 2.0;
    const centerY = CANVAS_HEIGHT / 2.0;
    const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
    const normalizedDistance = distanceFromCenter / maxDistance;
    
    // Pricing Tiers
    if (normalizedDistance < 0.212) return 299; // Premium
    if (normalizedDistance < 0.424) return 199; // Standard
    return 99; // Economy
  }, []);

  const handleSelectionChange = useCallback((pixels: SelectedPixel[]) => {
    // Save current state to history before updating (Limit history to last 10 steps)
    setSelectionHistory(prev => [...prev.slice(-10), selectedPixels]); 
    setSelectedPixels(pixels);
  }, [selectedPixels]);

  const handleUndoLastSelection = useCallback(() => {
    if (selectionHistory.length > 0) {
      const previousState = selectionHistory[selectionHistory.length - 1];
      setSelectedPixels(previousState);
      setSelectionHistory(prev => prev.slice(0, -1));
      toast.success("Undo successful");
    }
  }, [selectionHistory]);

  const handleClearSelection = useCallback(() => {
    setSelectionHistory(prev => [...prev, selectedPixels]);
    setSelectedPixels([]);
    toast.success("Selection cleared");
  }, [selectedPixels]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    toast.info("View reset");
  }, []);

  const handlePurchase = useCallback(() => {
    if (!user) {
      toast.error("Please sign in to buy pixels", {
        description: "Create an account or log in to purchase pixels",
        action: {
          label: "Sign In",
          onClick: () => window.location.href = '/signin'
        }
      });
      return;
    }
    if (selectedPixels.length === 0) {
      toast.error("Please select pixels to purchase");
      return;
    }
    setShowPurchasePreview(true);
  }, [user, selectedPixels.length]);

  const totalCost = selectedPixels.reduce((sum, pixel) => sum + pixel.price, 0);

  const handleConfirmPurchase = useCallback(async (pixelName: string, linkUrl: string, imageUrl: string | null) => {
    if (!user || selectedPixels.length === 0) return;

    const now = new Date().toISOString();
    try {
      const batchSize = 10;
      const totalBatches = Math.ceil(selectedPixels.length / batchSize);
      let successCount = 0;
      
      for (let i = 0; i < totalBatches; i++) {
        const batch = selectedPixels.slice(i * batchSize, (i + 1) * batchSize);
        
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
            .is('owner_id', null); // Optimistic Locking
        });

        const results = await Promise.all(updates);
        
        results.forEach(result => {
          if (!result.error) successCount++;
        });
      }

      if (successCount === 0) {
        toast.error("These pixels were just purchased by someone else!");
        return;
      }
      
      if (successCount < selectedPixels.length) {
        toast.warning(`Purchased ${successCount} pixels. Some were already taken.`);
      } else {
        toast.success(`🎉 Successfully purchased ${selectedPixels.length} pixels!`);
      }
      
      setShowPurchasePreview(false);
      setSelectedPixels([]);
      setSelectionHistory([]);
      
      setTimeout(() => {
        toast.message("Purchase complete!", {
          description: "View your pixels in your profile.",
          action: {
            label: "Go to Profile",
            onClick: () => window.location.href = '/profile'
          }
        });
      }, 500);
      
    } catch (err) {
      console.error('Purchase failed:', err);
      toast.error("Purchase failed. Please try again.");
    }
  }, [user, selectedPixels]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OnboardingTutorial />
      <Header />
      
      {/* --- MAIN LAYOUT --- */}
      <main className="flex-1 container mx-auto px-2 sm:px-4 lg:px-6 py-4 flex flex-col lg:grid lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CANVAS (Top on Mobile) */}
        <div className="lg:col-span-9 order-1 flex flex-col gap-4">
          
          {/* Mobile Title Strip */}
          <div className="lg:hidden flex items-center justify-between px-1 mb-2">
            <div>
               <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Digital Space
               </h1>
               <p className="text-xs text-muted-foreground">Select pixels & make history</p>
            </div>
            <div className="text-xs font-mono bg-accent/10 text-accent px-2 py-1 rounded">
              {(CANVAS_WIDTH * CANVAS_HEIGHT).toLocaleString()} px
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="w-full relative z-0">
             {/* Desktop Toolbar (Floating above canvas or standard) */}
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

             {/* THE GRID */}
             <div className="w-full rounded-xl shadow-2xl border bg-card overflow-hidden h-[65vh] sm:h-[70vh] lg:h-[80vh]">
              <VirtualizedPixelGrid
                selectedPixels={selectedPixels}
                onSelectionChange={handleSelectionChange}
                isSelecting={isSelecting}
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

          {/* Mobile Controls Bar (Immediately below canvas) */}
          <div className="lg:hidden grid grid-cols-5 gap-2 bg-card p-2 rounded-lg border shadow-sm">
             <button
               onClick={() => setIsSelecting(!isSelecting)}
               className={`col-span-2 flex items-center justify-center gap-2 h-10 rounded-md text-sm font-medium transition-colors ${
                 isSelecting ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
               }`}
             >
               {isSelecting ? '👆 Select' : '✋ Pan'}
             </button>
             
             <button onClick={() => setZoom(Math.max(0.5, zoom / 1.2))} className="bg-muted hover:bg-muted/80 rounded-md font-bold"> - </button>
             <div className="flex items-center justify-center text-xs font-mono bg-background border rounded-md">
               {Math.round(zoom * 100)}%
             </div>
             <button onClick={() => setZoom(Math.min(8, zoom * 1.2))} className="bg-muted hover:bg-muted/80 rounded-md font-bold"> + </button>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR (Info & Stats) */}
        <div className="lg:col-span-3 order-2 space-y-4">
          
          {/* Desktop Intro Box */}
          <div className="hidden lg:block bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border p-6 text-center">
            <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Own Digital Space
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              Select pixels on the grid to showcase your brand forever.
            </p>
            <div className="flex justify-center gap-2 text-xs font-medium">
               <span className="bg-primary/10 text-primary px-2 py-1 rounded">₹99+</span>
               <span className="bg-accent/10 text-accent px-2 py-1 rounded">Permanent</span>
            </div>
          </div>

          {/* Sticky Stats & Tools */}
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
        </div>

      </main>

      {/* --- MODALS --- */}
      
      <PurchasePreview
        isOpen={showPurchasePreview}
        onClose={() => setShowPurchasePreview(false)}
        selectedPixels={selectedPixels}
        onConfirmPurchase={handleConfirmPurchase}
      />
      
      <MobileCanvasPanel
        selectedPixels={selectedPixels}
        onPurchase={handlePurchase}
        totalCost={totalCost}
      />
      
      {/* Floating Action Button (Mobile Only fallback if selected) */}
      <div className={selectedPixels.length > 0 ? "hidden" : "block lg:hidden"}>
        <FloatingActionButton 
          selectedCount={selectedPixels.length}
          onClick={handlePurchase}
        />
      </div>
    </div>
  );
};

export default BuyPixels;