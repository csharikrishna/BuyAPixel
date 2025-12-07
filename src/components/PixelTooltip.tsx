import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Shield, User, Crown, Target, Sparkles } from "lucide-react";

interface PixelTooltipProps {
  x: number;
  y: number;
  price: number;
  status: 'available' | 'selected' | 'sold' | 'yours';
}

export const PixelTooltip = ({ x, y, price, status }: PixelTooltipProps) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'available':
        return { 
          color: 'bg-success', 
          text: 'Available', 
          icon: Shield,
          description: 'Click to select this pixel'
        };
      case 'selected':
        return { 
          color: 'bg-primary', 
          text: 'Selected', 
          icon: Target,
          description: 'Added to your selection'
        };
      case 'sold':
        return { 
          color: 'bg-destructive', 
          text: 'Taken', 
          icon: User,
          description: 'This pixel is owned by another user'
        };
      case 'yours':
        return { 
          color: 'bg-accent', 
          text: 'Yours', 
          icon: Crown,
          description: 'You own this pixel'
        };
      default:
        return { 
          color: 'bg-muted', 
          text: 'Unknown', 
          icon: Shield,
          description: ''
        };
    }
  };

  const getPriceTier = () => {
    if (price === 299) return { text: 'Premium', icon: Crown, color: 'text-yellow-500' };
    if (price === 199) return { text: 'Standard', icon: Target, color: 'text-gray-500' };
    return { text: 'Basic', icon: Sparkles, color: 'text-amber-600' };
  };

  const statusInfo = getStatusInfo();
  const tierInfo = getPriceTier();
  const StatusIcon = statusInfo.icon;
  const TierIcon = tierInfo.icon;

  return (
    <div 
      className="fixed z-50 pointer-events-none"
      style={{
        left: '50%',
        bottom: '20px',
        transform: 'translateX(-50%)'
      }}
    >
      <div className="bg-background/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-lg border border-border/50 flex items-center gap-3">
        {/* Coordinates */}
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {x},{y}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border" />

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.color}`} />
          <span className="text-xs text-foreground">{statusInfo.text}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border" />

        {/* Price */}
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">₹{price}</span>
        </div>
      </div>
    </div>
  );
};