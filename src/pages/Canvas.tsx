import { useState, useEffect } from "react";
import { VirtualizedPixelGrid } from "@/components/VirtualizedPixelGrid";
import { EnhancedCanvasControls } from "@/components/EnhancedCanvasControls";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, TrendingUp, Users, Zap, ZoomIn, ZoomOut, RotateCcw, Grid3x3 } from "lucide-react";

interface PurchasedPixel {
  x: number;
  y: number;
  id: string;
  image_url?: string;
  link_url?: string;
  owner_id: string;
  price_tier: number;
  alt_text?: string;
  purchased_at: string;
}

const Canvas = () => {
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showMyPixels, setShowMyPixels] = useState(false);
  const [purchasedPixels, setPurchasedPixels] = useState<PurchasedPixel[]>([]);
  const [stats, setStats] = useState({
    totalPixels: 0,
    totalValue: 0,
    uniqueOwners: 0
  });

  // ✅ CORRECTED: 150×150 = 22,500 pixels
  const CANVAS_WIDTH = 150;
  const CANVAS_HEIGHT = 150;
  const PIXEL_SIZE = 4;

  // ✅ Accurate pricing calculation for 150×150 grid
  const calculatePixelPrice = (x: number, y: number): number => {
    const centerX = CANVAS_WIDTH / 2.0;  // 75
    const centerY = CANVAS_HEIGHT / 2.0; // 75
    const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2)); // 106.07
    const normalizedDistance = distanceFromCenter / maxDistance;
    
    if (normalizedDistance < 0.212) return 299; // Premium: 1,597 pixels
    if (normalizedDistance < 0.424) return 199; // Standard: 4,752 pixels
    return 99; // Economy: 16,151 pixels
  };

  useEffect(() => {
    loadPurchasedPixels();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('canvas-pixels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pixels' }, () => {
        loadPurchasedPixels();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPurchasedPixels = async () => {
    try {
      const { data, error } = await supabase
        .from('pixels')
        .select('*')
        .not('owner_id', 'is', null);

      if (error) {
        console.error('Failed to load purchased pixels:', error);
        return;
      }

      const pixels = (data || []).map((row) => ({
        id: row.id as string,
        x: row.x as number,
        y: row.y as number,
        owner_id: row.owner_id as string,
        image_url: row.image_url || undefined,
        link_url: row.link_url || undefined,
        price_tier: row.price_tier ?? 1,
        alt_text: row.alt_text || undefined,
        purchased_at: row.purchased_at || ''
      }));

      setPurchasedPixels(pixels);

      // ✅ CORRECTED: Calculate stats using accurate pricing
      const totalValue = pixels.reduce((sum, p) => {
        const price = calculatePixelPrice(p.x, p.y);
        return sum + price;
      }, 0);
      
      const uniqueOwners = new Set(pixels.map(p => p.owner_id)).size;

      setStats({
        totalPixels: pixels.length,
        totalValue,
        uniqueOwners
      });
    } catch (error) {
      console.error('Error loading pixels:', error);
    }
  };

  const handleResetView = () => {
    setZoom(1);
  };

  const handlePixelClick = (pixel: PurchasedPixel) => {
    if (pixel.link_url) {
      window.open(pixel.link_url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="text-center space-y-4">
            <Badge variant="secondary" className="mb-2">
              <Eye className="w-3 h-3 mr-1" />
              Live Canvas
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Pixel Canvas
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore {(CANVAS_WIDTH * CANVAS_HEIGHT).toLocaleString()} pixels of creativity. Click any pixel to visit its link.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Stats Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold truncate tabular-nums">{stats.totalPixels.toLocaleString()}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Pixels Owned</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold truncate tabular-nums">₹{stats.totalValue.toLocaleString()}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Total Value</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold tabular-nums">{stats.uniqueOwners}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Unique Owners</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold tabular-nums">
                    {((stats.totalPixels / (CANVAS_WIDTH * CANVAS_HEIGHT)) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">Canvas Filled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Canvas Section */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6">
          {/* Canvas Controls - Desktop Sidebar */}
          <div className="hidden xl:block xl:col-span-3">
            <div className="sticky top-20">
              <EnhancedCanvasControls
                zoom={zoom}
                onZoomChange={setZoom}
                isSelecting={false}
                onToggleSelecting={() => {}}
                showGrid={showGrid}
                onToggleGrid={() => setShowGrid(!showGrid)}
                showMyPixels={showMyPixels}
                onToggleMyPixels={() => setShowMyPixels(!showMyPixels)}
                onResetView={handleResetView}
                selectedCount={0}
              />
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="xl:hidden">
            <Card className="border-primary/20">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(prev => Math.max(0.5, prev / 1.2))}
                      disabled={zoom <= 0.5}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Badge variant="secondary" className="min-w-16 text-center tabular-nums">
                      {Math.round(zoom * 100)}%
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(prev => Math.min(8, prev * 1.2))}
                      disabled={zoom >= 8}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showGrid ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowGrid(!showGrid)}
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetView}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Canvas */}
          <div className="xl:col-span-9">
            <Card className="border-primary/20 overflow-hidden">
              <VirtualizedPixelGrid
                selectedPixels={[]}
                onSelectionChange={() => {}}
                isSelecting={false}
                gridWidth={CANVAS_WIDTH}
                gridHeight={CANVAS_HEIGHT}
                pixelSize={PIXEL_SIZE}
                zoom={zoom}
                onZoomChange={setZoom}
                showGrid={showGrid}
                showMyPixels={showMyPixels}
              />
            </Card>
          </div>
        </div>

        {/* Pricing Info Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Pricing Zones</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-yellow-500/20 border-2 border-yellow-500/50" />
                <div>
                  <p className="font-bold text-yellow-600 dark:text-yellow-400">₹299</p>
                  <p className="text-xs text-muted-foreground">Premium Center (1,597 px)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 border-2 border-blue-500/50" />
                <div>
                  <p className="font-bold text-blue-600 dark:text-blue-400">₹199</p>
                  <p className="text-xs text-muted-foreground">Standard Zone (4,752 px)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 border-2 border-green-500/50" />
                <div>
                  <p className="font-bold text-green-600 dark:text-green-400">₹99</p>
                  <p className="text-xs text-muted-foreground">Economy Zone (16,151 px)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Canvas;
