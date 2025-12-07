import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const StaticPixelPreview = () => {
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; content: string } | null>(null);
  const [pixelsSold, setPixelsSold] = useState(0);
  const [pixelsAvailable, setPixelsAvailable] = useState(50000);
  const [isLoading, setIsLoading] = useState(true);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  // Fetch purchased pixels with images for the ad rotation
  const { data: purchasedPixelsWithImages } = useQuery({
    queryKey: ["purchased-pixels-with-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pixels")
        .select("id, image_url, link_url, alt_text, x, y")
        .not("owner_id", "is", null)
        .not("image_url", "is", null)
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch real pixel data
  useEffect(() => {
    const fetchPixelStats = async () => {
      try {
        const { count, error } = await supabase
          .from('pixels')
          .select('*', { count: 'exact', head: true })
          .not('owner_id', 'is', null);

        if (error) throw error;
        
        const sold = count || 0;
        setPixelsSold(sold);
        setPixelsAvailable(50000 - sold);
      } catch (error) {
        console.error('Error fetching pixel stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPixelStats();
  }, []);

  // Rotate advertisement images every 5 seconds
  useEffect(() => {
    if (!purchasedPixelsWithImages || purchasedPixelsWithImages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % purchasedPixelsWithImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [purchasedPixelsWithImages]);

  // Mock data for preview pixels
  const previewPixels = [
    { x: 50, y: 30, color: "#FF6B6B", content: "🚀 StartupCo", type: "brand" },
    { x: 120, y: 45, color: "#4ECDC4", content: "💎 CryptoArt", type: "art" },
    { x: 80, y: 80, color: "#45B7D1", content: "🎮 GameStore", type: "brand" },
    { x: 180, y: 60, color: "#96CEB4", content: "📱 TechApp", type: "brand" },
    { x: 20, y: 100, color: "#FFEAA7", content: "🍕 FoodieHub", type: "brand" },
    { x: 150, y: 20, color: "#DDA0DD", content: "Reserved", type: "reserved" },
    { x: 200, y: 90, color: "#FFB6C1", content: "Available", type: "available" },
    { x: 30, y: 140, color: "#98D8C8", content: "🎨 ArtStudio", type: "art" },
    { x: 170, y: 130, color: "#F7DC6F", content: "🏠 RealEstate", type: "brand" },
    { x: 110, y: 110, color: "#BB8FCE", content: "💄 Beauty", type: "brand" },
  ];

  const gridSize = 20; // Size of each pixel cell
  const canvasWidth = 240; // Preview canvas width
  const canvasHeight = 160; // Preview canvas height

  return (
    <section className="pt-6 sm:pt-12 pb-16 sm:pb-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-8 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-foreground tracking-tight">
            Live Pixel <span className="bg-gradient-primary bg-clip-text text-transparent">Canvas</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
            See how brands and creators are already making their mark on our digital canvas
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Preview Canvas */}
          <div className="relative bg-card-premium rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-card mb-6 sm:mb-8 overflow-hidden">
            <div className="relative mx-auto w-full max-w-[280px] sm:max-w-none sm:w-[240px] aspect-[3/2] sm:aspect-auto" style={{ height: 'auto' }}>
              <div className="absolute inset-0" style={{ paddingBottom: '66.67%' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative" style={{ width: '100%', maxWidth: canvasWidth, aspectRatio: `${canvasWidth}/${canvasHeight}` }}>
                    {/* Grid Background */}
                    <div 
                      className="absolute inset-0 border-2 border-border rounded-lg bg-background"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                          linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
                        `,
                        backgroundSize: `${gridSize}px ${gridSize}px`
                      }}
                    />
                    
                    {/* Mock Pixels */}
                    {previewPixels.map((pixel, index) => (
                      <div
                        key={index}
                        className="absolute cursor-pointer transform transition-all duration-200 hover:scale-110 hover:z-10 rounded-sm"
                        style={{
                          left: `${(pixel.x / canvasWidth) * 100}%`,
                          top: `${(pixel.y / canvasHeight) * 100}%`,
                          width: `${(gridSize / canvasWidth) * 100}%`,
                          height: `${(gridSize / canvasHeight) * 100}%`,
                          backgroundColor: pixel.color,
                          boxShadow: pixel.type === 'available' ? 'inset 0 0 0 2px rgba(255,255,255,0.5)' : 'none'
                        }}
                        onMouseEnter={() => setHoveredPixel({ x: pixel.x, y: pixel.y, content: pixel.content })}
                        onMouseLeave={() => setHoveredPixel(null)}
                      />
                    ))}

                    {/* Dynamic Advertisement Box - Center of Grid */}
                    {purchasedPixelsWithImages && purchasedPixelsWithImages.length > 0 && (
                      <div
                        className="absolute z-30 bg-gradient-primary rounded-lg shadow-glow overflow-hidden border-2 border-primary/50"
                        style={{
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '35%',
                          height: '35%',
                          minWidth: '80px',
                          minHeight: '80px',
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center bg-card/95 backdrop-blur-sm">
                          <img
                            src={purchasedPixelsWithImages[currentAdIndex].image_url}
                            alt={purchasedPixelsWithImages[currentAdIndex].alt_text || "Advertisement"}
                            className="w-full h-full object-contain animate-fade-in p-1"
                            loading="eager"
                          />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-[0.5rem] sm:text-xs font-semibold text-center truncate">
                            Featured Ad {currentAdIndex + 1}/{purchasedPixelsWithImages.length}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tooltip */}
                    {hoveredPixel && (
                      <div
                        className="absolute z-20 bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium shadow-lg pointer-events-none whitespace-nowrap"
                        style={{
                          left: `${((hoveredPixel.x + gridSize + 5) / canvasWidth) * 100}%`,
                          top: `${(hoveredPixel.y / canvasHeight) * 100}%`,
                          transform: hoveredPixel.x > canvasWidth - 100 ? 'translateX(-100%)' : 'translateX(0)'
                        }}
                      >
                        {hoveredPixel.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Stats */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
              <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-primary">
                  {isLoading ? "..." : pixelsSold.toLocaleString()}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Pixels Sold</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-secondary">
                  {isLoading ? "..." : pixelsAvailable.toLocaleString()}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Available</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-success">
                  {isLoading ? "..." : `₹${(pixelsSold * 99 / 100000).toFixed(2)}L`}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Total Value</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                <div className="text-xl md:text-2xl font-bold text-accent">50K</div>
                <div className="text-xs md:text-sm text-muted-foreground">Total Pixels</div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/canvas" className="w-full sm:w-auto">
                <Button size="lg" className="btn-premium bg-gradient-primary hover:shadow-glow text-white px-8 py-4 text-base font-semibold border-0 w-full sm:min-w-[220px] h-14">
                  <Eye className="w-5 h-5 mr-2" />
                  View Live Canvas
                </Button>
              </Link>
              
              <Link to="/buy-pixels" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="hover-scale border-2 border-primary/60 text-primary hover:bg-primary hover:text-white px-8 py-4 text-base font-semibold w-full sm:min-w-[220px] h-14">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Buy Pixels Now
                </Button>
              </Link>
            </div>
            
            <p className="text-sm text-muted-foreground/80 mt-4">
              * This is a preview. The actual canvas contains 50,000 pixels (250x200)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StaticPixelPreview;