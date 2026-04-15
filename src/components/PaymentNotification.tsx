import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Heart, Zap, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PaymentNotificationProps {
  status: 'processing' | 'success' | 'error';
  pixelCount: number;
  pixelName: string;
  totalAmount: number;
  errorMessage?: string;
  onClose?: () => void;
  onViewProfile?: () => void;
}

export const PaymentNotification: React.FC<PaymentNotificationProps> = ({
  status,
  pixelCount,
  pixelName,
  totalAmount,
  errorMessage,
  onClose,
  onViewProfile,
}) => {
  if (status === 'processing') {
    return (
      <Card className="border border-primary/20 bg-primary/5 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Processing Payment
              </h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we verify your payment...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'success') {
    return (
      <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 overflow-hidden">
        <CardContent className="p-6">
          {/* Success Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400 animate-bounce" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-300 mb-1">
                Purchase Successful! 🎉
              </h2>
              <p className="text-sm text-muted-foreground">
                Your pixels are now live on the canvas
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6 p-4 rounded-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Pixels
              </div>
              <div className="text-2xl font-bold text-foreground">{pixelCount}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Amount
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ₹{totalAmount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Status
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Live ✨</div>
            </div>
          </div>

          {/* Achievement Badge */}
          <div className="bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-semibold text-amber-900 dark:text-amber-100">
                  Congratulations!
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  You're now part of the BuyAPixel community. Your pixels will be displayed until the permanent duration expires.
                </p>
              </div>
            </div>
          </div>

          {/* Pixel Name Display */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Pixel Name
            </div>
            <div className="text-lg font-semibold text-foreground break-words line-clamp-2">
              {pixelName}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onViewProfile}
              variant="default"
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Heart className="w-4 h-4 mr-2" />
              View in Profile
            </Button>
            {onClose && (
              <Button onClick={onClose} variant="outline" className="flex-1">
                Continue
              </Button>
            )}
          </div>

          {/* Share Hint */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            💡 Share your pixels with your network!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  return (
    <Card className="border-2 border-destructive/30 bg-gradient-to-br from-destructive/5 to-red-50/5 dark:from-destructive/10 dark:to-red-950/20 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            <AlertCircle className="w-10 h-10 text-destructive animate-pulse" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-destructive mb-2">Payment Failed</h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                We couldn't process your payment. Please check the details below and try again.
              </p>
              {errorMessage && (
                <div className="bg-red-50/50 dark:bg-red-950/20 rounded-md p-3 border border-destructive/20">
                  <p className="text-sm text-destructive/90 font-medium">
                    {errorMessage}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Details */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Pixels Selected:</span>
            <span className="font-medium">{pixelCount}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Amount:</span>
            <span className="font-medium">₹{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Troubleshooting Tips */}
        <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-4 mb-6 border border-blue-200/50 dark:border-blue-800/50">
          <div className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2 uppercase tracking-wide">
            Troubleshooting Tips
          </div>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
            <li>Check your internet connection</li>
            <li>Ensure your payment method has sufficient balance</li>
            <li>Try a different payment method</li>
            <li>Contact support if the problem persists</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            <Zap className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
