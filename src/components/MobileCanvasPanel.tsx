import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronUp, 
  ChevronDown, 
  ShoppingCart,
  Maximize2,
  Minimize2,
  Calculator,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedPixel {
  x: number;
  y: number;
  price: number;
  id: string;
}

interface MobileCanvasPanelProps {
  selectedPixels: SelectedPixel[];
  onPurchase: () => void;
  totalCost: number;
}

export const MobileCanvasPanel = ({
  selectedPixels,
  onPurchase,
  totalCost
}: MobileCanvasPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const pixelCounts = selectedPixels.reduce((acc, pixel) => {
    acc[pixel.price] = (acc[pixel.price] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const getPriceTierInfo = (price: number) => {
    switch (price) {
      case 299:
        return { name: 'Premium', color: 'text-yellow-500' };
      case 199:
        return { name: 'Standard', color: 'text-gray-500' };
      case 99:
        return { name: 'Basic', color: 'text-amber-600' };
      default:
        return { name: 'Unknown', color: 'text-muted-foreground' };
    }
  };

  if (selectedPixels.length === 0) {
    return null;
  }

  // Minimized state - just a floating indicator
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-40 lg:hidden">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full h-14 w-14 shadow-lg bg-primary hover:bg-primary/90"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {selectedPixels.length}
            </Badge>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "fixed bottom-16 left-0 right-0 z-50 lg:hidden transition-all duration-300 ease-in-out",
        isExpanded ? "h-[70vh]" : "h-auto"
      )}
    >
      <Card className="mx-2 shadow-2xl border-2 bg-card overflow-hidden">
        {/* Header - Always visible */}
        <div className="bg-gradient-primary p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Selection</span>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {selectedPixels.length}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronUp className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Quick summary - Always visible */}
          {!isExpanded && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-white/90 font-medium">Total Cost</span>
              <span className="text-2xl font-bold text-white">₹{totalCost}</span>
            </div>
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <CardContent className="p-4 max-h-[calc(70vh-140px)] overflow-y-auto space-y-4 bg-background">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{selectedPixels.length}</div>
                <div className="text-xs text-muted-foreground">Pixels</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-success">₹{totalCost}</div>
                <div className="text-xs text-muted-foreground">Total Cost</div>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-4 h-4 text-primary" />
                Pricing Breakdown
              </div>
              
              {Object.entries(pixelCounts)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([price, count]) => {
                  const tierInfo = getPriceTierInfo(Number(price));
                  const subtotal = Number(price) * count;
                  
                  return (
                    <div key={price} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${tierInfo.color}`}>
                          {tierInfo.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {count}
                        </Badge>
                      </div>
                      <span className="font-bold">₹{subtotal}</span>
                    </div>
                  );
                })}
            </div>

            {/* Smart Tip */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="text-sm font-medium text-primary mb-1">
                💡 Smart Tip
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedPixels.length < 9 && "Consider a 3×3 logo size for better visibility"}
                {selectedPixels.length >= 9 && selectedPixels.length < 25 && "Great choice! Perfect size for memorable branding"}
                {selectedPixels.length >= 25 && "Excellent! Large selections get maximum attention"}
              </div>
            </div>
          </CardContent>
        )}

        {/* Purchase Button - Always visible */}
        <div className="p-4 border-t bg-background">
          <Button
            className="w-full btn-premium bg-gradient-primary text-white border-0 h-14 text-lg font-semibold shadow-lg"
            onClick={onPurchase}
            size="lg"
          >
            <ShoppingCart className="w-6 h-6 mr-2" />
            Buy Now - ₹{totalCost}
          </Button>
        </div>
      </Card>
    </div>
  );
};
