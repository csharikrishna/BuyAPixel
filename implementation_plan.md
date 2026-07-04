# HTML5 Canvas Rendering Migration Plan

## Goal Description
To future-proof the platform for thousands of concurrent pixels, we will replace the React DOM-based virtualized grid in `VirtualizedPixelGrid.tsx` with a raw HTML5 `<canvas>` element. This bypasses the browser's DOM rendering engine entirely, allowing the Graphics Card (GPU) to paint the pixels directly. This will eliminate all Lighthouse main-thread warnings and ensure smooth 60 FPS panning/zooming even when the grid reaches 10,000 blocks.

## Proposed Changes

### 1. `VirtualizedPixelGrid.tsx` Rewrite
We will completely gut the DOM-based grid renderer and replace it with a `<canvas>`.
- **Render Loop:** Implement a `requestAnimationFrame` loop that clears the canvas and redraws the visible grid blocks every frame.
- **Image Caching:** Create an in-memory image cache (`Map<string, HTMLImageElement>`). Images will load asynchronously and paint onto the canvas the moment they resolve.
- **Hit-Testing (Raycasting):** Since there are no longer physical `<img>` elements to click on, we will implement math to reverse-engineer mouse coordinates back into `(x, y)` grid coordinates.
- **Tooltip Integration:** The hover tooltip will remain as a floating HTML element, but its position and content will be driven by the canvas hit-testing logic.

### 2. Interaction Engine Updates
The existing math in `useGridInteraction.ts` is perfectly compatible with Canvas! We will simply bind the existing mouse and touch listeners directly to the `<canvas>` element instead of a giant `<div>`.

## User Review Required

> [!WARNING]
> This is a major rewrite of the core rendering engine. The visual appearance should remain exactly the same, but the underlying technology will fundamentally shift. 

## Open Questions

- We will lose the CSS keyframe animations (like the "Premium Gold Shimmer") on the blocks since they will now be painted flat onto the canvas. We can recreate a subtle pulse effect using Canvas math if needed, but are you okay with temporarily losing the CSS glows for the higher-tier blocks?

## Verification Plan

### Manual Verification
1. Run `npm run dev` and ensure the grid still renders all purchased pixels.
2. Verify that zooming and panning remain perfectly smooth.
3. Click on a block and verify the modal still opens correctly.
4. Hover over a block and verify the tooltip appears in the correct position.
