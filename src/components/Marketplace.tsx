import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { memo, useCallback } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  ArrowUpRight,
  CheckCircle2 
} from "lucide-react";

// Type definitions for better type safety
interface MarketplaceListing {
  id: number;
  title: string;
  pixels: number;
  originalPrice: number;
  resalePrice: number;
  seller: string;
  location: string;
  image: string;
  trending: boolean;
}

interface MarketStat {
  label: string;
  value: string;
  highlight?: boolean;
}

interface SellerBenefit {
  text: string;
}

// Constants extracted for maintainability
const MARKETPLACE_LISTINGS: readonly MarketplaceListing[] = [
  {
    id: 1,
    title: "Premium Corner Spot",
    pixels: 100,
    originalPrice: 10000,
    resalePrice: 15000,
    seller: "TechStartup",
    location: "Top-left corner",
    image: "🚀",
    trending: true
  },
  {
    id: 2,
    title: "Meme Collection",
    pixels: 25,
    originalPrice: 2500,
    resalePrice: 4000,
    seller: "MemeLord",
    location: "Center area",
    image: "😂",
    trending: false
  },
  {
    id: 3,
    title: "Brand Logo Space",
    pixels: 64,
    originalPrice: 6400,
    resalePrice: 8500,
    seller: "BrandHub",
    location: "Right side",
    image: "🎯",
    trending: true
  },
  {
    id: 4,
    title: "Crypto Banner",
    pixels: 200,
    originalPrice: 20000,
    resalePrice: 35000,
    seller: "CryptoKing",
    location: "Center bottom",
    image: "₿",
    trending: false
  }
] as const;

const MARKET_STATS: readonly MarketStat[] = [
  { label: "Pixels Resold", value: "12,847" },
  { label: "Average Profit", value: "+143%", highlight: true },
  { label: "Highest Sale", value: "₹2.5L", highlight: true },
  { label: "Active Listings", value: "1,234" }
] as const;

const SELLER_BENEFITS: readonly SellerBenefit[] = [
  { text: "Set your own price" },
  { text: "No listing fees" },
  { text: "Secure transactions" },
  { text: "Instant notifications" }
] as const;

// Utility function to calculate profit percentage
const calculateProfitPercentage = (resalePrice: number, originalPrice: number): number => {
  return Math.round(((resalePrice - originalPrice) / originalPrice) * 100);
};

// Memoized listing card component
const ListingCard = memo(({ 
  listing, 
  onBuy 
}: { 
  listing: MarketplaceListing; 
  onBuy: (title: string) => void;
}) => {
  const profitPercentage = calculateProfitPercentage(listing.resalePrice, listing.originalPrice);

  return (
    <Card 
      className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border-2 hover:border-primary/50"
      role="article"
      aria-label={`${listing.title} listing by ${listing.seller}`}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-bold leading-tight">
            {listing.title}
          </CardTitle>
          {listing.trending && (
            <Badge 
              variant="destructive" 
              className="ml-2 shrink-0 animate-pulse shadow-md"
            >
              <TrendingUp className="w-3 h-3 mr-1" aria-hidden="true" />
              Hot
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground text-sm font-medium flex items-center gap-1">
          <Package className="w-3.5 h-3.5" aria-hidden="true" />
          {listing.location}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-5">
        {/* Preview Box */}
        <div className="text-center">
          <div 
            className="w-24 h-24 bg-gradient-to-br from-pixel-available to-primary/10 border-2 border-primary/20 rounded-xl flex items-center justify-center text-5xl mb-3 mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-md"
            role="img"
            aria-label={`Preview showing ${listing.image}`}
          >
            {listing.image}
          </div>
          <div className="text-sm text-muted-foreground font-semibold">
            {listing.pixels} pixels
          </div>
        </div>

        {/* Pricing Details */}
        <div className="space-y-3 bg-muted/30 rounded-lg p-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Original Price:</span>
            <span className="line-through text-muted-foreground font-medium">
              ₹{listing.originalPrice.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-base">Resale Price:</span>
            <span className="font-bold text-xl text-primary">
              ₹{listing.resalePrice.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Potential Profit:</span>
            <span className="text-success font-bold flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              +{profitPercentage}%
            </span>
          </div>
        </div>

        {/* Seller Info */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-sm text-muted-foreground">
            Listed by <span className="font-semibold text-foreground">{listing.seller}</span>
          </div>
        </div>

        {/* Buy Button */}
        <Button 
          className="w-full font-semibold group/btn hover:scale-105 active:scale-95 transition-all" 
          variant="default"
          size="lg"
          onClick={() => onBuy(listing.title)}
          aria-label={`Buy ${listing.title} for ${listing.resalePrice} rupees`}
        >
          <DollarSign className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" aria-hidden="true" />
          Buy Now
        </Button>
      </CardContent>
    </Card>
  );
});

ListingCard.displayName = "ListingCard";

// Main Marketplace Component
const Marketplace = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle marketplace purchase with toast notification
  const handleMarketplaceBuy = useCallback((listingTitle: string) => {
    toast({
      title: "Feature Coming Soon! 🚀",
      description: `Marketplace buying for "${listingTitle}" will be available soon. For now, you can buy fresh pixels!`,
      duration: 4000,
    });
  }, [toast]);

  // Handle listing pixels - redirects to /marketplace
  const handleListPixels = useCallback(() => {
    navigate('/marketplace');
    toast({
      title: "Listing Your Pixels",
      description: "You'll be able to list your pixels for resale here soon. Purchase pixels first!",
      duration: 4000,
    });
  }, [navigate, toast]);

  return (
    <section 
      id="marketplace" 
      className="py-24 bg-gradient-to-b from-background via-muted/20 to-background scroll-mt-20"
      aria-labelledby="marketplace-heading"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Header Section */}
        <header className="text-center mb-20 space-y-6">
          <Badge 
            variant="outline" 
            className="text-base px-6 py-2.5 mb-6 font-semibold border-2 hover:bg-accent/5 transition-colors"
          >
            <span role="img" aria-label="Building blocks">🧱</span> Secondary Market
          </Badge>
          <h2 
            id="marketplace-heading"
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight"
          >
            Pixel{" "}
            <span className="bg-gradient-to-r from-accent via-purple-500 to-success bg-clip-text text-transparent">
              Marketplace
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Buy and sell pixels from other users. Some pixels have already increased their value by 5x!
          </p>
        </header>

        {/* Listings Grid */}
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16"
          role="region"
          aria-label="Available marketplace listings"
        >
          {MARKETPLACE_LISTINGS.map((listing) => (
            <ListingCard 
              key={listing.id} 
              listing={listing} 
              onBuy={handleMarketplaceBuy}
            />
          ))}
        </div>

        {/* Market Stats and Seller Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Market Statistics Card */}
          <Card 
            className="bg-gradient-to-br from-success/10 via-accent/5 to-green-500/10 border-2 hover:shadow-xl transition-all duration-300"
            role="region"
            aria-labelledby="market-stats-heading"
          >
            <CardHeader>
              <CardTitle 
                id="market-stats-heading"
                className="flex items-center gap-3 text-2xl"
              >
                <span className="text-3xl" role="img" aria-label="Chart increasing">📈</span>
                <span>Market Statistics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5" role="list">
                {MARKET_STATS.map((stat, index) => (
                  <div 
                    key={index}
                    className="flex justify-between items-center p-3 rounded-lg hover:bg-background/50 transition-colors group"
                    role="listitem"
                  >
                    <span className="text-muted-foreground font-medium">
                      {stat.label}:
                    </span>
                    <span 
                      className={`font-bold text-lg group-hover:scale-110 transition-transform ${
                        stat.highlight 
                          ? stat.value.includes('%') 
                            ? 'text-success' 
                            : 'text-primary'
                          : 'text-foreground'
                      }`}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Seller Information Card */}
          <Card 
            className="bg-gradient-to-br from-primary/10 via-secondary/5 to-purple-500/10 border-2 hover:shadow-xl transition-all duration-300"
            role="region"
            aria-labelledby="seller-info-heading"
          >
            <CardHeader>
              <CardTitle 
                id="seller-info-heading"
                className="flex items-center gap-3 text-2xl"
              >
                <span className="text-3xl" role="img" aria-label="Money with wings">💸</span>
                <span>Want to Sell?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground leading-relaxed text-base">
                List your pixels for resale and earn profits. Our marketplace makes it easy to connect with buyers.
              </p>
              
              {/* Benefits List */}
              <ul className="space-y-3" role="list">
                {SELLER_BENEFITS.map((benefit, index) => (
                  <li 
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors group"
                  >
                    <CheckCircle2 
                      className="w-5 h-5 text-green-500 flex-shrink-0 group-hover:scale-110 transition-transform" 
                      aria-hidden="true"
                    />
                    <span className="text-foreground font-medium">{benefit.text}</span>
                  </li>
                ))}
              </ul>

              {/* List Pixels Button */}
              <Button 
                className="w-full font-bold text-base h-12 group/btn hover:scale-105 active:scale-95 transition-all shadow-lg bg-gradient-to-r from-primary to-secondary"
                size="lg"
                onClick={handleListPixels}
                aria-label="Navigate to list your pixels for sale"
              >
                <Package className="w-5 h-5 mr-2 group-hover/btn:rotate-12 transition-transform" aria-hidden="true" />
                List My Pixels
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Don't own any pixels yet?
          </p>
          <Link to="/buy-pixels" aria-label="Navigate to buy fresh pixels">
            <Button 
              variant="outline" 
              size="lg"
              className="font-semibold hover:scale-105 transition-all"
            >
              Buy Fresh Pixels
              <ArrowUpRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default memo(Marketplace);
