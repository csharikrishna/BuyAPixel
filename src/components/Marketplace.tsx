import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { memo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  DollarSign,
  Package,
  ArrowUpRight,
  CheckCircle2,
  Store
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---
interface MarketplaceListing {
  id: string;
  pixel_id: string;
  selling_price: number;
  featured: boolean;
  created_at: string;
  pixels: {
    x: number;
    y: number;
    image_url: string | null;
  } | null;
  profiles: {
    full_name: string | null;
  } | null;
}

interface MarketplaceStats {
  active_listings: number;
  total_sold: number;
  average_price: number;
  highest_price: number;
}

interface SellerBenefit {
  text: string;
}

const SELLER_BENEFITS: readonly SellerBenefit[] = [
  { text: "Set your own price" },
  { text: "No listing fees" },
  { text: "Secure transactions" },
  { text: "Instant notifications" }
] as const;

// --- Sub-components ---

const ListingCardSkeleton = () => (
  <Card className="overflow-hidden border-2">
    <CardHeader className="pb-4 space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent className="space-y-5">
      <Skeleton className="w-24 h-24 rounded-xl mx-auto" />
      <div className="space-y-3 bg-muted/30 rounded-lg p-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

const ListingCard = memo(({
  listing,
  onBuy
}: {
  listing: MarketplaceListing;
  onBuy: (id: string, price: number) => void;
}) => {
  // Safe defaults if data is missing
  const x = listing.pixels?.x ?? 0;
  const y = listing.pixels?.y ?? 0;
  const price = listing.selling_price ?? 0;
  const sellerName = listing.profiles?.full_name ?? "Anonymous";
  const imageUrl = listing.pixels?.image_url;

  return (
    <Card
      className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border-2 hover:border-primary/50"
      role="article"
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-bold leading-tight">
            Pixel ({x}, {y})
          </CardTitle>
          {listing.featured && (
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
          Secondary Market
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Preview Box */}
        <div className="text-center">
          <div
            className="w-24 h-24 bg-gradient-to-br from-muted to-primary/10 border-2 border-primary/20 rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-md overflow-hidden"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`Pixel at ${x},${y}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-4xl">📍</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground font-semibold">
            By {sellerName}
          </div>
        </div>

        {/* Pricing Details */}
        <div className="space-y-3 bg-muted/30 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-base py-1">Price:</span>
            <span className="font-bold text-xl text-primary">
              ₹{price.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Buy Button */}
        <Button
          className="w-full font-semibold group/btn hover:scale-105 active:scale-95 transition-all"
          variant="default"
          size="lg"
          onClick={() => onBuy(listing.id, price)}
        >
          <DollarSign className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" aria-hidden="true" />
          Buy Now
        </Button>
      </CardContent>
    </Card>
  );
});

ListingCard.displayName = "ListingCard";

// --- Main Component ---

const Marketplace = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch Marketplace Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['marketplace_stats_landing'],
    queryFn: async () => {
      // Try fetching from edge function first
      try {
        const { data, error } = await supabase.functions.invoke('get_marketplace_stats');
        if (!error && data) return data as MarketplaceStats;
      } catch (e) {
        console.warn('Edge function failed, falling back to basic calculation', e);
      }

      // Fallback: simple query (less accurate for complex stats but works)
      const { count: activeCount } = await supabase
        .from('marketplace_listings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      return {
        active_listings: activeCount || 0,
        total_sold: 0, // Hard to calc without specialized query
        average_price: 0,
        highest_price: 0
      } as MarketplaceStats;
    }
  });

  // Fetch Featured/Recent Listings
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['marketplace_listings_landing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select(`
          id,
          pixel_id,
          asking_price,
          featured,
          created_at,
          pixels (x, y, image_url),
          profiles:seller_id (full_name)
        `)
        .eq('status', 'active')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;

      // Map to cleaner interface
      return data.map((item: any) => ({
        id: item.id,
        pixel_id: item.pixel_id,
        selling_price: Number(item.asking_price),
        featured: item.featured,
        created_at: item.created_at,
        pixels: item.pixels,
        profiles: item.profiles
      })) as MarketplaceListing[];
    }
  });

  const handleMarketplaceBuy = useCallback((id: string, price: number) => {
    navigate('/marketplace');
    toast({
      title: "View Listing",
      description: "Redirecting you to the full marketplace view...",
      duration: 2000,
    });
  }, [navigate, toast]);

  const handleListPixels = useCallback(() => {
    navigate('/marketplace');
    toast({
      title: "List Your Pixels",
      description: "Go to the 'Sell' tab in the marketplace to list your pixels.",
      duration: 3000,
    });
  }, [navigate, toast]);

  // Prepared stats for display
  const displayStats = [
    { label: "Active Listings", value: stats?.active_listings?.toLocaleString() ?? "...", highlight: false },
    { label: "Total Sold", value: stats?.total_sold?.toLocaleString() ?? "...", highlight: false },
    { label: "Avg Price", value: stats?.average_price ? `₹${Math.round(stats.average_price).toLocaleString()}` : "...", highlight: true },
    { label: "Highest Price", value: stats?.highest_price ? `₹${stats.highest_price.toLocaleString()}` : "...", highlight: true },
  ];

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
          {listingsLoading ? (
            // Skeletons
            Array(4).fill(0).map((_, i) => <ListingCardSkeleton key={i} />)
          ) : listings && listings.length > 0 ? (
            // Real Data
            listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onBuy={handleMarketplaceBuy}
              />
            ))
          ) : (
            // Empty State
            <div className="col-span-full text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
              <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No active listings yet</h3>
              <p className="text-muted-foreground mb-6">Be the first to list a pixel for sale!</p>
              <Button onClick={handleListPixels} variant="outline">
                List a Pixel
              </Button>
            </div>
          )}
        </div>

        {/* Market Stats and Seller Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Market Statistics Card */}
          <Card
            className="bg-gradient-to-br from-success/10 via-accent/5 to-green-500/10 border-2 hover:shadow-xl transition-all duration-300"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <span className="text-3xl" role="img" aria-label="Chart increasing">📈</span>
                <span>Market Statistics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {statsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  displayStats.map((stat, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 rounded-lg hover:bg-background/50 transition-colors group"
                    >
                      <span className="text-muted-foreground font-medium">
                        {stat.label}:
                      </span>
                      <span
                        className={`font-bold text-lg group-hover:scale-110 transition-transform ${stat.highlight ? 'text-primary' : 'text-foreground'
                          }`}
                      >
                        {stat.value}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seller Information Card */}
          <Card
            className="bg-gradient-to-br from-primary/10 via-secondary/5 to-purple-500/10 border-2 hover:shadow-xl transition-all duration-300"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <span className="text-3xl" role="img" aria-label="Money with wings">💸</span>
                <span>Want to Sell?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground leading-relaxed text-base">
                List your pixels for resale and earn profits. Our marketplace makes it easy to connect with buyers.
              </p>

              {/* Benefits List */}
              <ul className="space-y-3">
                {SELLER_BENEFITS.map((benefit, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors group"
                  >
                    <CheckCircle2
                      className="w-5 h-5 text-green-500 flex-shrink-0 group-hover:scale-110 transition-transform"
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
              >
                <Package className="w-5 h-5 mr-2 group-hover/btn:rotate-12 transition-transform" />
                List My Pixels
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
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
