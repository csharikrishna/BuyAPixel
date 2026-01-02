import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  Smile,
  Rocket,
  Brain,
  Sparkles,
  Square,
  CircleDot,
  Zap,
  Package,
  Brush,
  RotateCw,
  FlipHorizontal,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";

interface SelectedPixel {
  x: number;
  y: number;
  price: number;
  id: string;
}

interface QuickSelectToolsProps {
  onPixelsSelected: (pixels: SelectedPixel[]) => void;
  gridWidth: number;
  gridHeight: number;
  calculatePixelPrice: (x: number, y: number) => number;
  anchorPixel?: { x: number; y: number } | null;
}

// Emoji/Shape patterns (relative coordinates)
const PATTERNS = {
  // Classic pixel art heart (symmetrical)
  heart: [
    // Top curves
    [-2, -2], [-1, -2], [1, -2], [2, -2],
    [-3, -1], [-2, -1], [-1, -1], [1, -1], [2, -1], [3, -1],
    // Middle section
    [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
    // Lower middle
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
    // Bottom point
    [-1, 2], [0, 2], [1, 2],
    [0, 3]
  ],
  
  // Classic smiley face (circular with eyes and smile)
  smile: [
    // Top arc
    [-1, -3], [0, -3], [1, -3],
    [-2, -2], [2, -2],
    // Eyes row
    [-3, -1], [-1, -1], [1, -1], [3, -1],
    // Middle
    [-3, 0], [3, 0],
    // Smile curve
    [-3, 1], [-1, 1], [0, 1], [1, 1], [3, 1],
    [-2, 2], [2, 2],
    // Bottom arc
    [-1, 3], [0, 3], [1, 3]
  ],
  
  // Rocket ship
  rocket: [
    // Nose cone
    [0, -4],
    [-1, -3], [0, -3], [1, -3],
    // Window/cockpit
    [-1, -2], [0, -2], [1, -2],
    // Body
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
    // Fins
    [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
    // Thrusters
    [-2, 3], [0, 3], [2, 3],
    [-1, 4], [1, 4]
  ],
  
  // Brain (symmetrical lobes)
  brain: [
    // Top lobes
    [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
    [-3, -1], [-2, -1], [-1, -1], [1, -1], [2, -1], [3, -1],
    // Middle section with folds
    [-3, 0], [-2, 0], [0, 0], [2, 0], [3, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
    // Bottom
    [-1, 2], [0, 2], [1, 2]
  ],
  
  // Sparkle/star
  sparkle: [
    // Top point
    [0, -3],
    [0, -2],
    // Horizontal beam
    [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
    // Vertical beam
    [0, -1], [0, 1], [0, 2], [0, 3],
    // Diagonal accents
    [-1, -1], [1, -1],
    [-1, 1], [1, 1]
  ],
  
  square3x3: Array.from({ length: 9 }, (_, i) => [i % 3 - 1, Math.floor(i / 3) - 1]),
  square5x5: Array.from({ length: 25 }, (_, i) => [i % 5 - 2, Math.floor(i / 5) - 2]),
  square10x10: Array.from({ length: 100 }, (_, i) => [i % 10 - 4.5, Math.floor(i / 10) - 4.5])
};

const PRESET_PACKS = [
  {
    id: 'heart',
    name: 'Heart',
    icon: Heart,
    pattern: PATTERNS.heart,
    color: 'text-red-500',
    description: 'Perfect for love messages'
  },
  {
    id: 'smile',
    name: 'Smile',
    icon: Smile,
    pattern: PATTERNS.smile,
    color: 'text-yellow-500',
    description: 'Spread positivity'
  },
  {
    id: 'rocket',
    name: 'Rocket',
    icon: Rocket,
    pattern: PATTERNS.rocket,
    color: 'text-blue-500',
    description: 'Launch your brand'
  },
  {
    id: 'brain',
    name: 'Brain',
    icon: Brain,
    pattern: PATTERNS.brain,
    color: 'text-purple-500',
    description: 'Smart advertising'
  },
  {
    id: 'sparkle',
    name: 'Sparkle',
    icon: Sparkles,
    pattern: PATTERNS.sparkle,
    color: 'text-amber-500',
    description: 'Catch attention'
  }
];

const SIZE_PACKS = [
  {
    id: 'small',
    name: 'Small Logo',
    size: '3×3',
    pattern: PATTERNS.square3x3,
    icon: CircleDot,
    description: '9 pixels - Perfect for small logos'
  },
  {
    id: 'medium',
    name: 'Medium Ad',
    size: '5×5',
    pattern: PATTERNS.square5x5,
    icon: Square,
    description: '25 pixels - Great for ads'
  },
  {
    id: 'large',
    name: 'Large Banner',
    size: '10×10',
    pattern: PATTERNS.square10x10,
    icon: Package,
    description: '100 pixels - Maximum impact'
  }
];

export const QuickSelectTools = ({
  onPixelsSelected,
  gridWidth,
  gridHeight,
  calculatePixelPrice,
  anchorPixel
}: QuickSelectToolsProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const transformPattern = (pattern: number[][]) => {
    let transformed = [...pattern];

    // Apply rotation
    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      transformed = transformed.map(([x, y]) => [
        Math.round(x * cos - y * sin),
        Math.round(x * sin + y * cos)
      ]);
    }

    // Apply flip
    if (isFlipped) {
      transformed = transformed.map(([x, y]) => [-x, y]);
    }

    return transformed;
  };

  const applyPattern = (pattern: number[][]) => {
    if (!anchorPixel) {
      toast.info("Please select a target pixel first", {
        description: "Click anywhere on the grid to set the center for your shape."
      });
      return;
    }

    const cx = anchorPixel.x;
    const cy = anchorPixel.y;

    const transformedPattern = transformPattern(pattern);
    const pixels: SelectedPixel[] = [];

    transformedPattern.forEach(([dx, dy]) => {
      const x = cx + dx;
      const y = cy + dy;

      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        pixels.push({
          x,
          y,
          price: calculatePixelPrice(x, y),
          id: `${x}-${y}`
        });
      }
    });

    if (pixels.length > 0) {
      onPixelsSelected(pixels);
      const totalCost = pixels.reduce((sum, p) => sum + p.price, 0);
      toast.success(`Selected ${pixels.length} pixels (₹${totalCost})`);
    } else {
      toast.error("Pattern doesn't fit within grid bounds");
    }
  };

  const calculatePatternCost = (pattern: number[][]) => {
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);

    return pattern.reduce((sum, [dx, dy]) => {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        return sum + calculatePixelPrice(x, y);
      }
      return sum;
    }, 0);
  };

  const randomSelect = (count: number) => {
    const pixels: SelectedPixel[] = [];
    const usedPositions = new Set<string>();

    while (pixels.length < count && usedPositions.size < gridWidth * gridHeight) {
      const x = Math.floor(Math.random() * gridWidth);
      const y = Math.floor(Math.random() * gridHeight);
      const key = `${x}-${y}`;

      if (!usedPositions.has(key)) {
        usedPositions.add(key);
        pixels.push({
          x,
          y,
          price: calculatePixelPrice(x, y),
          id: key
        });
      }
    }

    onPixelsSelected(pixels);
    const totalCost = pixels.reduce((sum, p) => sum + p.price, 0);
    toast.success(`Randomly selected ${pixels.length} pixels (₹${totalCost})`);
  };

  const resetTransforms = () => {
    setRotation(0);
    setIsFlipped(false);
  };

  return (
    <Card className="card-premium">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quick Select Tools
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
            className="h-8"
          >
            {isVisible ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isVisible && (
        <CardContent>
          <Tabs defaultValue="emoji" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="emoji">Emoji</TabsTrigger>
              <TabsTrigger value="sizes">Sizes</TabsTrigger>
              <TabsTrigger value="random">Random</TabsTrigger>
            </TabsList>

            <TabsContent value="emoji" className="space-y-4 mt-4">
              <div className="grid gap-2">
                {PRESET_PACKS.map((pack) => {
                  const Icon = pack.icon;
                  const estimatedCost = calculatePatternCost(pack.pattern);

                  return (
                    <Button
                      key={pack.id}
                      variant="outline"
                      className="h-auto p-3 justify-start hover-scale"
                      onClick={() => applyPattern(pack.pattern)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Icon className={`w-5 h-5 flex-shrink-0 ${pack.color}`} />
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium">{pack.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {pack.description}
                          </div>
                        </div>
                        <Badge variant="secondary" className="flex-shrink-0">
                          ₹{estimatedCost}
                        </Badge>
                      </div>
                    </Button>
                  );
                })}
              </div>

              {/* Transform Controls */}
              <div className="border-t pt-4 space-y-3">
                <div className="text-sm font-medium">Transform Pattern</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRotation((rotation + 90) % 360)}
                  >
                    <RotateCw className="w-4 h-4 mr-1" />
                    Rotate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <FlipHorizontal className="w-4 h-4 mr-1" />
                    Flip
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetTransforms}
                    disabled={rotation === 0 && !isFlipped}
                  >
                    Reset
                  </Button>
                </div>
                {(rotation !== 0 || isFlipped) && (
                  <div className="text-xs text-muted-foreground">
                    {rotation !== 0 && `Rotated ${rotation}°`}
                    {rotation !== 0 && isFlipped && ' • '}
                    {isFlipped && 'Flipped horizontally'}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sizes" className="space-y-2 mt-4">
              {SIZE_PACKS.map((pack) => {
                const Icon = pack.icon;
                const estimatedCost = calculatePatternCost(pack.pattern);

                return (
                  <Button
                    key={pack.id}
                    variant="outline"
                    className="h-auto p-3 justify-start hover-scale w-full"
                    onClick={() => applyPattern(pack.pattern)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Icon className="w-5 h-5 flex-shrink-0 text-primary" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium">{pack.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {pack.description}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-medium">{pack.size}</div>
                        <Badge variant="secondary" className="mt-1">
                          ₹{estimatedCost}
                        </Badge>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </TabsContent>

            <TabsContent value="random" className="space-y-3 mt-4">
              <div className="grid gap-2">
                {[
                  { count: 1, label: 'Single Random Pixel', cost: '₹99-299' },
                  { count: 10, label: '10 Random Pixels', cost: '₹990+' },
                  { count: 50, label: '50 Random Pixels', cost: '₹4,950+' },
                  { count: 100, label: '100 Random Pixels', cost: '₹9,900+' }
                ].map(({ count, label, cost }) => (
                  <Button
                    key={count}
                    variant="outline"
                    className="w-full justify-between hover-scale"
                    onClick={() => randomSelect(count)}
                  >
                    <span>{label}</span>
                    <Badge variant="secondary">{cost}</Badge>
                  </Button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
};
