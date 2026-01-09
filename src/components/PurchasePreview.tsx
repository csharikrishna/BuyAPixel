import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingCart,
  CreditCard,
  MapPin,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/ImageUpload";

interface SelectedPixel {
  x: number;
  y: number;
  price: number;
  id: string;
}

interface PurchasePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPixels: SelectedPixel[];
  onConfirmPurchase: (pixelName: string, linkUrl: string, imageUrl: string | null) => void;
}

export const PurchasePreview = ({
  isOpen,
  onClose,
  selectedPixels,
  onConfirmPurchase
}: PurchasePreviewProps) => {
  const isMobile = useIsMobile();
  const [isProcessing, setIsProcessing] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [pixelName, setPixelName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // File handlers removed as ImageUpload handles them internally

  const totalCost = selectedPixels.reduce((sum, pixel) => sum + pixel.price, 0);
  const pixelCounts = selectedPixels.reduce((acc, pixel) => {
    acc[pixel.price] = (acc[pixel.price] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const getSelectionInfo = () => {
    if (selectedPixels.length === 0) return null;

    const xCoords = selectedPixels.map(p => p.x);
    const yCoords = selectedPixels.map(p => p.y);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    return {
      range: { x: { min: minX, max: maxX }, y: { min: minY, max: maxY } },
      dimensions: { width: maxX - minX + 1, height: maxY - minY + 1 },
      area: selectedPixels.length
    };
  };

  const selectionInfo = getSelectionInfo();

  const handleConfirmPurchase = async () => {
    if (!pixelName.trim()) {
      toast.error("Please enter a pixel name");
      return;
    }

    setIsProcessing(true);
    try {
      // Image is already uploaded by ImageUpload component if imagePreview exists
      const imageUrl = imagePreview;

      await new Promise(resolve => setTimeout(resolve, 1500));

      await onConfirmPurchase(pixelName, linkUrl, imageUrl);
      toast.success("🎉 Purchase successful! Your pixels are now yours and visible on the canvas!", {
        duration: 5000
      });
      onClose();

      setPixelName("");
      setLinkUrl("");
      setImagePreview(null);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error("Failed to process purchase");
    } finally {
      setIsProcessing(false);
    }
  };

  const getPriceTierInfo = (price: number) => {
    switch (price) {
      case 299:
        return { name: 'Premium', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
      case 199:
        return { name: 'Standard', color: 'bg-gray-500', textColor: 'text-gray-700' };
      case 99:
        return { name: 'Basic', color: 'bg-amber-600', textColor: 'text-amber-700' };
      default:
        return { name: 'Unknown', color: 'bg-muted', textColor: 'text-muted-foreground' };
    }
  };

  const purchaseContent = (
    <div className="space-y-6 md:space-y-6">
      {/* Connectivity Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 md:p-4 flex gap-3 text-yellow-700 dark:text-yellow-400">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-xs md:text-sm leading-relaxed">
          <strong>Stable Connection Required:</strong> Before proceeding, please verify that you have a stable and reliable
          internet connection to ensure optimal performance of this web application. This webpage may consume higher bandwidth
          due to dynamic content and advertisements, which can lead to slow loading, interruptions, or incomplete rendering
          on unstable networks. If you are experiencing latency, buffering, or connectivity drops, it is strongly recommended
          to switch to a high-speed, stable Wi-Fi connection for a seamless and uninterrupted experience.
        </div>
      </div>

      {/* Selection Overview */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            Selection Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="text-center p-2 md:p-3 rounded-lg bg-primary/10">
              <div className="text-xl md:text-2xl font-bold text-primary">{selectedPixels.length}</div>
              <div className="text-xs md:text-sm text-muted-foreground">Pixels</div>
            </div>
            <div className="text-center p-2 md:p-3 rounded-lg bg-success/10">
              <div className="text-xl md:text-2xl font-bold text-success">₹{totalCost}</div>
              <div className="text-xs md:text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 md:p-3 rounded-lg bg-accent/10">
              <div className="text-xl md:text-2xl font-bold text-accent">
                {selectionInfo ? `${selectionInfo.dimensions.width}×${selectionInfo.dimensions.height}` : '—'}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">Size</div>
            </div>
          </div>

          {selectionInfo && (
            <div className="grid grid-cols-2 gap-2 md:gap-4 mt-4">
              <div className="bg-muted/30 rounded-lg p-2 md:p-3">
                <div className="text-xs md:text-sm font-medium mb-1">X Range</div>
                <div className="font-mono text-xs md:text-sm">
                  {selectionInfo.range.x.min} → {selectionInfo.range.x.max}
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 md:p-3">
                <div className="text-xs md:text-sm font-medium mb-1">Y Range</div>
                <div className="font-mono text-xs md:text-sm">
                  {selectionInfo.range.y.min} → {selectionInfo.range.y.max}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Breakdown */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            Pricing Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(pixelCounts)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([price, count]) => {
              const tierInfo = getPriceTierInfo(Number(price));
              const subtotal = Number(price) * count;

              return (
                <div key={price} className="flex items-center justify-between p-2 md:p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${tierInfo.color}`} />
                    <div>
                      <div className="text-sm md:text-base font-medium">{tierInfo.name}</div>
                      <div className="text-xs md:text-sm text-muted-foreground">
                        ₹{price} × {count}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm md:text-base font-bold">₹{subtotal}</div>
                  </div>
                </div>
              );
            })}

          <Separator />

          <div className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="font-semibold text-base md:text-lg">Total</div>
            <div className="text-xl md:text-2xl font-bold text-primary">₹{totalCost}</div>
          </div>
        </CardContent>
      </Card>

      {/* Pixel Information Form */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            Pixel Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Pixel Name</label>
            <input
              type="text"
              placeholder="Enter a name for your pixels"
              value={pixelName}
              onChange={(e) => setPixelName(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Redirection Link (Optional)</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Image Upload</label>
            <ImageUpload
              onImageUploaded={(url) => {
                // We need to fetch the file blob if we want to upload it during purchase, 
                // OR we can trust that ImageUpload already uploaded it to 'pixel-images' bucket.
                // The current PurchasePreview logic expects us to upload later. 
                // However, ImageUpload uploads immediately.
                // We should adapt PurchasePreview to use the returned URL directly.
                setImagePreview(url);
                // We don't have the File object anymore, but we have the URL.
                // We need to update handleConfirmPurchase to skip upload if we already have a URL.
              }}
              currentImage={imagePreview || ''}
              folder="user-pixels"
              bucket="blog-images"
              cropAspectRatio={1}
              placeholder="Upload Pixel Image"
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Terms & Security */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-start gap-2 md:gap-3">
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-accent mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <div className="text-sm md:text-base font-medium text-accent">Mock Purchase</div>
              <div className="text-xs md:text-sm text-muted-foreground">
                This is a demo. Your pixels will be marked without payment.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[95vh] flex flex-col">
          <DrawerHeader className="border-b pb-3 px-4 flex-shrink-0">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="w-6 h-6 text-primary" />
              Purchase Preview
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              Review your selection and complete your purchase
            </DrawerDescription>
          </DrawerHeader>

          <div
            className="flex-1 overflow-y-auto px-4 py-6"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
          >
            {purchaseContent}
          </div>

          {/* Sticky Action Buttons for Mobile */}
          <div className="sticky bottom-0 bg-background border-t p-4 flex-shrink-0 safe-area-bottom">
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-12 text-base"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPurchase}
                disabled={isProcessing}
                className="flex-1 h-12 bg-gradient-primary hover:shadow-glow text-white border-0 font-semibold text-base"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    <span>Buy Now</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Purchase Preview
          </DialogTitle>
          <DialogDescription>
            Review your pixel selection and complete your purchase.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          {purchaseContent}

          {/* Action Buttons for Desktop */}
          <div className="flex gap-4 pt-6 border-t mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              disabled={isProcessing}
              className="flex-1 h-10 bg-gradient-primary hover:shadow-glow text-white border-0 font-semibold"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  <span>Proceed to Payment</span>
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
