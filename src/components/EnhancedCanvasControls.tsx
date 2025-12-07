import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Settings,
  Grid3X3,
  Eye,
  EyeOff
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
  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => {
    onZoomChange(Math.min(8, zoom * 1.2));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(0.5, zoom / 1.2));
  };

  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <Card className="card-premium">
        <CardContent className="p-4">
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
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {/* Zoom shortcuts info */}
            <div className="text-xs text-muted-foreground text-center">
              Scroll to zoom • Ctrl+0 to reset
            </div>
          </div>

          <Separator className="my-4" />

          {/* View Options */}
          <div className="space-y-3">
            <span className="text-sm font-medium">View Options</span>
            
            <div className="space-y-2">
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

          {/* Reset View */}
          <Button
            variant="outline"
            size="sm"
            onClick={onResetView}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset View
          </Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="card-premium">
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-3">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onZoomChange(0.5)}
              className="text-xs"
            >
              <Search className="w-3 h-3 mr-1" />
              Overview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onZoomChange(4)}
              className="text-xs"
            >
              <Maximize2 className="w-3 h-3 mr-1" />
              Detail
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card className="card-premium">
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-3">Shortcuts</div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Zoom In/Out</span>
              <code className="bg-muted px-1 rounded">Ctrl +/-</code>
            </div>
            <div className="flex justify-between">
              <span>Reset View</span>
              <code className="bg-muted px-1 rounded">Ctrl 0</code>
            </div>
            <div className="flex justify-between">
              <span>Range Select</span>
              <code className="bg-muted px-1 rounded">Shift</code>
            </div>
            <div className="flex justify-between">
              <span>Pan Canvas</span>
              <code className="bg-muted px-1 rounded">Drag</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};