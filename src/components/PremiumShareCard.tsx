import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share2, Twitter, Linkedin, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getAdTierByPrice } from '@/utils/gridConstants';
import { LOGO } from '@/lib/branding';
import './PremiumShareCard.css';

interface PremiumShareCardProps {
  pixelName: string;
  x: number;
  y: number;
  imageUrl?: string | null;
  linkUrl?: string | null;
  pricePaid?: number;
  /** If true, show floating animation */
  floating?: boolean;
}

type TierKey = 'economy' | 'premium' | 'gold';

const TIER_LABELS: Record<TierKey, string> = {
  economy: 'Economy',
  premium: 'Premium',
  gold: 'Gold',
};

const TIER_ICONS: Record<TierKey, string> = {
  economy: '⚡',
  premium: '✨',
  gold: '👑',
};

export const PremiumShareCard = ({
  pixelName,
  x,
  y,
  imageUrl,
  linkUrl,
  pricePaid = 99,
  floating = false,
}: PremiumShareCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState(false);

  const tier = getAdTierByPrice(pricePaid).toLowerCase() as TierKey;
  const tierLabel = TIER_LABELS[tier];
  const tierIcon = TIER_ICONS[tier];

  // Use explicit production URL so QR code works everywhere and looks professional
  const pixelUrl = `https://buyaspot.in/?pixel=${x},${y}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(pixelUrl)}`;

  // Mouse-tracking 3D tilt effect
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 12;
      const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 12;
      setTilt({ x: rotateX, y: rotateY });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  // Touch tilt for mobile
  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!sceneRef.current || !e.touches[0]) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateY = ((e.touches[0].clientX - centerX) / (rect.width / 2)) * 8;
      const rotateX = -((e.touches[0].clientY - centerY) / (rect.height / 2)) * 8;
      setTilt({ x: rotateX, y: rotateY });
    },
    []
  );

  // Generate Canvas Helper
  const generateCanvas = useCallback(async () => {
    if (!cardRef.current) return null;
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default;

    const card = cardRef.current;
    card.classList.add('premium-card--capture');

    const canvas = await html2canvas(card, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    card.classList.remove('premium-card--capture');
    return canvas;
  }, []);

  // Download card as PNG
  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const canvas = await generateCanvas();
      if (!canvas) return;

      const link = document.createElement('a');
      link.download = `BuyASpot-${pixelName.replace(/\s+/g, '-')}-${x}-${y}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Card downloaded! 🎉', {
        description: 'Share your premium pixel card with the world.',
      });
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download card. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [pixelName, x, y, isDownloading, generateCanvas]);

  // Share helpers
  const shareText = `I just claimed Pixel (${x}, ${y}) on BuyASpot — India's pixel marketplace! Own your piece of internet history. 🚀`;
  const shareTextWithLink = `${shareText}\n\n${pixelUrl}`;

  const handleShare = useCallback((platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(pixelUrl);
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    };

    // Open link synchronously to avoid popup blockers
    window.open(urls[platform], '_blank', 'noopener,noreferrer,width=600,height=700');

    // Generate and copy image to clipboard in the background
    generateCanvas().then(canvas => {
      if (canvas) {
        canvas.toBlob(blob => {
          if (blob && navigator.clipboard && navigator.clipboard.write) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
              toast.success("Image copied! 📸", {
                description: "You can now hit 'Paste' (Ctrl+V) in the app to attach the photo!"
              });
            }).catch(e => console.error("Clipboard copy failed", e));
          }
        }, 'image/png');
      }
    });
  }, [shareText, pixelUrl, generateCanvas]);

  const handleShareImage = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const canvas = await generateCanvas();
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Failed to generate image.");
          setIsDownloading(false);
          return;
        }

        const file = new File([blob], `BuyASpot-Pixel-${x}-${y}.png`, { type: 'image/png' });
        const shareData = {
          title: `My Pixel (${x}, ${y})`,
          text: shareTextWithLink,
          files: [file]
        };

        // Try native share first
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share(shareData);
            toast.success("Shared successfully!");
          } catch (e) {
            console.log("Share failed or cancelled", e);
          }
        } 
        // Fallback to clipboard if share is not supported
        else if (navigator.clipboard && navigator.clipboard.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            toast.success("Image copied to clipboard!", {
              description: "You can now paste it into WhatsApp, Twitter, etc."
            });
          } catch (err) {
            console.error("Clipboard copy failed", err);
            toast.info("Browser doesn't support sharing. Please use download instead.");
          }
        } else {
            toast.info("Browser doesn't support sharing. Please use download instead.");
        }
        setIsDownloading(false);
      }, 'image/png');
    } catch (err) {
      console.error('Share failed:', err);
      toast.error('Failed to share card. Please try again.');
      setIsDownloading(false);
    }
  }, [shareText, x, y, isDownloading, generateCanvas]);

  // Preload QR image
  useEffect(() => {
    const img = new Image();
    img.src = qrUrl;
  }, [qrUrl]);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 3D Card Scene */}
      <div
        ref={sceneRef}
        className="premium-card-scene"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseLeave}
      >
        <div
          ref={cardRef}
          className={`premium-card premium-card--${tier} ${floating ? 'premium-card--floating' : ''}`}
          style={{
            transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          {/* Noise texture */}
          <div className="premium-card__noise" />

          {/* Holographic overlay */}
          <div className="premium-card__holo" />

          {/* Shine sweep */}
          <div className="premium-card__shine" />

          {/* Sparkle particles */}
          {tier !== 'economy' && (
            <>
              <div className="premium-card__sparkle" />
              <div className="premium-card__sparkle" />
              <div className="premium-card__sparkle" />
              <div className="premium-card__sparkle" />
            </>
          )}

          {/* Card Content */}
          <div className="premium-card__content">
            {/* Header */}
            <div className="premium-card__header">
              <div className={`premium-card__tier-badge premium-card__tier-badge--${tier}`}>
                <span>{tierIcon}</span>
                <span>{tierLabel} · ₹{pricePaid}</span>
              </div>
              <div className="premium-card__logo">
                <img src={LOGO} alt="BuyASpot" className="w-6 h-6 object-contain" />
              </div>
            </div>

            {/* Middle — Image + Name */}
            <div className="premium-card__middle">
              {imageUrl ? (
                <div className="premium-card__image-container">
                  <img
                    src={imageUrl}
                    alt={pixelName}
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div
                  className="premium-card__image-container"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                  }}
                >
                  🎨
                </div>
              )}
              <div className="premium-card__name">{pixelName}</div>
              {linkUrl && (
                <div className="premium-card__link">
                  {linkUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="premium-card__footer">
              <div className="premium-card__coords">
                <span className="premium-card__coords-label">Coordinates</span>
                <span className="premium-card__coords-value">
                  ({x}, {y})
                </span>
              </div>
              <div className="premium-card__qr">
                <img
                  src={qrUrl}
                  alt="QR Code"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-[380px]">
        {/* Share Native */}
        <Button
          onClick={handleShareImage}
          disabled={isDownloading}
          className="w-full gap-2 h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0 rounded-xl shadow-lg shadow-emerald-500/20 text-md font-bold"
        >
          <Share2 className="w-5 h-5" />
          {isDownloading ? 'Processing...' : 'Share Photo directly'}
        </Button>

        {/* Quick Share Row */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 rounded-xl h-10 hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] hover:border-[#1DA1F2]/30"
            onClick={() => handleShare('twitter')}
          >
            <Twitter className="w-4 h-4" /> X
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 rounded-xl h-10 hover:bg-[#0A66C2]/10 hover:text-[#0A66C2] hover:border-[#0A66C2]/30"
            onClick={() => handleShare('linkedin')}
          >
            <Linkedin className="w-4 h-4" /> LinkedIn
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 rounded-xl h-10 hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30"
            onClick={() => handleShare('whatsapp')}
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 rounded-xl h-10 hover:bg-[#0088cc]/10 hover:text-[#0088cc] hover:border-[#0088cc]/30"
            onClick={() => handleShare('telegram')}
          >
            <Send className="w-4 h-4" /> Telegram
          </Button>
        </div>

        {/* Download */}
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          variant="outline"
          className="w-full gap-2 h-11 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl font-medium text-slate-700 dark:text-slate-300"
        >
          <Download className="w-4 h-4" />
          Download to Gallery
        </Button>
      </div>
    </div>
  );
};
