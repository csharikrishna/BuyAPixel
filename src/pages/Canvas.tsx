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
import { Separator } from "@/components/ui/separator";

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
        price_tier: (row as any).price_tier ?? 1,
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

      <div className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden relative">
        {/* Controls Overlay */}
        <div className="absolute top-4 left-4 z-10 hidden xl:block">
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
          <div className="mt-4">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="icon"
              className="bg-background/90 backdrop-blur shadow-md"
              disabled={isRefreshing}
              title="Refresh Canvas"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Mobile Controls */}
        <div className="absolute bottom-4 left-4 right-4 z-10 xl:hidden flex justify-center gap-2 pointer-events-none">
          <Card className="border-primary/20 pointer-events-auto shadow-lg backdrop-blur-md bg-background/90">
            <CardContent className="p-2 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Separator orientation="vertical" className="h-4" />
              <Button
                variant={showGrid ? "secondary" : "ghost"}
                size="sm"
                onClick={handleToggleGrid}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Canvas */}
        <div className="w-full h-full relative z-0">
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
        </div>
      </div>
    </div>
  );
};

export default Canvas;
