import { ShoppingCart, Trash2, Undo2, Sparkles, Crown, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SelectedPixel {
  x: number;
  y: number;
  price: number;
  id: string;
}

interface EnhancedSelectionSummaryProps {
  selectedPixels: SelectedPixel[];
  onClearSelection: () => void;
  onUndoLastSelection: () => void;
  onPurchase: () => void;
}

export const EnhancedSelectionSummary = ({
  selectedPixels,
  onClearSelection,
  onUndoLastSelection,
  onPurchase
}: EnhancedSelectionSummaryProps) => {
  const totalCost = selectedPixels.reduce((sum, pixel) => sum + pixel.price, 0);
  const hasSelection = selectedPixels.length > 0;

  const getPriceTierInfo = (price: number) => {
    if (price === 299) return { name: "Premium", icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" };
    if (price === 199) return { name: "Standard", icon: Target, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" };
    return { name: "Basic", icon: Sparkles, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" };
  };

  const pixelCounts = {
    premium: selectedPixels.filter(p => p.price === 299).length,
    standard: selectedPixels.filter(p => p.price === 199).length,
    basic: selectedPixels.filter(p => p.price === 99).length,
  };

  return (
    <Card className="relative overflow-hidden shadow-xl border-2 border-primary/20 bg-gradient-to-br from-card/95 to-muted/30 backdrop-blur-sm hover:shadow-glow transition-all duration-300">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      
      <CardHeader className="relative pb-3 sm:pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Your Selection
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                {hasSelection ? `${selectedPixels.length} pixel${selectedPixels.length !== 1 ? 's' : ''} selected` : 'No pixels selected yet'}
              </CardDescription>
            </div>
          </div>
          {hasSelection && (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndoLastSelection}
                className="h-8 w-8 p-0 hover:bg-primary/10 transition-all hover:scale-110"
                title="Undo last selection"
              >
                <Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-all hover:scale-110"
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-3 sm:space-y-4">
        {hasSelection ? (
          <>
            {/* Price Breakdown */}
            <div className="space-y-2">
              {pixelCounts.premium > 0 && (
                <div className={`flex justify-between items-center p-2 sm:p-3 rounded-lg ${getPriceTierInfo(299).bg} border ${getPriceTierInfo(299).border} transition-all hover:scale-[1.02]`}>
                  <span className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Crown className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
                    <span className={getPriceTierInfo(299).color}>Premium ({pixelCounts.premium})</span>
                  </span>
                  <span className="text-xs sm:text-sm font-bold">₹{(pixelCounts.premium * 299).toLocaleString()}</span>
                </div>
              )}
              {pixelCounts.standard > 0 && (
                <div className={`flex justify-between items-center p-2 sm:p-3 rounded-lg ${getPriceTierInfo(199).bg} border ${getPriceTierInfo(199).border} transition-all hover:scale-[1.02]`}>
                  <span className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Target className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                    <span className={getPriceTierInfo(199).color}>Standard ({pixelCounts.standard})</span>
                  </span>
                  <span className="text-xs sm:text-sm font-bold">₹{(pixelCounts.standard * 199).toLocaleString()}</span>
                </div>
              )}
              {pixelCounts.basic > 0 && (
                <div className={`flex justify-between items-center p-2 sm:p-3 rounded-lg ${getPriceTierInfo(99).bg} border ${getPriceTierInfo(99).border} transition-all hover:scale-[1.02]`}>
                  <span className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-orange-400" />
                    <span className={getPriceTierInfo(99).color}>Basic ({pixelCounts.basic})</span>
                  </span>
                  <span className="text-xs sm:text-sm font-bold">₹{(pixelCounts.basic * 99).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="pt-3 border-t-2 border-primary/20">
              <div className="flex justify-between items-center p-3 sm:p-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary/30">
                <span className="text-sm sm:text-base font-bold text-foreground">Total Cost</span>
                <span className="text-lg sm:text-xl md:text-2xl font-extrabold bg-gradient-primary bg-clip-text text-transparent">
                  ₹{totalCost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Purchase Button */}
            <Button 
              onClick={onPurchase}
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-bold shadow-xl hover:shadow-glow transition-all hover:scale-105 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              <ShoppingCart className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Proceed to Purchase
            </Button>

            {/* Smart Tip */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg p-3">
              <div className="text-xs sm:text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                Smart Tip
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedPixels.length < 9 && "Consider a 3×3 logo size for better visibility"}
                {selectedPixels.length >= 9 && selectedPixels.length < 25 && "Great choice! Perfect size for memorable branding"}
                {selectedPixels.length >= 25 && "Excellent! Large selections get maximum attention"}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6 sm:py-8">
            <div className="mb-3 sm:mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-primary/50" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Start selecting pixels on the canvas</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground/70">Click on pixels to add them to your cart</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
