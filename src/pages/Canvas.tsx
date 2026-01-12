import { useState, useEffect, useMemo, useCallback } from "react";
import { VirtualizedPixelGrid } from "@/components/VirtualizedPixelGrid";
import { EnhancedCanvasControls } from "@/components/EnhancedCanvasControls";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  TrendingUp,
  Users,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3x3,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Constants
const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 100;
const PIXEL_SIZE = 4;
const TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT; // 10,000
const ZOOM_STEP = 1.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

// Price thresholds (precomputed for performance)
const PREMIUM_THRESHOLD = 0.212;
const STANDARD_THRESHOLD = 0.424;
const PREMIUM_PRICE = 299;
const STANDARD_PRICE = 199;
const ECONOMY_PRICE = 99;

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

interface CanvasStats {
  totalPixels: number;
  totalValue: number;
  uniqueOwners: number;
  percentageFilled: number;
}

const Canvas = () => {
  // State
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showMyPixels, setShowMyPixels] = useState(false);
  const [purchasedPixels, setPurchasedPixels] = useState<PurchasedPixel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoized calculations for pricing (computed once)
  const pricingHelper = useMemo(() => {
    const centerX = CANVAS_WIDTH / 2.0;
    const centerY = CANVAS_HEIGHT / 2.0;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    return { centerX, centerY, maxDistance };
  }, []);

  // Optimized price calculation function
  const calculatePixelPrice = useCallback((x: number, y: number): number => {
    const { centerX, centerY } = pricingHelper;

    // Box-based pricing (Square zones)
    const dx = Math.abs(x - centerX);
    const dy = Math.abs(y - centerY);
    const maxDist = Math.max(dx, dy);

    // Gold Zone (40x40) -> Radius 20
    if (maxDist < 20) return PREMIUM_PRICE;

    // Standard Zone (80x80) -> Radius 40
    if (maxDist < 40) return STANDARD_PRICE;

    return ECONOMY_PRICE;
  }, [pricingHelper]);

  // Memoized stats calculation
  const stats: CanvasStats = useMemo(() => {
    if (purchasedPixels.length === 0) {
      return {
        totalPixels: 0,
        totalValue: 0,
        uniqueOwners: 0,
        percentageFilled: 0
      };
    }

    const totalValue = purchasedPixels.reduce((sum, p) => {
      return sum + calculatePixelPrice(p.x, p.y);
    }, 0);

    const uniqueOwners = new Set(purchasedPixels.map(p => p.owner_id)).size;
    const percentageFilled = (purchasedPixels.length / TOTAL_PIXELS) * 100;

    return {
      totalPixels: purchasedPixels.length,
      totalValue,
      uniqueOwners,
      percentageFilled
    };
  }, [purchasedPixels, calculatePixelPrice]);

  // Memoized pricing zone counts
  const pricingZones = useMemo(() => {
    // 100x100 Grid estimates based on square zones
    const premium = 1600; // 40x40
    const standard = 4800; // 80x80 - 1600
    const economy = 3600; // 10000 - 6400

    return { premium, standard, economy };
  }, []);

  // Load purchased pixels
  const loadPurchasedPixels = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      const { data, error: fetchError } = await supabase
        .from('pixels')
        .select('*')
        .not('owner_id', 'is', null);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const pixels: PurchasedPixel[] = (data || []).map((row) => ({
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
    } catch (err) {
      console.error('Error loading pixels:', err);
      setError(err instanceof Error ? err.message : 'Failed to load canvas data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPurchasedPixels();
  }, [loadPurchasedPixels]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('canvas-pixels')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pixels' },
        (payload) => {
          console.log('Canvas update received:', payload);
          loadPurchasedPixels(true); // Refresh with indicator
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPurchasedPixels]);

  // Debounced zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(MAX_ZOOM, prev * ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(MIN_ZOOM, prev / ZOOM_STEP));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
  }, []);

  const handleToggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);

  const handleToggleMyPixels = useCallback(() => {
    setShowMyPixels(prev => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    loadPurchasedPixels(true);
  }, [loadPurchasedPixels]);

  // Retry error
  const handleRetry = useCallback(() => {
    loadPurchasedPixels();
  }, [loadPurchasedPixels]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="text-center space-y-4">
              <Skeleton className="h-6 w-24 mx-auto" />
              <Skeleton className="h-12 md:h-16 w-64 md:w-96 mx-auto" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 md:py-8 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 md:h-8 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6">
            <div className="xl:col-span-9">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="w-full h-[600px]" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 py-12">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Canvas</AlertTitle>
            <AlertDescription className="mt-2">
              {error}
            </AlertDescription>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

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
              {isRefreshing && (
                <RefreshCw className="w-3 h-3 ml-2 animate-spin" />
              )}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Pixel Canvas
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore {TOTAL_PIXELS.toLocaleString()} pixels of creativity.
              Click any pixel to visit its link.
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
                  <p className="text-xl md:text-2xl font-bold truncate tabular-nums">
                    {stats.totalPixels.toLocaleString()}
                  </p>
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
                  <p className="text-xl md:text-2xl font-bold truncate tabular-nums">
                    ₹{stats.totalValue.toLocaleString()}
                  </p>
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
                  <p className="text-xl md:text-2xl font-bold tabular-nums">
                    {stats.uniqueOwners}
                  </p>
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
                    {stats.percentageFilled.toFixed(1)}%
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">Canvas Filled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Canvas Section */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6">
          {/* Desktop Controls Sidebar */}
          <div className="hidden xl:block xl:col-span-3">
            <div className="sticky top-20 space-y-4">
              <EnhancedCanvasControls
                zoom={zoom}
                onZoomChange={setZoom}
                isSelecting={false}
                onToggleSelecting={() => { }}
                showGrid={showGrid}
                onToggleGrid={handleToggleGrid}
                showMyPixels={showMyPixels}
                onToggleMyPixels={handleToggleMyPixels}
                onResetView={handleResetView}
                selectedCount={0}
              />

              <Card className="border-primary/20">
                <CardContent className="p-4">
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh Canvas
                  </Button>
                </CardContent>
              </Card>
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
                      onClick={handleZoomOut}
                      disabled={zoom <= MIN_ZOOM}
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Badge variant="secondary" className="min-w-16 text-center tabular-nums">
                      {Math.round(zoom * 100)}%
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleZoomIn}
                      disabled={zoom >= MAX_ZOOM}
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={showGrid ? "default" : "outline"}
                      size="sm"
                      onClick={handleToggleGrid}
                      aria-label="Toggle grid"
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetView}
                      aria-label="Reset view"
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
                onSelectionChange={() => { }}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pricing Zones</h3>
              <Badge variant="outline">
                {TOTAL_PIXELS.toLocaleString()} Total Pixels
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-yellow-500/20 border-2 border-yellow-500/50 shrink-0" />
                <div>
                  <p className="font-bold text-yellow-600 dark:text-yellow-400">
                    ₹{PREMIUM_PRICE}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Premium Center ({pricingZones.premium.toLocaleString()} px)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 border-2 border-blue-500/50 shrink-0" />
                <div>
                  <p className="font-bold text-blue-600 dark:text-blue-400">
                    ₹{STANDARD_PRICE}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Standard Zone ({pricingZones.standard.toLocaleString()} px)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 border-2 border-green-500/50 shrink-0" />
                <div>
                  <p className="font-bold text-green-600 dark:text-green-400">
                    ₹{ECONOMY_PRICE}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Economy Zone ({pricingZones.economy.toLocaleString()} px)
                  </p>
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
