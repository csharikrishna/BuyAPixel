import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Store, 
  ShoppingCart, 
  Tag, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  SortAsc
} from "lucide-react";

interface MarketplaceListing {
  id: string;
  pixel_id: string;
  seller_id: string;
  asking_price: number;
  created_at: string;
  pixels: {
    x: number;
    y: number;
    image_url: string | null;
    link_url: string | null;
  } | null;
  seller_profile?: {
    full_name: string | null;
  } | null;
}

const MarketplacePage = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [selectedPixelId, setSelectedPixelId] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high">("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: listings, refetch: refetchListings } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`
          id,
          pixel_id,
          seller_id,
          asking_price,
          created_at,
          status,
          pixels (x, y, image_url, link_url)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const listingsWithProfiles = await Promise.all(
        (data || []).map(async (listing: any) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", listing.seller_id)
            .maybeSingle();
          
          return {
            ...listing,
            seller_profile: profileData,
          };
        })
      );
      
      return listingsWithProfiles as MarketplaceListing[];
    },
  });

  const { data: userPixels, refetch: refetchUserPixels } = useQuery({
    queryKey: ["user-pixels", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data: activeListings } = await supabase
        .from("marketplace_listings")
        .select("pixel_id")
        .eq("seller_id", session.user.id)
        .eq("status", "active");

      const listedPixelIds = activeListings?.map(l => l.pixel_id) || [];

      const { data, error } = await supabase
        .from("pixels")
        .select("*")
        .eq("owner_id", session.user.id)
        .eq("is_active", true);

      if (error) throw error;
      
      return data.filter(pixel => !listedPixelIds.includes(pixel.id));
    },
    enabled: !!session?.user?.id,
  });

  // Filter and sort listings
  const filteredAndSortedListings = listings
    ?.filter((listing) => {
      if (!searchQuery) return true;
      const searchLower = searchQuery.toLowerCase();
      const sellerName = listing.seller_profile?.full_name?.toLowerCase() || "";
      const coordinates = `${listing.pixels?.x},${listing.pixels?.y}`;
      return sellerName.includes(searchLower) || coordinates.includes(searchQuery);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.asking_price - b.asking_price;
        case "price-high":
          return b.asking_price - a.asking_price;
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const handleBuyFromMarketplace = async (listingId: string, price: number) => {
    if (!session) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to purchase from the marketplace",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc("purchase_from_marketplace", {
        listing_id: listingId,
      });

      if (error) throw error;

      const result = data as any;

      if (result?.success) {
        toast({
          title: "Purchase Successful",
          description: `You have successfully acquired a pixel for ₹${price.toLocaleString()}`,
        });
        refetchListings();
      } else {
        toast({
          title: "Transaction Failed",
          description: result?.error || "Unable to complete purchase",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleListPixel = async () => {
    if (!session || !selectedPixelId || !listingPrice) {
      toast({
        title: "Incomplete Information",
        description: "Please select a pixel and enter a listing price",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(listingPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than zero",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("marketplace_listings").insert({
        pixel_id: selectedPixelId,
        seller_id: session.user.id,
        asking_price: price,
      });

      if (error) throw error;

      toast({
        title: "Listing Created Successfully",
        description: `Your pixel is now available for ₹${price.toLocaleString()}`,
      });
      
      setSelectedPixelId(null);
      setListingPrice("");
      setIsDialogOpen(false);
      refetchListings();
      refetchUserPixels();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to create listing",
        variant: "destructive",
      });
    }
  };

  const handleRemoveListing = async (listingId: string) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ status: "cancelled" })
        .eq("id", listingId)
        .eq("seller_id", session.user.id);

      if (error) throw error;

      toast({
        title: "Listing Removed",
        description: "Your pixel has been removed from the marketplace",
      });

      refetchListings();
      refetchUserPixels();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Unable to remove listing",
        variant: "destructive",
      });
    }
  };

  const isUserListing = (listing: MarketplaceListing) => {
    return session?.user?.id === listing.seller_id;
  };

  const totalListings = listings?.length || 0;
  const averagePrice = listings?.length 
    ? Math.round(listings.reduce((sum, l) => sum + l.asking_price, 0) / listings.length)
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <section className="py-8 md:py-16 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
            {/* Header Section */}
            <div className="text-center mb-8 md:mb-12">
              <Badge variant="outline" className="text-sm md:text-base px-4 md:px-6 py-2 md:py-2.5 mb-4 md:mb-6 font-semibold border-primary/20">
                <Store className="w-4 h-4 mr-2 inline-block" />
                Secondary Market
              </Badge>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 tracking-tight">
                Pixel <span className="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">Marketplace</span>
              </h1>
              <p className="text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
                Buy and sell digital pixels in a secure, transparent marketplace
              </p>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
              <Card className="border-primary/10">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {totalListings}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">
                    Active Listings
                  </div>
                </CardContent>
              </Card>
              <Card className="border-primary/10">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-success mb-1">
                    ₹{averagePrice.toLocaleString()}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">
                    Average Price
                  </div>
                </CardContent>
              </Card>
              <Card className="border-primary/10 col-span-2 md:col-span-1">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-accent mb-1">
                    {userPixels?.length || 0}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">
                    Your Available Pixels
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* List Pixel Button */}
            {session && (
              <div className="mb-8 md:mb-12 flex justify-center">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="gradient" size="lg" className="w-full sm:w-auto h-12 text-base font-semibold">
                      <Tag className="w-5 h-5 mr-2" />
                      List Pixel for Sale
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-xl">
                        <Tag className="w-5 h-5 text-primary" />
                        Create Marketplace Listing
                      </DialogTitle>
                      <DialogDescription className="text-base">
                        Select a pixel you own and set your asking price
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-4">
                      {userPixels && userPixels.length > 0 ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="pixel-select" className="text-sm font-medium">
                              Select Pixel
                            </Label>
                            <select
                              id="pixel-select"
                              className="w-full mt-2 p-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                              value={selectedPixelId || ""}
                              onChange={(e) => setSelectedPixelId(e.target.value)}
                            >
                              <option value="">Choose a pixel...</option>
                              {userPixels.map((pixel) => (
                                <option key={pixel.id} value={pixel.id}>
                                  Pixel at position ({pixel.x}, {pixel.y})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="price" className="text-sm font-medium">
                              Asking Price (₹)
                            </Label>
                            <Input
                              id="price"
                              type="number"
                              placeholder="Enter your price"
                              value={listingPrice}
                              onChange={(e) => setListingPrice(e.target.value)}
                              min="1"
                              step="1"
                              className="mt-2 h-11 text-base"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Average market price: ₹{averagePrice.toLocaleString()}
                            </p>
                          </div>
                          <Button 
                            onClick={handleListPixel} 
                            className="w-full h-11 text-base font-semibold"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Create Listing
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-8 space-y-3">
                          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground">
                            You don't have any available pixels to list.
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Purchase pixels from the main canvas first.
                          </p>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Search and Filter Section */}
            <div className="mb-6 md:mb-8 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by seller or coordinates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 text-base"
                  />
                </div>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-full sm:w-[180px] h-11">
                    <SortAsc className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Listings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredAndSortedListings && filteredAndSortedListings.length > 0 ? (
                filteredAndSortedListings.map((listing) => {
                  const userOwnsListing = isUserListing(listing);
                  
                  return (
                    <Card 
                      key={listing.id} 
                      className={`group transition-all duration-300 overflow-hidden ${
                        userOwnsListing 
                          ? 'border-primary/50 bg-primary/5 hover:shadow-xl hover:border-primary' 
                          : 'hover:shadow-lg hover:border-border'
                      }`}
                    >
                      <CardHeader className="pb-3 md:pb-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base md:text-lg font-semibold">
                            Pixel ({listing.pixels?.x || 0}, {listing.pixels?.y || 0})
                          </CardTitle>
                          {userOwnsListing && (
                            <Badge variant="secondary" className="text-xs font-medium">
                              Your Listing
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs md:text-sm flex items-center gap-1">
                          <span className="truncate">
                            Listed by {listing.seller_profile?.full_name || "Anonymous"}
                          </span>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Pixel Preview */}
                        <div className="relative">
                          <div className="w-full aspect-square bg-muted border-2 border-border rounded-lg flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
                            {listing.pixels?.image_url ? (
                              <img
                                src={listing.pixels.image_url}
                                alt="Pixel preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-5xl">📍</span>
                            )}
                          </div>
                        </div>

                        {/* Price Display */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <span className="font-medium text-sm md:text-base">
                              Asking Price
                            </span>
                            <span className="font-bold text-primary text-lg md:text-xl">
                              ₹{listing.asking_price.toLocaleString()}
                            </span>
                          </div>

                          {/* Action Button */}
                          {userOwnsListing ? (
                            <Button 
                              className="w-full h-11 font-semibold" 
                              variant="destructive"
                              onClick={() => handleRemoveListing(listing.id)}
                            >
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Remove Listing
                            </Button>
                          ) : (
                            <Button 
                              className="w-full h-11 font-semibold" 
                              variant="default"
                              onClick={() => handleBuyFromMarketplace(listing.id, listing.asking_price)}
                              disabled={!session}
                            >
                              {!session ? (
                                <>
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Sign In to Purchase
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="w-4 h-4 mr-2" />
                                  Purchase Now
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-16 md:py-24">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
                      <Store className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-semibold">
                      {searchQuery ? "No Results Found" : "No Active Listings"}
                    </h3>
                    <p className="text-muted-foreground text-sm md:text-base">
                      {searchQuery 
                        ? "Try adjusting your search criteria" 
                        : "Be the first to list a pixel for sale"}
                    </p>
                    {session && !searchQuery && (
                      <Button 
                        variant="outline" 
                        onClick={() => setIsDialogOpen(true)}
                        className="mt-4"
                      >
                        <Tag className="w-4 h-4 mr-2" />
                        Create First Listing
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default MarketplacePage;
