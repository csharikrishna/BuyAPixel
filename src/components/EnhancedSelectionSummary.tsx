import { ShoppingCart, Trash2, Undo2, Sparkles, Crown, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectedPixel } from "@/types/grid";

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
    if (price === 499) return { name: "Gold", icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    if (price === 299) return { name: "Premium", icon: Target, color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20" };
    return { name: "Economy", icon: Sparkles, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
  };

  const pixelCounts = {
    gold: selectedPixels.filter(p => p.price === 499).length,
    premium: selectedPixels.filter(p => p.price === 299).length,
    economy: selectedPixels.filter(p => p.price === 99).length,
  };

  return (
    <Card className="relative overflow-hidden shadow-xl border-2 border-primary/20 bg-gradient-to-br from-card/95 to-muted/30 backdrop-blur-sm hover:shadow-glow transition-all duration-300">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />

      <CardHeader className="relative pb-4 sm:pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Your Selection
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {hasSelection ? `${selectedPixels.length} pixel${selectedPixels.length !== 1 ? 's' : ''} selected` : 'No pixels yet'}
              </CardDescription>
            </div>
          </div>
          {hasSelection && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndoLastSelection}
                className="h-9 w-9 p-0 hover:bg-primary/10 transition-all hover:scale-110 rounded-lg"
                title="Undo last selection"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive transition-all hover:scale-110 rounded-lg"
                title="Clear all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-5 sm:space-y-6">
        {hasSelection ? (
          <>
            {/* Price Breakdown */}
            <div className="space-y-3">
              {pixelCounts.gold > 0 && (
                <div className={`flex justify-between items-center p-3.5 sm:p-4 rounded-xl ${getPriceTierInfo(499).bg} border ${getPriceTierInfo(499).border} transition-all hover:scale-[1.02]`}>
                  <span className="text-sm font-medium flex items-center gap-2.5">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span className={getPriceTierInfo(499).color}>Gold ({pixelCounts.gold})</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">₹{(pixelCounts.gold * 499).toLocaleString()}</span>
                </div>
              )}
              {pixelCounts.premium > 0 && (
                <div className={`flex justify-between items-center p-3.5 sm:p-4 rounded-xl ${getPriceTierInfo(299).bg} border ${getPriceTierInfo(299).border} transition-all hover:scale-[1.02]`}>
                  <span className="text-sm font-medium flex items-center gap-2.5">
                    <Target className="h-4 w-4 text-violet-400" />
                    <span className={getPriceTierInfo(299).color}>Premium ({pixelCounts.premium})</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">₹{(pixelCounts.premium * 299).toLocaleString()}</span>
                </div>
              )}
              {pixelCounts.economy > 0 && (
                <div className={`flex justify-between items-center p-3.5 sm:p-4 rounded-xl ${getPriceTierInfo(99).bg} border ${getPriceTierInfo(99).border} transition-all hover:scale-[1.02]`}>
                  <span className="text-sm font-medium flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    <span className={getPriceTierInfo(99).color}>Economy ({pixelCounts.economy})</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">₹{(pixelCounts.economy * 99).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="pt-2 border-t-2 border-primary/20">
              <div className="flex justify-between items-center p-4 sm:p-5 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary/30">
                <span className="text-base sm:text-lg font-bold text-foreground">Total Cost</span>
                <span className="text-xl sm:text-2xl font-extrabold bg-gradient-primary bg-clip-text text-transparent tabular-nums">
                  ₹{totalCost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Purchase Button */}
            <Button
              onClick={onPurchase}
              className="w-full h-12 sm:h-13 text-base font-semibold shadow-xl hover:shadow-glow transition-all hover:scale-105 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl"
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Proceed to Purchase
            </Button>

            {/* Smart Tip */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-4">
              <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Smart Tip
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                {selectedPixels.length < 9 && "Consider a 3×3 logo size for better visibility"}
                {selectedPixels.length >= 9 && selectedPixels.length < 25 && "Great choice! Perfect size for memorable branding"}
                {selectedPixels.length >= 25 && "Excellent! Large selections get maximum attention"}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 sm:py-10">
            <div className="mb-4 sm:mb-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                <ShoppingCart className="h-10 w-10 sm:h-12 sm:w-12 text-primary/50" />
              </div>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground font-medium mb-2">Start selecting pixels</p>
            <p className="text-xs sm:text-sm text-muted-foreground/70">Click on the canvas to add pixels to your cart</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
