import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2,
  MousePointer,
  Hand,
  Search,
  Grid3X3,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Settings,
  Keyboard
} from "lucide-react";

interface EnhancedCanvasControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isSelecting: boolean;
  onToggleSelecting: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showMyPixels: boolean;
  onToggleMyPixels: () => void;
  onResetView: () => void;
  selectedCount: number;
}

export const EnhancedCanvasControls = ({
  zoom,
  onZoomChange,
  isSelecting,
  onToggleSelecting,
  showGrid,
  onToggleGrid,
  showMyPixels,
  onToggleMyPixels,
  onResetView,
  selectedCount
}: EnhancedCanvasControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => {
    onZoomChange(Math.min(8, zoom * 1.2));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(0.5, zoom / 1.2));
  };

  // Collapsed icon-only sidebar
  if (!isExpanded) {
    return (
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <Card className="card-premium shadow-lg">
          <CardContent className="p-2 space-y-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(true)}
              title="Expand controls"
              className="w-10 h-10"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Separator />
            
            <Button
              variant={isSelecting ? "default" : "ghost"}
              size="icon"
              onClick={onToggleSelecting}
              title={isSelecting ? "Switch to panning" : "Switch to selecting"}
              className="w-10 h-10"
            >
              {isSelecting ? (
                <MousePointer className="w-4 h-4" />
              ) : (
                <Hand className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 8}
              title="Zoom in"
              className="w-10 h-10"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="Zoom out"
              className="w-10 h-10"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>

            <Button
              variant={showGrid ? "default" : "ghost"}
              size="icon"
              onClick={onToggleGrid}
              title={showGrid ? "Hide grid" : "Show grid"}
              className="w-10 h-10"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>

            <Button
              variant={showMyPixels ? "default" : "ghost"}
              size="icon"
              onClick={onToggleMyPixels}
              title={showMyPixels ? "Hide my pixels" : "Show my pixels"}
              className="w-10 h-10"
            >
              {showMyPixels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>

            <Separator />

            <Button
              variant="ghost"
              size="icon"
              onClick={onResetView}
              title="Reset view"
              className="w-10 h-10"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            {selectedCount > 0 && (
              <Badge 
                variant="default" 
                className="w-10 h-6 flex items-center justify-center animate-pulse"
              >
                {selectedCount}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expanded full sidebar
  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-primary" />
              Canvas Controls
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-8"
              title="Collapse to icons"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          {/* Selection Mode Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Selection Mode</span>
              {selectedCount > 0 && (
                <Badge variant="default" className="animate-pulse">
                  {selectedCount}
                </Badge>
              )}
            </div>
            <Button
              variant={isSelecting ? "default" : "outline"}
              size="sm"
              onClick={onToggleSelecting}
              className="transition-all duration-200"
            >
              {isSelecting ? (
                <>
                  <MousePointer className="w-4 h-4 mr-1" />
                  Selecting
                </>
              ) : (
                <>
                  <Hand className="w-4 h-4 mr-1" />
                  Panning
                </>
              )}
            </Button>
          </div>

          <Separator className="my-4" />

          {/* Zoom Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Zoom Level</span>
              <Badge variant="outline" className="font-mono">
                {zoomPercentage}%
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="flex-1"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onZoomChange(1)}
                className="px-3"
                title="Reset zoom to 100%"
              >
                100%
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 8}
                className="flex-1"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onZoomChange(0.5)}
                className="flex-1 text-xs"
              >
                <Search className="w-3 h-3 mr-1" />
                Overview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onZoomChange(4)}
                className="flex-1 text-xs"
              >
                <Maximize2 className="w-3 h-3 mr-1" />
                Detail
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* View Options */}
          <div className="space-y-3">
            <span className="text-sm font-medium">View Options</span>
            
            <div className="grid gap-2">
              <Button
                variant={showGrid ? "default" : "outline"}
                size="sm"
                onClick={onToggleGrid}
                className="w-full justify-start"
              >
                <Grid3X3 className="w-4 h-4 mr-2" />
                {showGrid ? 'Hide Grid' : 'Show Grid'}
              </Button>
              
              <Button
                variant={showMyPixels ? "default" : "outline"}
                size="sm"
                onClick={onToggleMyPixels}
                className="w-full justify-start"
              >
                {showMyPixels ? (
                  <Eye className="w-4 h-4 mr-2" />
                ) : (
                  <EyeOff className="w-4 h-4 mr-2" />
                )}
                {showMyPixels ? 'Hide My Pixels' : 'Show My Pixels'}
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Reset and Shortcuts */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onResetView}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset View
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="w-full"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              {showShortcuts ? 'Hide' : 'Show'} Shortcuts
            </Button>
          </div>

          {/* Keyboard Shortcuts (Collapsible) */}
          {showShortcuts && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Zoom In/Out</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">
                    Ctrl +/-
                  </code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Reset View</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">
                    Ctrl 0
                  </code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Range Select</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">
                    Shift
                  </code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pan Canvas</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">
                    Drag
                  </code>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
