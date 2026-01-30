import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ShoppingCart,
  CreditCard,
  MapPin,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Shield,
  CheckCircle2,
  Info,
  Lock,
  Wallet,
  Building2,
  Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/ImageUpload";
import { Helmet } from "react-helmet-async";

// Razorpay type declarations (existing)
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
    escape?: boolean;
    backdropclose?: boolean;
    animation?: boolean;
  };
  retry?: {
    enabled: boolean;
    max_count?: number;
  };
  timeout?: number;
  notes?: Record<string, string>;
  config?: {
    display: {
      hide?: Array<{ method: string }>;
      preferences?: {
        show_default_blocks?: boolean;
      };
    };
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: () => void) => void;
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

// Form validation step [web:140]
type CheckoutStep = 'details' | 'payment' | 'confirmation';

export const PurchasePreview = ({
  isOpen,
  onClose,
  selectedPixels,
  onConfirmPurchase
}: PurchasePreviewProps) => {
  const isMobile = useIsMobile();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('details');

  // Form fields with validation states [web:145][web:148]
  const [linkUrl, setLinkUrl] = useState("");
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null);
  const [linkUrlTouched, setLinkUrlTouched] = useState(false);

  const [pixelName, setPixelName] = useState("");
  const [pixelNameError, setPixelNameError] = useState<string | null>(null);
  const [pixelNameTouched, setPixelNameTouched] = useState(false);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [formProgress, setFormProgress] = useState(0);

  // Refs for accessibility [web:148]
  const firstErrorRef = useRef<HTMLInputElement>(null);
  const pixelNameRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);

  // Auto-save to localStorage [web:140]
  useEffect(() => {
    if (isOpen) {
      const savedData = localStorage.getItem('checkout-draft');
      if (savedData) {
        try {
          const { pixelName: savedName, linkUrl: savedLink } = JSON.parse(savedData);
          if (savedName) setPixelName(savedName);
          if (savedLink) setLinkUrl(savedLink);
        } catch (e) {
          console.error('Failed to restore checkout data');
        }
      }
    }
  }, [isOpen]);

  // Auto-save draft [web:140]
  useEffect(() => {
    if (pixelName || linkUrl) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem('checkout-draft', JSON.stringify({ pixelName, linkUrl }));
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [pixelName, linkUrl]);

  // Calculate form completion progress [web:140]
  useEffect(() => {
    let progress = 0;
    if (pixelName.trim()) progress += 40;
    if (!linkUrlError && linkUrl) progress += 30;
    if (imagePreview) progress += 30;
    setFormProgress(progress);
  }, [pixelName, linkUrl, linkUrlError, imagePreview]);

  // Load Razorpay script with retry logic [web:144]
  useEffect(() => {
    if (typeof window.Razorpay !== 'undefined') {
      setRazorpayLoaded(true);
      return;
    }

    let retries = 0;
    const maxRetries = 3;

    const loadScript = () => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        setRazorpayLoaded(true);
        toast.success('Payment gateway loaded', { duration: 2000 });
      };
      script.onerror = () => {
        retries++;
        if (retries < maxRetries) {
          console.warn(`Razorpay script load failed, retrying... (${retries}/${maxRetries})`);
          setTimeout(loadScript, 2000 * retries);
        } else {
          console.error('Failed to load Razorpay script after multiple attempts');
          toast.error('Payment gateway failed to load. Please refresh the page.');
        }
      };
      document.body.appendChild(script);
    };

    loadScript();
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

  // Enhanced URL validation with common patterns [web:145]
  const validateUrl = (url: string): { valid: boolean; error?: string } => {
    if (!url) return { valid: true }; // Optional field

    // Remove whitespace
    url = url.trim();

    // Check for common typos
    if (url.startsWith('www.') && !url.includes('://')) {
      return { valid: false, error: "URL must start with http:// or https://" };
    }

    try {
      const urlObj = new URL(url);

      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
      }

      // Check for localhost in production
      if (process.env.NODE_ENV === 'production' &&
        (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')) {
        return { valid: false, error: "Localhost URLs are not allowed" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Please enter a valid URL (e.g., https://example.com)" };
    }
  };

  // Validate pixel name [web:148]
  const validatePixelName = (name: string): { valid: boolean; error?: string } => {
    if (!name.trim()) {
      return { valid: false, error: "Pixel name is required" };
    }
    if (name.trim().length < 2) {
      return { valid: false, error: "Pixel name must be at least 2 characters" };
    }
    if (name.trim().length > 100) {
      return { valid: false, error: "Pixel name must be less than 100 characters" };
    }
    // Check for inappropriate content (basic check)
    const inappropriateWords = ['spam', 'scam', 'test123'];
    if (inappropriateWords.some(word => name.toLowerCase().includes(word))) {
      return { valid: false, error: "Please choose a different name" };
    }
    return { valid: true };
  };

  // Real-time validation handlers [web:145]
  const handlePixelNameChange = (value: string) => {
    setPixelName(value);
    if (pixelNameTouched) {
      const validation = validatePixelName(value);
      setPixelNameError(validation.valid ? null : validation.error!);
    }
  };

  const handlePixelNameBlur = () => {
    setPixelNameTouched(true);
    const validation = validatePixelName(pixelName);
    setPixelNameError(validation.valid ? null : validation.error!);
  };

  const handleLinkUrlChange = (value: string) => {
    setLinkUrl(value);
    if (linkUrlTouched || value) {
      const validation = validateUrl(value);
      setLinkUrlError(validation.valid ? null : validation.error!);
    }
  };

  const handleLinkUrlBlur = () => {
    setLinkUrlTouched(true);
    const validation = validateUrl(linkUrl);
    setLinkUrlError(validation.valid ? null : validation.error!);
  };

  // Validate entire form [web:148]
  const validateForm = (): boolean => {
    let isValid = true;

    // Validate pixel name
    const nameValidation = validatePixelName(pixelName);
    if (!nameValidation.valid) {
      setPixelNameError(nameValidation.error!);
      setPixelNameTouched(true);
      isValid = false;
    }

    // Validate URL if provided
    const urlValidation = validateUrl(linkUrl);
    if (!urlValidation.valid) {
      setLinkUrlError(urlValidation.error!);
      setLinkUrlTouched(true);
      isValid = false;
    }

    // Focus on first error [web:148]
    if (!isValid) {
      setTimeout(() => {
        if (pixelNameError) {
          pixelNameRef.current?.focus();
        } else if (linkUrlError) {
          linkUrlRef.current?.focus();
        }
      }, 100);
    }

    return isValid;
  };

  const handleConfirmPurchase = async () => {
    // Validate form before proceeding [web:140]
    if (!validateForm()) {
      toast.error("Please fix the errors before continuing", {
        description: "Check the highlighted fields"
      });
      return;
    }

    if (!razorpayLoaded) {
      toast.error("Payment system is loading. Please wait...");
      return;
    }

    setIsProcessing(true);
    setCurrentStep('payment');

    try {
      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        setIsProcessing(false);
        setCurrentStep('details');
        return;
      }

      // Step 1: Create Razorpay order [web:144]
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            pixels: selectedPixels.map(p => ({ x: p.x, y: p.y, price: p.price })),
            totalAmount: totalCost,
            imageUrl: imagePreview,
            linkUrl: linkUrl.trim() || null,
            altText: pixelName.trim(),
          },
        }
      );

      if (orderError || !orderData?.success) {
        throw new Error(orderData?.error || 'Failed to create payment order');
      }

      // Step 2: Open Razorpay checkout with enhanced options [web:144]
      const options: RazorpayOptions = {
        key: orderData.order.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'BuyAPixel.in',
        description: `${selectedPixels.length} pixel${selectedPixels.length > 1 ? 's' : ''} - ${pixelName.trim()}`,
        order_id: orderData.order.razorpay_order_id,
        handler: async (response: RazorpayResponse) => {
          setCurrentStep('confirmation');

          // Step 3: Verify payment [web:147]
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
                  link_url: linkUrl.trim() || null,
                  alt_text: pixelName.trim(),
                },
              }
            );

            if (verifyError || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }

            // Success! Call the original onConfirmPurchase
            await onConfirmPurchase(pixelName.trim(), linkUrl.trim(), imagePreview);

            toast.success("🎉 Payment successful!", {
              description: "Your pixels are now live on the canvas",
              duration: 5000
            });

            // Clear form and localStorage
            setPixelName("");
            setLinkUrl("");
            setLinkUrlError(null);
            setPixelNameError(null);
            setImagePreview(null);
            setPixelNameTouched(false);
            setLinkUrlTouched(false);
            localStorage.removeItem('checkout-draft');

            onClose();

          } catch (verifyErr) {
            console.error('Payment verification error:', verifyErr);
            toast.error("Payment verification failed", {
              description: "Please contact support with your order ID"
            });
          } finally {
            setIsProcessing(false);
            setCurrentStep('details');
          }
        },
        prefill: {
          name: orderData.user?.name || '',
          email: orderData.user?.email || '',
          contact: orderData.user?.phone || '',
        },
        theme: {
          color: '#10B981',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setCurrentStep('details');
            toast.info("Payment cancelled");
          },
          escape: true,
          backdropclose: false,
          animation: true,
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
        timeout: 900, // 15 minutes
        notes: {
          pixel_count: String(selectedPixels.length),
          pixel_name: pixelName.trim(),
        },
      };

      const razorpay = new window.Razorpay(options);

      // Handle payment failures [web:144]
      (razorpay as any).on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast.error("Payment failed", {
          description: response.error.description || "Please try again"
        });
        setIsProcessing(false);
        setCurrentStep('details');
      });

      razorpay.open();

    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to initiate payment");
      setIsProcessing(false);
      setCurrentStep('details');
    }
  };

  const getPriceTierInfo = (price: number) => {
    switch (price) {
      case 299:
        return { name: 'Premium', color: 'bg-yellow-500', textColor: 'text-yellow-700', badge: '⭐' };
      case 199:
        return { name: 'Standard', color: 'bg-blue-500', textColor: 'text-blue-700', badge: '🔵' };
      case 99:
        return { name: 'Basic', color: 'bg-green-500', textColor: 'text-green-700', badge: '🟢' };
      default:
        return { name: 'Unknown', color: 'bg-muted', textColor: 'text-muted-foreground', badge: '⚪' };
    }
  };

  const purchaseContent = (
    <div className="space-y-6">
      {/* SEO and Metadata */}
      <Helmet>
        <title>Checkout - BuyAPixel.in</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Progress Indicator [web:140] */}
      {formProgress > 0 && formProgress < 100 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Form Completion</span>
              <span className="text-sm text-muted-foreground">{formProgress}%</span>
            </div>
            <Progress value={formProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {formProgress < 40 && "Add a pixel name to continue"}
              {formProgress >= 40 && formProgress < 70 && "Optionally add a link"}
              {formProgress >= 70 && formProgress < 100 && "Upload an image (optional)"}
              {formProgress === 100 && "All set! Ready to purchase ✨"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Selection Overview */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" aria-hidden="true" />
            Selection Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="text-center p-2 md:p-3 rounded-lg bg-primary/10">
              <div className="text-xl md:text-2xl font-bold text-primary" aria-label={`${selectedPixels.length} pixels`}>
                {selectedPixels.length}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">Pixels</div>
            </div>
            <div className="text-center p-2 md:p-3 rounded-lg bg-green-500/10">
              <div className="text-xl md:text-2xl font-bold text-green-600" aria-label={`Total cost: ${totalCost} rupees`}>
                ₹{totalCost}
              </div>
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
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" aria-hidden="true" />
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
                <div
                  key={price}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg border bg-card"
                  role="row"
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-lg" aria-hidden="true">{tierInfo.badge}</span>
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

          <div
            className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-primary/10 border border-primary/20"
            role="row"
          >
            <div className="font-semibold text-base md:text-lg">Total</div>
            <div className="text-xl md:text-2xl font-bold text-primary">₹{totalCost}</div>
          </div>
        </CardContent>
      </Card>

      {/* Pixel Information Form with Accessibility [web:145][web:148] */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary" aria-hidden="true" />
            Pixel Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pixel Name Field */}
          <div>
            <Label
              htmlFor="pixel-name"
              className="text-sm font-medium mb-2 flex items-center gap-1"
            >
              Pixel Name
              <span className="text-destructive" aria-label="required">*</span>
            </Label>
            <Input
              id="pixel-name"
              ref={pixelNameRef}
              type="text"
              placeholder="e.g., My Awesome Brand"
              value={pixelName}
              onChange={(e) => handlePixelNameChange(e.target.value)}
              onBlur={handlePixelNameBlur}
              autoFocus
              required
              aria-required="true"
              aria-invalid={!!pixelNameError}
              aria-describedby={pixelNameError ? "pixel-name-error" : "pixel-name-help"}
              className={`text-base ${pixelNameError && pixelNameTouched ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {!pixelNameError && (
              <p id="pixel-name-help" className="text-xs text-muted-foreground mt-1">
                This will be displayed as the title for your pixel space
              </p>
            )}
            {pixelNameError && pixelNameTouched && (
              <div
                id="pixel-name-error"
                className="flex items-center gap-1 text-xs text-destructive mt-1"
                role="alert"
              >
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                {pixelNameError}
              </div>
            )}
          </div>

          {/* Link URL Field */}
          <div>
            <Label
              htmlFor="link-url"
              className="text-sm font-medium mb-2 flex items-center gap-1"
            >
              Redirection Link
              <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="link-url"
              ref={linkUrlRef}
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => handleLinkUrlChange(e.target.value)}
              onBlur={handleLinkUrlBlur}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={!!linkUrlError}
              aria-describedby={linkUrlError ? "link-url-error" : "link-url-help"}
              className={`text-base ${linkUrlError && linkUrlTouched ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {!linkUrlError && (
              <p id="link-url-help" className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" aria-hidden="true" />
                Visitors will be redirected to this URL when clicking your pixels
              </p>
            )}
            {linkUrlError && linkUrlTouched && (
              <div
                id="link-url-error"
                className="flex items-center gap-1 text-xs text-destructive mt-1"
                role="alert"
              >
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                {linkUrlError}
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <Label htmlFor="image-upload" className="text-sm font-medium mb-2 block">
              Image Upload
              <span className="text-xs text-muted-foreground font-normal ml-1">(Optional)</span>
            </Label>
            <ImageUpload
              onImageUploaded={(url) => setImagePreview(url)}
              currentImage={imagePreview || ''}
              folder="user-pixels"
              bucket="pixel-images"
              cropAspectRatio={1}
              placeholder="Upload Pixel Image"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recommended: Square image, minimum 500×500px
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Info [web:140] */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-start gap-2 md:gap-3 mb-3">
            <Shield className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="space-y-1 flex-1">
              <div className="text-sm md:text-base font-semibold text-primary">
                Secure Payment via Razorpay
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">
                256-bit SSL encryption • PCI DSS compliant
              </div>
            </div>
          </div>

          {/* Payment Methods Icons [web:140] */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
              <Smartphone className="w-5 h-5 text-purple-600" aria-hidden="true" />
              <span className="text-[10px] text-muted-foreground">UPI</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
              <CreditCard className="w-5 h-5 text-blue-600" aria-hidden="true" />
              <span className="text-[10px] text-muted-foreground">Cards</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
              <Building2 className="w-5 h-5 text-green-600" aria-hidden="true" />
              <span className="text-[10px] text-muted-foreground">Banking</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50">
              <Wallet className="w-5 h-5 text-orange-600" aria-hidden="true" />
              <span className="text-[10px] text-muted-foreground">Wallets</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Money Back Guarantee [web:140] */}
      <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />
        <span>7-day money-back guarantee • 24/7 support</span>
      </div>
    </div>
  );

  // Action buttons component [web:140][web:141]
  const actionButtons = (
    <div className="flex gap-3 md:gap-4">
      <Button
        variant="outline"
        onClick={onClose}
        className="flex-1 h-11 md:h-10 text-base md:text-sm"
        disabled={isProcessing}
        aria-label="Cancel checkout"
      >
        Cancel
      </Button>
      <Button
        onClick={handleConfirmPurchase}
        disabled={isProcessing || !razorpayLoaded || !!pixelNameError || !!linkUrlError}
        className="flex-1 h-11 md:h-10 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0 font-semibold text-base md:text-sm shadow-lg hover:shadow-xl transition-all"
        aria-label={isProcessing ? "Processing payment" : "Proceed to payment"}
      >
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Processing...</span>
          </div>
        ) : (
          <>
            <Lock className="w-4 md:w-5 h-4 md:h-5 mr-2" aria-hidden="true" />
            <span>Pay ₹{totalCost} Securely</span>
          </>
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[95vh] flex flex-col">
          <DrawerHeader className="border-b pb-3 px-4 flex-shrink-0">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="w-6 h-6 text-primary" aria-hidden="true" />
              Checkout
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              Complete your pixel purchase securely
            </DrawerDescription>
          </DrawerHeader>

          <div
            className="flex-1 overflow-y-auto px-4 py-6"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
            role="main"
          >
            {purchaseContent}
          </div>

          {/* Sticky Action Buttons for Mobile [web:140] */}
          <div className="sticky bottom-0 bg-background border-t p-4 flex-shrink-0 safe-area-bottom">
            {actionButtons}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]" role="dialog" aria-labelledby="checkout-title">
        <DialogHeader>
          <DialogTitle id="checkout-title" className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" aria-hidden="true" />
            Checkout
          </DialogTitle>
          <DialogDescription>
            Complete your pixel purchase securely with Razorpay
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          {purchaseContent}

          {/* Action Buttons for Desktop */}
          <div className="pt-6 border-t mt-6">
            {actionButtons}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
