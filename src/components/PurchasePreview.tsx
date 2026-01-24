import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingCart,
  CreditCard,
  MapPin,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/ImageUpload";

// Razorpay type declarations
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme: {
    color: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}


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
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null);
  const [pixelName, setPixelName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window.Razorpay !== 'undefined') {
      setRazorpayLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => console.error('Failed to load Razorpay script');
    document.body.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

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

  // Validate URL format
  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Optional field
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleLinkUrlChange = (value: string) => {
    setLinkUrl(value);
    if (value && !validateUrl(value)) {
      setLinkUrlError("Please enter a valid URL (e.g., https://example.com)");
    } else {
      setLinkUrlError(null);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!pixelName.trim()) {
      toast.error("Please enter a pixel name");
      return;
    }

    if (linkUrl && !validateUrl(linkUrl)) {
      toast.error("Please enter a valid URL");
      return;
    }

    if (!razorpayLoaded) {
      toast.error("Payment system is loading. Please wait...");
      return;
    }

    setIsProcessing(true);

    try {
      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        setIsProcessing(false);
        return;
      }

      // Step 1: Create Razorpay order
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            pixels: selectedPixels.map(p => ({ x: p.x, y: p.y, price: p.price })),
            totalAmount: totalCost,
            imageUrl: imagePreview,
            linkUrl: linkUrl,
            altText: pixelName,
          },
        }
      );

      if (orderError || !orderData?.success) {
        throw new Error(orderData?.error || 'Failed to create payment order');
      }

      // Step 2: Open Razorpay checkout
      const options: RazorpayOptions = {
        key: orderData.order.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'BuyAPixel',
        description: `Purchase ${selectedPixels.length} pixel${selectedPixels.length > 1 ? 's' : ''}`,
        order_id: orderData.order.razorpay_order_id,
        handler: async (response: RazorpayResponse) => {
          // Step 3: Verify payment
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              'verify-razorpay-payment',
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  payment_order_id: orderData.order.id,
                  image_url: imagePreview,
                  link_url: linkUrl,
                  alt_text: pixelName,
                },
              }
            );

            if (verifyError || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }

            // Success! Call the original onConfirmPurchase for any additional handling
            await onConfirmPurchase(pixelName, linkUrl, imagePreview);

            toast.success("🎉 Payment successful! Your pixels are now live on the canvas!", {
              duration: 5000
            });

            // Reset form
            setPixelName("");
            setLinkUrl("");
            setLinkUrlError(null);
            setImagePreview(null);
            onClose();

          } catch (verifyErr) {
            console.error('Payment verification error:', verifyErr);
            toast.error("Payment verification failed. Please contact support.");
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: orderData.user?.name || '',
          email: orderData.user?.email || '',
          contact: '', // Allow user to enter phone number
        },
        theme: {
          color: '#10B981', // Primary green color
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info("Payment cancelled");
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to initiate payment");
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
    <div className="space-y-6">
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
              onChange={(e) => handleLinkUrlChange(e.target.value)}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-base ${linkUrlError ? 'border-destructive' : 'border-border'
                }`}
            />
            {linkUrlError && (
              <p className="text-xs text-destructive mt-1">{linkUrlError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Image Upload</label>
            <ImageUpload
              onImageUploaded={(url) => setImagePreview(url)}
              currentImage={imagePreview || ''}
              folder="user-pixels"
              bucket="pixel-images"
              cropAspectRatio={1}
              placeholder="Upload Pixel Image"
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Secure Payment Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-start gap-2 md:gap-3">
            <Shield className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <div className="text-sm md:text-base font-medium text-primary">Secure Payment via Razorpay</div>
              <div className="text-xs md:text-sm text-muted-foreground">
                Pay securely using UPI, Credit/Debit Cards, Net Banking, or Wallets.
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
