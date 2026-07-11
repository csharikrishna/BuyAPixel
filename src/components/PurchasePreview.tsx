import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
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
  Smartphone,
  Palette,
  Image as ImageIcon,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/ImageUpload";
import { AdTierPreview } from "@/components/AdTierPreview";
import { PaymentNotification } from "@/components/PaymentNotification";
import { Helmet } from "react-helmet-async";
import { SelectedPixel } from "@/types/grid";
import { cn } from "@/lib/utils";

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

interface PurchasePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPixels: SelectedPixel[];
  onConfirmPurchase: (pixelName: string, linkUrl: string, imageUrl: string | null) => void;
}

// Form validation step [web:140]
type CheckoutStep = 'details' | 'payment' | 'confirmation';
type DesignMode = 'image' | 'color';

// Curated preset colors for the color picker
const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#000000', '#374151', '#6B7280',
  '#9CA3AF', '#D1D5DB', '#F3F4F6', '#FFFFFF',
];

export const PurchasePreview = ({
  isOpen,
  onClose,
  selectedPixels,
  onConfirmPurchase
}: PurchasePreviewProps) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const isPaymentBypassed = isAdmin;

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('details');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

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

  // Design mode: image upload or color picker
  const [designMode, setDesignMode] = useState<DesignMode>('image');
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [isGeneratingColor, setIsGeneratingColor] = useState(false);

  // Refs for accessibility [web:148]
  const firstErrorRef = useRef<HTMLInputElement>(null);
  const pixelNameRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);

  // Auto-save to localStorage and state reset [web:140]
  useEffect(() => {
    if (isOpen) {
      // Reset state for new checkout session
      setIsProcessing(false);
      setCurrentStep('details');
      setPaymentStatus('idle');
      setPaymentError(null);
      setOrderId(null);
      setPaymentId(null);
      setFormProgress(0);

      // Preload Razorpay script to enable button immediately [perf]
      if (!isPaymentBypassed && !razorpayLoaded) {
        loadRazorpayScript().catch(() => {
          console.warn('Razorpay preload failed, will retry on payment');
        });
      }

      const savedData = localStorage.getItem('checkout-draft');
      if (savedData) {
        try {
          const { pixelName: savedName, linkUrl: savedLink } = JSON.parse(savedData);
          if (savedName) setPixelName(savedName);
          if (savedLink) setLinkUrl(savedLink);
        } catch (e: unknown) {
          console.error('Failed to restore checkout data');
        }
      }
    }
  }, [isOpen, isPaymentBypassed, razorpayLoaded]);

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

  // Lazy-load Razorpay script on demand (deferred from mount to payment time) [perf]
  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window.Razorpay !== 'undefined') {
        setRazorpayLoaded(true);
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          setRazorpayLoaded(true);
          resolve();
        });
        // If already loaded but Razorpay is available
        if (typeof window.Razorpay !== 'undefined') {
          setRazorpayLoaded(true);
          resolve();
        }
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
          resolve();
        };
        script.onerror = () => {
          retries++;
          if (retries < maxRetries) {
            console.warn(`Razorpay script load failed, retrying... (${retries}/${maxRetries})`);
            setTimeout(loadScript, 2000 * retries);
          } else {
            console.error('Failed to load Razorpay script after multiple attempts');
            toast.error('Payment gateway failed to load. Please refresh the page.', { duration: 5000 });
            reject(new Error('Failed to load Razorpay'));
          }
        };
        document.body.appendChild(script);
      };

      loadScript();
    });
  };

  // Automatically calculate cost based on number of pixels
  const totalCost = selectedPixels.reduce((sum, pixel) => sum + pixel.price, 0);
  const pixelCounts = selectedPixels.reduce((acc, pixel) => {
    acc[pixel.price] = (acc[pixel.price] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Build price breakdown — canonical tier names
  const priceBreakdown = {
    economy: pixelCounts[99] || 0,
    premium: pixelCounts[299] || 0,
    gold: pixelCounts[499] || 0
  };

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

  // Enhanced URL validation — accepts bare domains like "example.com" [web:145]
  const validateUrl = (url: string): { valid: boolean; error?: string } => {
    if (!url) return { valid: true }; // Optional field

    // Remove whitespace
    url = url.trim();

    // Auto-prepend https:// for bare domains (including www.)
    if (!url.includes('://')) {
      url = `https://${url}`;
    }

    try {
      const urlObj = new URL(url);

      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: "Only HTTP and HTTPS links are allowed" };
      }

      // Must have at least one dot in hostname (i.e. looks like a real domain)
      if (!urlObj.hostname.includes('.')) {
        return { valid: false, error: "Please enter a valid domain (e.g., example.com)" };
      }

      // Check for localhost in production
      if (import.meta.env.PROD &&
        (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')) {
        return { valid: false, error: "Localhost URLs are not allowed" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Please enter a valid link (e.g., example.com)" };
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

  // Normalize URL: prepend https:// for bare domains before saving
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (!trimmed.includes('://')) return `https://${trimmed}`;
    return trimmed;
  };

  const handleConfirmPurchase = async () => {
    // Validate form before proceeding [web:140]
    if (!validateForm()) {
      toast.error("Please fix the errors before continuing", {
        description: "Check the highlighted fields",
        duration: 5000
      });
      return;
    }

    // In bypass mode, skip Razorpay SDK check
    if (!isPaymentBypassed && !razorpayLoaded) {
      // Load Razorpay on-demand when user first clicks Pay [perf]
      try {
        toast.info("Loading payment gateway...", { duration: 3000 });
        await loadRazorpayScript();
      } catch {
        toast.error("Payment gateway failed to load. Please try again.", { duration: 5000 });
        return;
      }
    }

    setIsProcessing(true);
    setCurrentStep('payment');
    setPaymentStatus('processing');
    setPaymentError(null);

    try {
      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue", { duration: 5000 });
        setIsProcessing(false);
        setCurrentStep('details');
        setPaymentStatus('error');
        setPaymentError('Please sign in to continue');
        return;
      }

      // ── BYPASS MODE: skip Razorpay, call bypass-purchase directly ──
      if (isPaymentBypassed) {
        try {
          const bypassResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bypass-purchase`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              pixels: selectedPixels.map(p => ({ x: p.x, y: p.y, price: p.price })),
              totalAmount: totalCost,
              imageUrl: imagePreview,
              linkUrl: linkUrl.trim() || null,
              altText: pixelName.trim(),
            })
          });

          const bypassData = await bypassResponse.json().catch(() => ({ error: 'Invalid JSON response from server' }));

          if (!bypassResponse.ok || !bypassData?.success) {
            const errorMsg = bypassData?.error || bypassData?.message || bypassData?.details || `Server returned ${bypassResponse.status}`;
            console.error('Bypass error:', { status: bypassResponse.status, bypassData, errorMsg });
            throw new Error(errorMsg);
          }

          // Success! Call the original onConfirmPurchase
          await onConfirmPurchase(pixelName.trim(), normalizeUrl(linkUrl), imagePreview);

          // Update payment status to success
          setPaymentStatus('success');

          toast.success("🎉 Purchase successful! (Admin bypass)", {
            description: "Your pixels have been claimed without payment.",
            duration: 5000
          });

          // Clear form and localStorage after a delay to let notification show
          setTimeout(() => {
            setPixelName("");
            setLinkUrl("");
            setLinkUrlError(null);
            setPixelNameError(null);
            setImagePreview(null);
            setPixelNameTouched(false);
            setLinkUrlTouched(false);
            localStorage.removeItem('checkout-draft');
            setPaymentStatus('idle');
            onClose();
          }, 2000);

          return; // Exit here, skipping Razorpay
        } catch (err: unknown) {
          console.error('Bypass error:', err);
          throw err;
        }
      }

      // Step 1: Create Razorpay order [web:144]
      // Use raw fetch to ensure we can read the exact error body from the edge function
      const orderResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          pixels: selectedPixels.map(p => ({ x: p.x, y: p.y, price: p.price })),
          totalAmount: totalCost,
          imageUrl: imagePreview,
          linkUrl: linkUrl.trim() || null,
          altText: pixelName.trim(),
        })
      });

      const orderData = await orderResponse.json().catch(() => ({ error: 'Invalid JSON response from server' }));

      if (!orderResponse.ok || !orderData?.success) {
        const errorMsg = orderData?.error || orderData?.message || orderData?.details || `Server returned ${orderResponse.status}`;
        console.error('Create order failed:', { status: orderResponse.status, orderData, errorMsg });
        throw new Error(errorMsg);
      }

      // Capture order ID for receipt display
      if (orderData.order?.id) {
        setOrderId(orderData.order.id);
      }

      // Step 2: Open Razorpay checkout with enhanced options [web:144]
      const options: RazorpayOptions = {
        key: orderData.order.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'buyaspot.in',
        description: `${selectedPixels.length} pixel${selectedPixels.length > 1 ? 's' : ''} - ${pixelName.trim()}`,
        order_id: orderData.order.razorpay_order_id,
        handler: async (response: RazorpayResponse) => {
          setCurrentStep('confirmation');
          setPaymentStatus('processing');

          // Capture payment ID for receipt display
          setPaymentId(response.razorpay_payment_id);

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
              // Extract actual error from FunctionsHttpError context
              let verifyErrMsg = verifyData?.error || 'Payment verification failed';
              if (verifyError && !verifyData?.error) {
                try {
                  const ctx = (verifyError as any)?.context;
                  if (ctx?.body) {
                    const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
                    verifyErrMsg = parsed?.error || parsed?.message || verifyErrMsg;
                  }
                } catch {
                  verifyErrMsg = verifyError.message || verifyErrMsg;
                }
              }
              console.error('Verify failed:', { verifyError, verifyData, verifyErrMsg });
              throw new Error(verifyErrMsg);
            }

            // Success! Call the original onConfirmPurchase
            await onConfirmPurchase(pixelName.trim(), normalizeUrl(linkUrl), imagePreview);

            // Update payment status to success
            setPaymentStatus('success');

            toast.success("🎉 Payment successful!", {
              description: "Your pixels are now live on the canvas",
              duration: 5000
            });

            // Clear form and localStorage after a delay to let notification show
            setTimeout(() => {
              setPixelName("");
              setLinkUrl("");
              setLinkUrlError(null);
              setPixelNameError(null);
              setImagePreview(null);
              setPixelNameTouched(false);
              setLinkUrlTouched(false);
              localStorage.removeItem('checkout-draft');
              setPaymentStatus('idle');
              onClose();
            }, 2000);

          } catch (verifyErr: unknown) {
            console.error('Payment verification error:', verifyErr);
            const errorMsg = verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed';
            setPaymentStatus('error');
            setPaymentError(errorMsg);
            toast.error("Payment verification failed", {
              duration: 6000,
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
        const errorMsg = response.error.description || "Please try again";
        setPaymentStatus('error');
        setPaymentError(errorMsg);
        toast.error("Payment failed", {
          duration: 6000,
          description: errorMsg
        });
        setIsProcessing(false);
        setCurrentStep('details');
      });

      razorpay.open();

    } catch (error: unknown) {
      console.error('Purchase error:', error);
      const errorMsg = error instanceof Error ? error.message : "Failed to initiate payment";
      setPaymentStatus('error');
      setPaymentError(errorMsg);
      toast.error(errorMsg, { duration: 5000 });
      setIsProcessing(false);
      setCurrentStep('details');
    }
  };

  // Generate a solid-color image, upload to Supabase, and set as pixel image
  const handleApplyColor = async () => {
    if (selectedColor.length !== 7) {
      toast.error('Please enter a valid 6-digit hex color', { duration: 4000 });
      return;
    }

    setIsGeneratingColor(true);

    try {
      // Create a 4x4 pixel canvas with the selected color
      const canvas = document.createElement('canvas');
      canvas.width = 4;
      canvas.height = 4;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.fillStyle = selectedColor;
      ctx.fillRect(0, 0, 4, 4);

      // Convert to blob
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to generate color image'));
        }, 'image/webp');
      });

      // Upload to Supabase
      const fileName = `user-pixels/color-${selectedColor.replace('#', '')}-${Date.now()}.webp`;
      const { data, error } = await supabase.storage
        .from('pixel-images')
        .upload(fileName, blob, {
          cacheControl: '31536000',
          upsert: false,
          contentType: 'image/webp',
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('pixel-images')
        .getPublicUrl(data.path);

      setImagePreview(publicUrl);
      toast.success(`Color ${selectedColor} applied!`, {
        description: 'Your pixel will display this color.',
      });
    } catch (err: unknown) {
      console.error('Color generation error:', err);
      toast.error('Failed to apply color', {
        duration: 4000,
        description: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setIsGeneratingColor(false);
    }
  };

  const getPriceTierInfo = (price: number) => {
    switch (price) {
      case 499:
        return { name: 'Gold', color: 'bg-amber-500', textColor: 'text-amber-700', badge: '👑' };
      case 299:
        return { name: 'Premium', color: 'bg-violet-500', textColor: 'text-violet-700', badge: '✨' };
      case 99:
        return { name: 'Economy', color: 'bg-emerald-500', textColor: 'text-emerald-700', badge: '⚡' };
      default:
        return { name: 'Unknown', color: 'bg-muted', textColor: 'text-muted-foreground', badge: '⚪' };
    }
  };

  const isContiguous = useMemo(() => {
    if (selectedPixels.length <= 1) return true;
    
    let minX = 10000, maxX = -1, minY = 10000, maxY = -1;
    for (const p of selectedPixels) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    const area = (maxX - minX + 1) * (maxY - minY + 1);
    return area === selectedPixels.length;
  }, [selectedPixels]);

  const purchaseContent = (
    <div className="space-y-6">
      {/* SEO and Metadata */}
      <Helmet>
        <title>Checkout - buyaspot.in</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Dev Mode Banner — only visible when payment bypass is active */}
      {isPaymentBypassed && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
          <span className="text-lg">🛡️</span>
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight">Admin Purchase — No Payment Required</p>
            <p className="text-xs opacity-80">As an admin, your purchase will be processed without payment.</p>
          </div>
        </div>
      )}

      {/* Payment Notification - Shows during/after payment */}
      {paymentStatus !== 'idle' && (
        <PaymentNotification
          status={paymentStatus === 'success' ? 'success' : paymentStatus === 'processing' ? 'processing' : 'error'}
          pixelCount={selectedPixels.length}
          pixelName={pixelName}
          totalAmount={totalCost}
          orderId={orderId || undefined}
          paymentId={paymentId || undefined}
          errorMessage={paymentError || undefined}
          onClose={() => {
            setPaymentStatus('idle');
            setPaymentError(null);
            setCurrentStep('details');
          }}
          onViewProfile={() => {
            window.location.href = '/profile';
          }}
        />
      )}

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
          {!isContiguous && selectedPixels.length > 1 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 rounded-lg text-sm">
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-amber-800 dark:text-amber-300">
                <strong className="block font-semibold mb-1">Non-rectangular Selection</strong>
                Your selected pixels do not form a perfect rectangle (e.g. you might have an accidental stray pixel selected). Your image will be repeated individually on each pixel instead of spanning across them as a single large image.
              </div>
            </div>
          )}
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

      {/* Pricing Breakdown - 4 Tier Borders */}
      <Card className="card-premium overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" aria-hidden="true" />
            Pricing Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {/* ₹499 - Gold Tier */}
          <div className="flex items-center justify-between rounded-lg border-l-4 border-l-amber-400 bg-amber-50/5 dark:bg-amber-950/10 px-3 py-3 md:px-4 md:py-3 transition-all hover:bg-amber-50/10 dark:hover:bg-amber-950/20">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-lg md:text-xl" aria-hidden="true">👑</span>
              <div>
                <div className="text-sm md:text-base font-semibold text-amber-600 dark:text-amber-400">Gold (₹499)</div>
                <div className="text-xs md:text-sm text-muted-foreground">
                  {priceBreakdown.gold || 0} pixels selected
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm md:text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {priceBreakdown.gold ? `₹${(priceBreakdown.gold * 499).toLocaleString()}` : '₹0'}
              </div>
            </div>
          </div>

          {/* ₹299 - Premium Tier */}
          <div className="flex items-center justify-between rounded-lg border-l-4 border-l-violet-400 bg-violet-50/5 dark:bg-violet-950/10 px-3 py-3 md:px-4 md:py-3 transition-all hover:bg-violet-50/10 dark:hover:bg-violet-950/20">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-lg md:text-xl" aria-hidden="true">✨</span>
              <div>
                <div className="text-sm md:text-base font-semibold text-violet-600 dark:text-violet-400">Premium (₹299)</div>
                <div className="text-xs md:text-sm text-muted-foreground">
                  {priceBreakdown.premium || 0} pixels selected
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm md:text-base font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                {priceBreakdown.premium ? `₹${(priceBreakdown.premium * 299).toLocaleString()}` : '₹0'}
              </div>
            </div>
          </div>

          {/* ₹99 - Economy Tier */}
          <div className="flex items-center justify-between rounded-lg border-l-4 border-l-emerald-400 bg-emerald-50/5 dark:bg-emerald-950/10 px-3 py-3 md:px-4 md:py-3 transition-all hover:bg-emerald-50/10 dark:hover:bg-emerald-950/20">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-lg md:text-xl" aria-hidden="true">⚡</span>
              <div>
                <div className="text-sm md:text-base font-semibold text-emerald-600 dark:text-emerald-400">Economy (₹99)</div>
                <div className="text-xs md:text-sm text-muted-foreground">
                  {priceBreakdown.economy || 0} pixels selected
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm md:text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {priceBreakdown.economy ? `₹${(priceBreakdown.economy * 99).toLocaleString()}` : '₹0'}
              </div>
            </div>
          </div>

          {/* Billboard / Featured Section - Bonus */}
          <div className="flex items-center justify-between rounded-lg border-l-4 border-l-rose-400 bg-rose-50/5 dark:bg-rose-950/10 px-3 py-3 md:px-4 md:py-3 transition-all hover:bg-rose-50/10 dark:hover:bg-rose-950/20">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-lg md:text-xl" aria-hidden="true">🎬</span>
              <div>
                <div className="text-sm md:text-base font-semibold text-rose-600 dark:text-rose-400">Billboard Boost</div>
                <div className="text-xs md:text-sm text-muted-foreground">
                  Premium visibility option
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm md:text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                —
              </div>
            </div>
          </div>

          <Separator />

          <div
            className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-primary/10 border border-primary/20 font-bold"
            role="row"
          >
            <span className="text-base md:text-lg">Total Cost</span>
            <span className="text-lg md:text-2xl text-primary tabular-nums">₹{totalCost.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Image Upload / Color Picker Form */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary" aria-hidden="true" />
            Design Your Pixel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle: Image Upload vs Color Picker */}
          <div className="flex rounded-lg border bg-muted/30 p-1 gap-1">
            <button
              type="button"
              onClick={() => setDesignMode('image')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                designMode === 'image'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => setDesignMode('color')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                designMode === 'color'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Palette className="w-4 h-4" />
              Pick Color
            </button>
          </div>

          {/* Image Upload Section */}
          {designMode === 'image' && (
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
                cropAspectRatio={selectionInfo ? selectionInfo.dimensions.width / selectionInfo.dimensions.height : 1}
                placeholder="Upload Pixel Image"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {selectedPixels.length > 1
                  ? `Upload ONE image — it will be displayed across all ${selectedPixels.length} pixels as a single merged ${selectionInfo?.dimensions.width}×${selectionInfo?.dimensions.height} block.`
                  : 'Any size accepted — auto-compressed. Square images work best.'
                }
              </p>
            </div>
          )}

          {/* Color Picker Section */}
          {designMode === 'color' && (
            <div className="space-y-4">
              <Label className="text-sm font-medium block">
                Choose a Color
                <span className="text-xs text-muted-foreground font-normal ml-1">(Optional)</span>
              </Label>

              {/* Preset color swatches */}
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                      selectedColor === color
                        ? 'border-primary ring-2 ring-primary/30 scale-110'
                        : 'border-border/50 hover:border-border'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    title={color}
                  />
                ))}
              </div>

              {/* Hex input + preview */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="hex-color" className="text-xs font-medium text-muted-foreground mb-1 block">
                    Hex Color Code
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">#</span>
                    <Input
                      id="hex-color"
                      type="text"
                      value={selectedColor.replace('#', '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                        if (val.length <= 6) {
                          setSelectedColor(`#${val}`);
                        }
                      }}
                      placeholder="FF5733"
                      maxLength={6}
                      className="pl-7 font-mono text-sm uppercase"
                    />
                  </div>
                </div>

                {/* Live preview swatch */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-12 h-10 rounded-lg border-2 border-border shadow-inner"
                    style={{ backgroundColor: selectedColor.length === 7 ? selectedColor : '#ffffff' }}
                  />
                  <span className="text-[10px] text-muted-foreground">Preview</span>
                </div>
              </div>

              {/* Apply color button */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={selectedColor.length !== 7 || isGeneratingColor}
                onClick={handleApplyColor}
              >
                {isGeneratingColor ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : imagePreview && designMode === 'color' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Color Applied — Click to Change
                  </>
                ) : (
                  <>
                    <Palette className="w-4 h-4" />
                    Apply Color to Pixel
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad Tier Preview - Shows tier benefits and ad visualization */}
      <AdTierPreview 
        totalPrice={totalCost}
        pixelCount={selectedPixels.length}
        showAnimation={true}
        imageUrl={imagePreview}
      />

      {/* Text Details Form */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary" aria-hidden="true" />
            Pixel Details
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
              required
              aria-required="true"
              aria-invalid={!!pixelNameError}
              aria-describedby={pixelNameError ? "pixel-name-error" : "pixel-name-help"}
              className={cn(
                "text-base transition-all duration-200",
                pixelNameError && pixelNameTouched 
                  ? 'border-destructive focus-visible:ring-destructive' 
                  : 'hover:border-primary/50 focus-visible:ring-primary/40 focus-visible:border-primary'
              )}
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
              placeholder="example.com"
              value={linkUrl}
              onChange={(e) => handleLinkUrlChange(e.target.value)}
              onBlur={handleLinkUrlBlur}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={!!linkUrlError}
              aria-describedby={linkUrlError ? "link-url-error" : "link-url-help"}
              className={cn(
                "text-base transition-all duration-200",
                linkUrlError && linkUrlTouched 
                  ? 'border-destructive focus-visible:ring-destructive' 
                  : 'hover:border-primary/50 focus-visible:ring-primary/40 focus-visible:border-primary'
              )}
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
        disabled={isProcessing || !!pixelNameError || !!linkUrlError}
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
            <span>{isPaymentBypassed ? `Claim Free (Admin)` : `Pay ₹${totalCost} Securely`}</span>
          </>
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent 
          className="max-h-[90dvh] flex flex-col"
          onInteractOutside={(e) => {
            if (isProcessing || document.querySelector('.razorpay-container')) {
              e.preventDefault();
            }
          }}
        >
          <DrawerHeader className="border-b pb-3 px-4 shrink-0">
            <DrawerTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="w-5 h-5 text-primary" aria-hidden="true" />
              Checkout
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              Complete your pixel purchase securely
            </DrawerDescription>
          </DrawerHeader>

          <div
            className="flex-1 overflow-y-auto px-4 py-5"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
            role="main"
          >
            {purchaseContent}
          </div>

          {/* Sticky Action Buttons for Mobile */}
          <div className="shrink-0 border-t bg-background px-4 py-4 safe-area-bottom">
            {actionButtons}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-xl max-h-[90dvh]" 
        role="dialog" 
        aria-labelledby="checkout-title"
        aria-modal="true"
        onInteractOutside={(e) => {
          if (isProcessing || document.querySelector('.razorpay-container')) {
            e.preventDefault();
          }
        }}
        onOpenAutoFocus={(e) => {
          // Prevent focus stealing when Razorpay is open
          if (document.querySelector('.razorpay-container')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle id="checkout-title" className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" aria-hidden="true" />
            Checkout
          </DialogTitle>
          <DialogDescription>
            Complete your pixel purchase securely with Razorpay
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90dvh-8rem)] pr-3">
          {purchaseContent}

          {/* Action Buttons for Desktop */}
          <div className="pt-5 border-t mt-5">
            {actionButtons}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
