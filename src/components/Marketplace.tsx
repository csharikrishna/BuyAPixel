import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Marketplace = () => {
  const { toast } = useToast();

  const handleMarketplaceBuy = (listingTitle: string) => {
    toast({
      title: "Feature Coming Soon!",
      description: `Marketplace buying for "${listingTitle}" will be available soon. For now, you can buy fresh pixels!`,
    });
  };

  const handleListPixels = () => {
    toast({
      title: "Feature Coming Soon!",
      description: "Pixel listing functionality will be available soon. Purchase pixels first to list them later!",
    });
  };

  const listings = [
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
  ];

  return (
    <section id="marketplace" className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-base px-6 py-2.5 mb-6 font-semibold">
            🧱 Secondary Market
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Pixel <span className="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">Marketplace</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Buy and sell pixels from other users. Some pixels have already 5x their value!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          {listings.map((listing) => (
            <Card key={listing.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{listing.title}</CardTitle>
                  {listing.trending && (
                    <Badge variant="destructive" className="ml-2">🔥 Hot</Badge>
                  )}
                </div>
                <div className="text-muted-foreground text-sm">{listing.location}</div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-pixel-available border-2 border-border rounded-lg flex items-center justify-center text-4xl mb-3 mx-auto">
                    {listing.image}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {listing.pixels} pixels
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Original Price:</span>
                    <span className="line-through">₹{listing.originalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Resale Price:</span>
                    <span className="font-bold text-primary">₹{listing.resalePrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit:</span>
                    <span className="text-success font-semibold">
                      +{Math.round(((listing.resalePrice - listing.originalPrice) / listing.originalPrice) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    by {listing.seller}
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => handleMarketplaceBuy(listing.title)}
                >
                  💰 Buy Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-success/10 to-accent/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📈</span>
                <span>Market Stats</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pixels Resold:</span>
                  <span className="font-semibold">12,847</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Profit:</span>
                  <span className="font-semibold text-success">+143%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Highest Sale:</span>
                  <span className="font-semibold text-primary">₹2.5L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Listings:</span>
                  <span className="font-semibold">1,234</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-secondary/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>💸</span>
                <span>Want to Sell?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                List your pixels for resale and earn profits. Our marketplace makes it easy to find buyers.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                <li className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Set your own price</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>No listing fees</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Secure transactions</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                variant="gradient"
                onClick={handleListPixels}
              >
                List My Pixels
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default Marketplace;