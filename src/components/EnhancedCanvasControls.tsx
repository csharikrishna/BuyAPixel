import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MousePointer,
  Hand,
  Grid3X3,
  Eye,
  EyeOff,
  Minus,
  Plus,
  Settings2,
  ChevronUp
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


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
  selectedCount,
}: EnhancedCanvasControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => onZoomChange(Math.min(8, zoom * 1.2));
  const handleZoomOut = () => onZoomChange(Math.max(0.5, zoom / 1.2));

  if (!isExpanded) {
    return (
      <TooltipProvider delayDuration={300}>
        <Card className="flex flex-col p-1.5 shadow-xl border-border/50 backdrop-blur-sm bg-background/95 w-[46px] items-center z-30 h-fit">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(true)}
                className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Canvas Controls</TooltipContent>
          </Tooltip>
        </Card>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Card className="flex flex-col p-1.5 gap-1.5 shadow-xl border-border/50 backdrop-blur-sm bg-background/95 w-[46px] items-center z-30 h-fit">
        
        {/* Close Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
              className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Hide Controls</TooltipContent>
        </Tooltip>

        <Separator className="w-6 opacity-50" />

        {/* Selection Mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isSelecting ? "default" : "ghost"}
              size="icon"
              onClick={onToggleSelecting}
              className={`h-8 w-8 transition-all ${isSelecting ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}
            >
              {isSelecting ? <MousePointer className="h-4 w-4" /> : <Hand className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <p className="font-medium">{isSelecting ? "Selection Mode" : "Pan Mode"}</p>
            {selectedCount > 0 && <Badge variant="secondary" className="px-1 py-0 h-5 md:hidden">{selectedCount}</Badge>}
          </TooltipContent>
        </Tooltip>

        <Separator className="w-6 opacity-50" />

        {/* Zoom Controls */}
        <div className="flex flex-col items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 8}
                className="h-8 w-8 hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom In</TooltipContent>
          </Tooltip>

          <span className="text-[10px] font-mono font-medium text-muted-foreground select-none">
            {zoomPercentage}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="h-8 w-8 hover:bg-muted"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom Out</TooltipContent>
          </Tooltip>
        </div>

        <Separator className="w-6 opacity-50" />

        {/* Quick Toggles */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showGrid ? "secondary" : "ghost"}
              size="icon"
              onClick={onToggleGrid}
              className="h-8 w-8 hover:bg-muted"
            >
              <Grid3X3 className={`h-4 w-4 ${showGrid ? "text-primary" : "text-muted-foreground"}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {showGrid ? "Hide Grid" : "Show Grid"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showMyPixels ? "secondary" : "ghost"}
              size="icon"
              onClick={onToggleMyPixels}
              className="h-8 w-8 hover:bg-muted"
            >
              {showMyPixels ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {showMyPixels ? "Hide My Pixels" : "Show My Pixels"}
          </TooltipContent>
        </Tooltip>

        <Separator className="w-6 opacity-50" />

        {/* More / Reset */}
        {/* Reset View Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onResetView}
              className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Reset View</TooltipContent>
        </Tooltip>

      </Card>
    </TooltipProvider>
  );
};
