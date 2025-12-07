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
  Star,
  Package,
  Brush,
  RotateCw,
  FlipHorizontal
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
}

// Emoji/Shape patterns (relative coordinates)
const PATTERNS = {
  heart: [
    [-2, -1], [-1, -2], [0, -2], [1, -2], [2, -1],
    [-3, 0], [-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0], [3, 0],
    [-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1],
    [-1, 2], [0, 1], [1, 2],
    [0, 3]
  ],
  smile: [
    [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
    [-3, -1], [-2, -1], [2, -1], [3, -1],
    [-3, 0], [-1, 0], [1, 0], [3, 0],
    [-3, 1], [-2, 1], [2, 1], [3, 1],
    [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]
  ],
  rocket: [
    [0, -3], 
    [-1, -2], [0, -2], [1, -2],
    [-1, -1], [0, -1], [1, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [-2, 2], [2, 2],
    [-3, 3], [3, 3]
  ],
  brain: [
    [-2, -2], [-1, -2], [0, -2], [1, -2],
    [-3, -1], [-2, -1], [0, -1], [1, -1], [2, -1],
    [-3, 0], [-1, 0], [0, 0], [2, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1],
    [-1, 2], [0, 2]
  ],
  sparkle: [
    [0, -2],
    [-1, -1], [0, -1], [1, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2]
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
  calculatePixelPrice 
}: QuickSelectToolsProps) => {
  const [selectedPattern, setSelectedPattern] = useState<any>(null);
  const [rotation, setRotation] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);

  const applyPattern = (pattern: number[][], centerX?: number, centerY?: number) => {
    // Default to center of grid if no position specified
    const cx = centerX ?? Math.floor(gridWidth / 2);
    const cy = centerY ?? Math.floor(gridHeight / 2);

    let transformedPattern = [...pattern];

    // Apply rotation
    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      transformedPattern = transformedPattern.map(([x, y]) => {
        const newX = Math.round(x * cos - y * sin);
        const newY = Math.round(x * sin + y * cos);
        return [newX, newY];
      });
    }

    // Apply flip
    if (isFlipped) {
      transformedPattern = transformedPattern.map(([x, y]) => [-x, y]);
    }

    const pixels: SelectedPixel[] = [];
    
    transformedPattern.forEach(([dx, dy]) => {
      const x = cx + dx;
      const y = cy + dy;
      
      // Check bounds
      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        pixels.push({
          x,
          y,
          price: calculatePixelPrice(x, y),
          id: `${x}-${y}`
        });
      }
    });

    onPixelsSelected(pixels);
    
    const totalCost = pixels.reduce((sum, p) => sum + p.price, 0);
    toast.success(`Selected ${pixels.length} pixels (₹${totalCost})`);
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
    const usedPositions = new Set();
    
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
    toast.success(`Random selected ${pixels.length} pixels (₹${totalCost})`);
  };

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Quick Select Tools
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="emoji" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="emoji">Emoji</TabsTrigger>
            <TabsTrigger value="sizes">Sizes</TabsTrigger>
            <TabsTrigger value="random">Random</TabsTrigger>
          </TabsList>

          <TabsContent value="emoji" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-3">
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
                      <Icon className={`w-5 h-5 ${pack.color}`} />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{pack.name}</div>
                        <div className="text-xs text-muted-foreground">{pack.description}</div>
                      </div>
                      <Badge variant="secondary">₹{estimatedCost}+</Badge>
                    </div>
                  </Button>
                );
              })}
            </div>

            {/* Transform Controls */}
            <div className="border-t pt-4 space-y-3">
              <div className="text-sm font-medium">Transform Pattern</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((rotation + 90) % 360)}
                  className="flex-1"
                >
                  <RotateCw className="w-4 h-4 mr-1" />
                  Rotate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="flex-1"
                >
                  <FlipHorizontal className="w-4 h-4 mr-1" />
                  Flip
                </Button>
              </div>
              {(rotation !== 0 || isFlipped) && (
                <div className="text-xs text-muted-foreground">
                  {rotation !== 0 && `Rotated ${rotation}°`}
                  {rotation !== 0 && isFlipped && ' • '}
                  {isFlipped && 'Flipped'}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sizes" className="space-y-3 mt-4">
            {SIZE_PACKS.map((pack) => {
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
                    <Icon className="w-5 h-5 text-primary" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{pack.name}</div>
                      <div className="text-xs text-muted-foreground">{pack.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{pack.size}</div>
                      <Badge variant="secondary" className="mt-1">₹{estimatedCost}+</Badge>
                    </div>
                  </div>
                </Button>
              );
            })}
          </TabsContent>

          <TabsContent value="random" className="space-y-3 mt-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between hover-scale"
                onClick={() => randomSelect(1)}
              >
                <span>Single Random Pixel</span>
                <Badge variant="secondary">₹99-299</Badge>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-between hover-scale"
                onClick={() => randomSelect(10)}
              >
                <span>10 Random Pixels</span>
                <Badge variant="secondary">₹990+</Badge>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-between hover-scale"
                onClick={() => randomSelect(50)}
              >
                <span>50 Random Pixels</span>
                <Badge variant="secondary">₹4,950+</Badge>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-between hover-scale"
                onClick={() => randomSelect(100)}
              >
                <span>100 Random Pixels</span>
                <Badge variant="secondary">₹9,900+</Badge>
              </Button>
            </div>

            <div className="border-t pt-3">
              <Button
                variant={isDrawMode ? "default" : "outline"}
                className="w-full"
                onClick={() => setIsDrawMode(!isDrawMode)}
              >
                <Brush className="w-4 h-4 mr-2" />
                {isDrawMode ? 'Exit Draw Mode' : 'Enter Draw Mode'}
              </Button>
              {isDrawMode && (
                <p className="text-xs text-muted-foreground mt-2">
                  Click and drag on the canvas to draw your selection
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};