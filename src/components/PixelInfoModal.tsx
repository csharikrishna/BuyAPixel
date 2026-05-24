import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import {
  ExternalLink,
  MapPin,
  Crown,
  Sparkles,
  Zap,
  User,
  Calendar,
  Grid3X3,
  Share2,
  Copy,
  Check,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PurchasedPixel, PixelBlock } from '@/types/grid';
import { calculatePixelPrice } from '@/utils/gridConstants';

interface PixelInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixel: PurchasedPixel | null;
  block: PixelBlock | null;
}

interface OwnerProfile {
  full_name: string | null;
  avatar_url: string | null;
}

function getTierInfo(price: number) {
  if (price >= 499) return { name: 'Gold', icon: Crown, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', gradient: 'from-amber-500 to-amber-600' };
  if (price >= 299) return { name: 'Premium', icon: Sparkles, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/30', gradient: 'from-violet-500 to-violet-600' };
  return { name: 'Economy', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', gradient: 'from-emerald-500 to-emerald-600' };
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Unknown';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return 'Unknown';
  }
}

export const PixelInfoModal = ({ isOpen, onClose, pixel, block }: PixelInfoModalProps) => {
  const isMobile = useIsMobile();
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [isLoadingOwner, setIsLoadingOwner] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine display data from block (preferred) or individual pixel
  const imageUrl = block?.image_url || pixel?.image_url;
  const linkUrl = block?.link_url || pixel?.link_url;
  const altText = block?.alt_text || pixel?.alt_text || 'Pixel';
  const ownerId = block?.owner_id || pixel?.owner_id;
  const purchasedAt = block?.created_at || pixel?.purchased_at;

  // Determine position info
  const isBlock = !!block;
  const minX = block?.min_x ?? pixel?.x ?? 0;
  const maxX = block?.max_x ?? pixel?.x ?? 0;
  const minY = block?.min_y ?? pixel?.y ?? 0;
  const maxY = block?.max_y ?? pixel?.y ?? 0;
  const pixelCount = block?.pixel_count ?? 1;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  // Calculate price tier from position
  const price = pixel?.price_paid ?? calculatePixelPrice(pixel?.x ?? 0, pixel?.y ?? 0);
  const tier = getTierInfo(price);
  const TierIcon = tier.icon;

  // Fetch owner profile
  useEffect(() => {
    if (!isOpen || !ownerId) {
      setOwnerProfile(null);
      return;
    }

    let cancelled = false;
    setIsLoadingOwner(true);

    supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', ownerId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setOwnerProfile(data);
        }
        setIsLoadingOwner(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, ownerId]);

  const handleCopyLink = () => {
    if (linkUrl) {
      navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: altText,
      text: `Check out "${altText}" on BuyASpot — India's Pixel Marketplace`,
      url: linkUrl || window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed silently
      }
    } else {
      navigator.clipboard.writeText(shareData.url);
      toast.success('Link copied to clipboard');
    }
  };

  const content = (
    <div className="space-y-5">
      {/* Image Preview */}
      {imageUrl ? (
        <div className="relative rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-border/30">
          <img
            src={imageUrl}
            alt={altText}
            className="w-full h-auto max-h-[280px] object-contain mx-auto"
            loading="lazy"
          />
          {/* Tier Badge Overlay */}
          <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${tier.gradient} shadow-lg`}>
            <TierIcon className="w-3 h-3" />
            {tier.name}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-muted/30 border-2 border-dashed border-border/50 h-32 flex flex-col items-center justify-center gap-2">
          <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No image uploaded</p>
        </div>
      )}

      {/* Name & Tier */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground truncate">{altText}</h3>
          {linkUrl && (
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-1 truncate"
            >
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{linkUrl.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
        <Badge
          variant="outline"
          className={`${tier.bg} ${tier.color} ${tier.border} flex-shrink-0 flex items-center gap-1`}
        >
          <TierIcon className="w-3 h-3" />
          {tier.name} · ₹{price}
        </Badge>
      </div>

      <Separator className="opacity-50" />

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Owner */}
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
          {ownerProfile?.avatar_url ? (
            <img
              src={ownerProfile.avatar_url}
              alt="Owner"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-border/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border/30">
              <User className="w-4 h-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Owner</p>
            <p className="text-sm font-medium text-foreground truncate">
              {isLoadingOwner ? (
                <span className="inline-block w-16 h-3 bg-muted animate-pulse rounded" />
              ) : (
                ownerProfile?.full_name || 'Anonymous'
              )}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center ring-2 ring-border/30">
            <MapPin className="w-4 h-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Position</p>
            <p className="text-sm font-medium text-foreground font-mono">
              {isBlock ? `(${minX},${minY})–(${maxX},${maxY})` : `(${pixel?.x}, ${pixel?.y})`}
            </p>
          </div>
        </div>

        {/* Size */}
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center ring-2 ring-border/30">
            <Grid3X3 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Size</p>
            <p className="text-sm font-medium text-foreground">
              {pixelCount} pixel{pixelCount > 1 ? 's' : ''} · {width}×{height}
            </p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center ring-2 ring-border/30">
            <Calendar className="w-4 h-4 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Purchased</p>
            <p className="text-sm font-medium text-foreground truncate">
              {formatDate(purchasedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        {linkUrl && (
          <Button
            className="flex-1 gap-2"
            onClick={() => window.open(linkUrl, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-4 h-4" />
            Visit Link
          </Button>
        )}
        {linkUrl && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyLink}
            className="flex-shrink-0"
            aria-label="Copy link"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={handleShare}
          className="flex-shrink-0"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-left">Pixel Details</DrawerTitle>
            <DrawerDescription className="text-left sr-only">
              Information about the selected pixel
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pixel Details</DialogTitle>
          <DialogDescription className="sr-only">
            Information about the selected pixel
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
