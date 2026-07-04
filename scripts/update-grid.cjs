const fs = require('fs');

let code = fs.readFileSync('src/components/VirtualizedPixelGrid.tsx', 'utf8');

// 1. Update imports
code = code.replace(
  /import \{ getGridImageUrl, getBillboardImageUrl \} from "@\/utils\/imageOptimization";/,
  'import { getBillboardImageUrl } from "@/utils/imageOptimization";\nimport { renderCanvasGrid } from "@/utils/canvasRenderer";'
);

// 2. Remove old DOM blocks
code = code.replace(/const PixelBlockImage = memo.*?\}\);\n\ninterface IndividualPixelProps.*?\}\);\n\n\/\/ ============================================================/s, '// ============================================================');

// 3. Add canvas state
code = code.replace(
  /\/\/ ── Local State ───────────────────────────────────────────/,
  `const canvasRef = useRef<HTMLCanvasElement>(null);\n    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());\n\n    // ── Local State ───────────────────────────────────────────`
);

// 4. Add the Canvas Render Loop effect
const renderEffect = `
    useEffect(() => {
      if (!canvasRef.current || !containerSize.width || !containerSize.height) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      let animationFrameId: number;
      
      const render = () => {
         renderCanvasGrid({
            ctx,
            width: containerSize.width,
            height: containerSize.height,
            gridWidth,
            gridHeight,
            pixelSize,
            zoom,
            viewportOffset,
            blockData,
            individualPixels,
            selectedPixels: visibleSelectedPixels,
            isPending,
            showGrid,
            showMyPixels,
            currentUserId: user?.id,
            highlightUser,
            imageCache: imageCache.current,
            onImageLoad: () => {
              requestAnimationFrame(render);
            }
         });
      };
      
      animationFrameId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(animationFrameId);
    }, [
      gridWidth, gridHeight, pixelSize, zoom, viewportOffset, 
      blockData, individualPixels, visibleSelectedPixels, 
      isPending, showGrid, showMyPixels, user?.id, highlightUser, containerSize
    ]);

    // ── Handle URL Pixel Focus ─────────────────────────────────`;

code = code.replace(/\/\/ ── Handle URL Pixel Focus ─────────────────────────────────/, renderEffect);

// 5. Replace the DOM rendering elements with the canvas element inside the zoom wrapper
// Note: We need to preserve the Billboard! The billboard sits at z-index 30.
// Let's replace from "{/* Grid Background */}" up to "{/* Selection Count Badge */}" but preserving Billboard?
// Actually, it's easier to regex out just the specific DOM lists.
code = code.replace(/\{\/\* Grid Background \*\/.*?\{\/\* Billboard \*\//s, '<canvas ref={canvasRef} width={containerSize.width || 800} height={containerSize.height || 600} style={{ position: \'absolute\', top: 0, left: 0, width: \'100%\', height: \'100%\', pointerEvents: \'none\' }} />\n\n            {/* Billboard */');

// Remove Selected Pixels
code = code.replace(/\{\/\* Selected Pixels \*\/.*?\{\/\* Block Images \*\//s, '{/* Block Images */');

// Remove Block Images, Individual Pixels, and Hover Indicator
code = code.replace(/\{\/\* Block Images \*\/.*?\{\/\* Selection Count Badge \*\//s, '{/* Selection Count Badge */');


fs.writeFileSync('src/components/VirtualizedPixelGrid.tsx', code);
console.log('Successfully updated VirtualizedPixelGrid.tsx!');
