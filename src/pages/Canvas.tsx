import { useState, useEffect, useCallback } from "react";
import { VirtualizedPixelGrid } from "@/components/VirtualizedPixelGrid";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Grid3x3,
  AlertCircle,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Constants - Optimized for visual clarity
const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 100;
const PIXEL_SIZE = 5; // Balanced size for all devices (500x500px grid)
const ZOOM_STEP = 1.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

const Canvas = () => {
  // State
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showMyPixels, setShowMyPixels] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial load - just verify connection
  const initializeCanvas = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Quick ping to verify connection
      const { error: fetchError } = await supabase
        .from('pixels')
        .select('id')
        .limit(1);

      if (fetchError) {
        throw new Error(fetchError.message);
      }
    } catch (err) {
      console.error('Error loading canvas:', err);
      setError(err instanceof Error ? err.message : 'Failed to load canvas');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    initializeCanvas();
  }, [initializeCanvas]);

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
    initializeCanvas(true);
  }, [initializeCanvas]);

  // Retry error
  const handleRetry = useCallback(() => {
    initializeCanvas();
  }, [initializeCanvas]);

  // Loading state - Clean full-screen loader
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-slate-600 font-medium">Loading Canvas...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - Clean full-screen error
  if (error) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Error Loading Canvas</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button onClick={handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
      <Header />

      {/* Main Canvas Container - Full remaining height */}
      <div className="flex-1 relative overflow-hidden">
        {/* Desktop Controls - Left Side */}
        <TooltipProvider delayDuration={200}>
          <div className="absolute top-4 left-4 z-20 hidden md:flex flex-col gap-2">
            <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm">
              <CardContent className="p-2 flex flex-col gap-1">
                {/* Zoom In */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomIn}
                      disabled={zoom >= MAX_ZOOM}
                      className="h-9 w-9 hover:bg-slate-100"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Zoom In</TooltipContent>
                </Tooltip>

                {/* Zoom Level */}
                <div className="text-xs font-mono text-center py-1 text-slate-600 font-medium">
                  {Math.round(zoom * 100)}%
                </div>

                {/* Zoom Out */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomOut}
                      disabled={zoom <= MIN_ZOOM}
                      className="h-9 w-9 hover:bg-slate-100"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Zoom Out</TooltipContent>
                </Tooltip>

                <Separator className="my-1" />

                {/* Reset View */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleResetView}
                      className="h-9 w-9 hover:bg-slate-100"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Reset View</TooltipContent>
                </Tooltip>

                {/* Toggle Grid */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showGrid ? "secondary" : "ghost"}
                      size="icon"
                      onClick={handleToggleGrid}
                      className="h-9 w-9"
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Toggle Grid</TooltipContent>
                </Tooltip>

                <Separator className="my-1" />

                {/* Refresh */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="h-9 w-9 hover:bg-slate-100"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Refresh</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>

        {/* Mobile Controls - Bottom Floating Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 md:hidden">
          <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-md">
            <CardContent className="p-2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="h-8 w-8"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              
              <span className="text-xs font-mono w-10 text-center font-medium text-slate-700">
                {Math.round(zoom * 100)}%
              </span>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="h-8 w-8"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-5 mx-1" />
              
              <Button
                variant={showGrid ? "secondary" : "ghost"}
                size="icon"
                onClick={handleToggleGrid}
                className="h-8 w-8"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetView}
                className="h-8 w-8"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* The Pixel Grid */}
        <div className="w-full h-full">
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
        </div>
      </div>
    </div>
  );
};

export default Canvas;
