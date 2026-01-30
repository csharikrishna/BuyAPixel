import { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
   Check,
   X,
   RotateCw,
   RotateCcw,
   ZoomIn,
   ZoomOut,
   Crop,
   RefreshCw,
   Move,
   AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Point {
   x: number;
   y: number;
}

interface Area {
   width: number;
   height: number;
   x: number;
   y: number;
}

interface ImageCropperProps {
   image: string;
   aspect?: number;
   onCropComplete: (croppedImageBlob: Blob) => void;
   onCancel: () => void;
   open: boolean;
   maxWidth?: number;
   maxHeight?: number;
   quality?: number;
   outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}

// Constants
const DEFAULT_MAX_WIDTH = 2048;
const DEFAULT_MAX_HEIGHT = 2048;
const DEFAULT_QUALITY = 0.95;
const ZOOM_STEP = 0.2;
const ROTATION_STEP = 15;
const KEYBOARD_ZOOM_STEP = 0.1;
const KEYBOARD_ROTATION_STEP = 5;

/**
 * Create image element from URL with proper error handling
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
   new Promise((resolve, reject) => {
      const image = new Image();
      const timeoutId = setTimeout(() => {
         reject(new Error('Image loading timeout'));
      }, 30000); // 30 second timeout

      image.addEventListener('load', () => {
         clearTimeout(timeoutId);
         resolve(image);
      });

      image.addEventListener('error', (error) => {
         clearTimeout(timeoutId);
         reject(new Error('Failed to load image'));
      });

      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
   });

/**
 * Get cropped image using canvas with optimization
 */
const getCroppedImg = async (
   imageSrc: string,
   pixelCrop: Area,
   rotation = 0,
   maxWidth = DEFAULT_MAX_WIDTH,
   maxHeight = DEFAULT_MAX_HEIGHT,
   quality = DEFAULT_QUALITY,
   format: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<Blob> => {
   const image = await createImage(imageSrc);

   // Try to use OffscreenCanvas for better performance (2026 - excellent support)
   const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

   let canvas: HTMLCanvasElement | OffscreenCanvas;
   let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

   if (supportsOffscreenCanvas) {
      canvas = new OffscreenCanvas(1, 1);
      ctx = canvas.getContext('2d', {
         alpha: format === 'image/png',
         willReadFrequently: false,
      });
   } else {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', {
         alpha: format === 'image/png',
         willReadFrequently: false,
      });
   }

   if (!ctx) {
      throw new Error('Failed to get canvas context');
   }

   // Calculate safe area for rotation
   const maxSize = Math.max(image.width, image.height);
   const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

   // Set canvas size to safe area
   canvas.width = safeArea;
   canvas.height = safeArea;

   // Translate and rotate canvas
   ctx.translate(safeArea / 2, safeArea / 2);
   ctx.rotate((rotation * Math.PI) / 180);
   ctx.translate(-safeArea / 2, -safeArea / 2);

   // Draw rotated image
   ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
   );

   // Get image data for cropping
   const data = ctx.getImageData(0, 0, safeArea, safeArea);

   // Calculate final dimensions respecting max constraints
   let finalWidth = pixelCrop.width;
   let finalHeight = pixelCrop.height;

   if (finalWidth > maxWidth || finalHeight > maxHeight) {
      const ratio = Math.min(maxWidth / finalWidth, maxHeight / finalHeight);
      finalWidth = Math.floor(finalWidth * ratio);
      finalHeight = Math.floor(finalHeight * ratio);
   }

   // Set final canvas size (use whole numbers for performance)
   canvas.width = finalWidth;
   canvas.height = finalHeight;

   // If dimensions changed, scale the context
   if (finalWidth !== pixelCrop.width || finalHeight !== pixelCrop.height) {
      ctx.scale(finalWidth / pixelCrop.width, finalHeight / pixelCrop.height);
   }

   // Put cropped image data
   ctx.putImageData(
      data,
      Math.floor(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.floor(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
   );

   // Convert to blob
   return new Promise((resolve, reject) => {
      if (canvas instanceof OffscreenCanvas) {
         canvas
            .convertToBlob({ type: format, quality })
            .then(resolve)
            .catch(() => reject(new Error('Failed to convert canvas to blob')));
      } else {
         canvas.toBlob(
            (blob) => {
               if (!blob) {
                  reject(new Error('Canvas is empty'));
                  return;
               }
               resolve(blob);
            },
            format,
            quality
         );
      }
   });
};

export const ImageCropper = ({
   image,
   aspect = 1,
   onCropComplete,
   onCancel,
   open,
   maxWidth = DEFAULT_MAX_WIDTH,
   maxHeight = DEFAULT_MAX_HEIGHT,
   quality = DEFAULT_QUALITY,
   outputFormat = 'image/jpeg',
}: ImageCropperProps) => {
   // Refs
   const isMountedRef = useRef(true);
   const initialStateRef = useRef({ zoom: 1, rotation: 0, crop: { x: 0, y: 0 } });

   // React 19 hooks
   const [isPending, startTransition] = useTransition();

   // State
   const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
   const [zoom, setZoom] = useState(1);
   const [rotation, setRotation] = useState(0);
   const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
   const [isProcessing, setIsProcessing] = useState(false);
   const [imageError, setImageError] = useState<string | null>(null);
   const [hasChanges, setHasChanges] = useState(false);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         isMountedRef.current = false;
      };
   }, []);

   // Track if user has made changes
   useEffect(() => {
      const changed =
         zoom !== initialStateRef.current.zoom ||
         rotation !== initialStateRef.current.rotation ||
         crop.x !== initialStateRef.current.crop.x ||
         crop.y !== initialStateRef.current.crop.y;

      setHasChanges(changed);
   }, [zoom, rotation, crop]);

   // Reset state when dialog opens
   useEffect(() => {
      if (open) {
         setImageError(null);
         setHasChanges(false);
      }
   }, [open]);

   // Handlers
   const onCropChange = useCallback((newCrop: Point) => {
      setCrop(newCrop);
   }, []);

   const onZoomChange = useCallback((newZoom: number) => {
      setZoom(newZoom);
   }, []);

   const onCropCompleteHandler = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
   }, []);

   const handleSave = useCallback(async () => {
      if (!croppedAreaPixels) {
         toast.error('No crop area selected');
         return;
      }

      setIsProcessing(true);
      setImageError(null);

      try {
         const croppedImage = await getCroppedImg(
            image,
            croppedAreaPixels,
            rotation,
            maxWidth,
            maxHeight,
            quality,
            outputFormat
         );

         if (!isMountedRef.current) return;

         // Show size info
         const sizeKB = (croppedImage.size / 1024).toFixed(2);
         toast.success('Image cropped successfully', {
            description: `Size: ${sizeKB} KB`,
         });

         onCropComplete(croppedImage);
      } catch (error) {
         if (!isMountedRef.current) return;

         console.error('Crop error:', error);
         const errorMessage = error instanceof Error ? error.message : 'Failed to crop image';

         setImageError(errorMessage);
         toast.error('Failed to crop image', {
            description: errorMessage,
         });
      } finally {
         if (isMountedRef.current) {
            setIsProcessing(false);
         }
      }
   }, [
      image,
      croppedAreaPixels,
      rotation,
      maxWidth,
      maxHeight,
      quality,
      outputFormat,
      onCropComplete,
   ]);

   const handleReset = useCallback(() => {
      startTransition(() => {
         setCrop({ x: 0, y: 0 });
         setZoom(1);
         setRotation(0);
      });

      toast.info('Reset to default');
   }, []);

   const rotateLeft = useCallback(() => {
      setRotation((prev) => (prev - 90 + 360) % 360);
   }, []);

   const rotateRight = useCallback(() => {
      setRotation((prev) => (prev + 90) % 360);
   }, []);

   const zoomIn = useCallback(() => {
      setZoom((prev) => Math.min(prev + ZOOM_STEP, 3));
   }, []);

   const zoomOut = useCallback(() => {
      setZoom((prev) => Math.max(prev - ZOOM_STEP, 1));
   }, []);

   // Keyboard shortcuts
   const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
         if (!open) return;

         // Don't trigger if user is typing
         const target = e.target as HTMLElement;
         if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target.isContentEditable
         ) {
            return;
         }

         switch (e.key) {
            case 'Enter':
               e.preventDefault();
               if (!isProcessing) {
                  handleSave();
               }
               break;

            case 'Escape':
               e.preventDefault();
               if (!isProcessing) {
                  onCancel();
               }
               break;

            case '+':
            case '=':
               e.preventDefault();
               zoomIn();
               break;

            case '-':
            case '_':
               e.preventDefault();
               zoomOut();
               break;

            case 'r':
            case 'R':
               if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  handleReset();
               } else if (e.shiftKey) {
                  e.preventDefault();
                  rotateLeft();
               } else {
                  e.preventDefault();
                  rotateRight();
               }
               break;

            case 'ArrowUp':
               if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  setZoom((prev) => Math.min(prev + KEYBOARD_ZOOM_STEP, 3));
               }
               break;

            case 'ArrowDown':
               if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  setZoom((prev) => Math.max(prev - KEYBOARD_ZOOM_STEP, 1));
               }
               break;

            case 'ArrowLeft':
               if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  setRotation((prev) => (prev - KEYBOARD_ROTATION_STEP + 360) % 360);
               }
               break;

            case 'ArrowRight':
               if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  setRotation((prev) => (prev + KEYBOARD_ROTATION_STEP) % 360);
               }
               break;

            default:
               break;
         }
      },
      [open, isProcessing, handleSave, onCancel, zoomIn, zoomOut, handleReset, rotateLeft, rotateRight]
   );

   useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [handleKeyDown]);

   // Warn user if leaving with unsaved changes
   const handleDialogClose = useCallback(
      (shouldClose: boolean) => {
         if (!shouldClose) return;

         if (hasChanges && !isProcessing) {
            const confirmClose = window.confirm(
               'You have unsaved changes. Are you sure you want to close?'
            );
            if (confirmClose) {
               onCancel();
            }
         } else {
            onCancel();
         }
      },
      [hasChanges, isProcessing, onCancel]
   );

   return (
      <Dialog open={open} onOpenChange={handleDialogClose}>
         <DialogContent
            className="sm:max-w-[600px] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
            onPointerDownOutside={(e) => {
               if (isProcessing) {
                  e.preventDefault();
               }
            }}
            onEscapeKeyDown={(e) => {
               if (isProcessing) {
                  e.preventDefault();
               }
            }}
         >
            {/* Screen reader accessible title and description */}
            <DialogTitle className="sr-only">Crop & Adjust Image</DialogTitle>
            <DialogDescription className="sr-only">
               Use the controls below to crop, zoom, and rotate your image. Press Enter to apply
               or Escape to cancel.
            </DialogDescription>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-card">
               <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                     <Crop className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                     <h2 className="text-base font-semibold text-foreground">Crop & Adjust</h2>
                     <p className="text-xs text-muted-foreground">
                        Drag to reposition • Scroll to zoom • Press Enter to apply
                     </p>
                  </div>
               </div>
               <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  disabled={isProcessing}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Close dialog"
               >
                  <X className="w-4 h-4" />
               </Button>
            </div>

            {/* Error Alert */}
            {imageError && (
               <div
                  className="mx-5 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2"
                  role="alert"
               >
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-destructive">
                     <p className="font-medium">Error</p>
                     <p className="text-xs mt-1">{imageError}</p>
                  </div>
               </div>
            )}

            {/* Crop Area */}
            <div className="relative flex-1 min-h-[280px] sm:min-h-[320px] bg-muted/30">
               <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={onCropChange}
                  onCropComplete={onCropCompleteHandler}
                  onZoomChange={onZoomChange}
                  objectFit="contain"
                  showGrid={true}
                  restrictPosition={true}
                  style={{
                     containerStyle: {
                        background: 'hsl(var(--muted) / 0.3)',
                     },
                     cropAreaStyle: {
                        border: '2px solid hsl(var(--primary))',
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                     },
                  }}
               />

               {/* Move hint overlay */}
               <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-background/90 backdrop-blur-sm rounded-full text-xs text-muted-foreground border shadow-sm pointer-events-none">
                  <Move className="w-3 h-3" />
                  <span>Drag to move • Scroll to zoom</span>
               </div>

               {/* Processing overlay */}
               {isProcessing && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
                     <div className="bg-card border shadow-lg rounded-lg p-4 flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                        <p className="text-sm font-medium">Processing image...</p>
                     </div>
                  </div>
               )}

               {/* Pending state indicator */}
               {isPending && !isProcessing && (
                  <div className="absolute top-3 right-3 bg-primary/90 text-primary-foreground px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                     <RefreshCw className="w-3 h-3 animate-spin" />
                     Updating...
                  </div>
               )}
            </div>

            {/* Controls */}
            <div className="px-5 py-4 space-y-4 bg-card border-t">
               {/* Quick Actions */}
               <div className="flex items-center justify-center gap-2" role="toolbar" aria-label="Quick actions">
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={rotateLeft}
                     disabled={isProcessing}
                     className="h-8 text-xs"
                     aria-label="Rotate left 90 degrees"
                  >
                     <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                     -90°
                  </Button>
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={handleReset}
                     disabled={isProcessing || !hasChanges}
                     className="h-8 text-xs"
                     aria-label="Reset all changes"
                  >
                     <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                     Reset
                  </Button>
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={rotateRight}
                     disabled={isProcessing}
                     className="h-8 text-xs"
                     aria-label="Rotate right 90 degrees"
                  >
                     <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                     +90°
                  </Button>
               </div>

               {/* Zoom Slider */}
               <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                     <span className="flex items-center gap-1.5 font-medium">
                        <ZoomIn className="w-3.5 h-3.5" />
                        Zoom
                     </span>
                     <span className="font-mono text-foreground" aria-live="polite">
                        {Math.round(zoom * 100)}%
                     </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                        variant="ghost"
                        size="icon"
                        onClick={zoomOut}
                        disabled={zoom <= 1 || isProcessing}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Zoom out"
                     >
                        <ZoomOut className="w-3.5 h-3.5" />
                     </Button>
                     <Slider
                        value={[zoom]}
                        min={1}
                        max={3}
                        step={0.01}
                        onValueChange={(value) => setZoom(value[0])}
                        disabled={isProcessing}
                        className="flex-1"
                        aria-label="Zoom level"
                     />
                     <Button
                        variant="ghost"
                        size="icon"
                        onClick={zoomIn}
                        disabled={zoom >= 3 || isProcessing}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Zoom in"
                     >
                        <ZoomIn className="w-3.5 h-3.5" />
                     </Button>
                  </div>
               </div>

               {/* Rotation Slider */}
               <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                     <span className="flex items-center gap-1.5 font-medium">
                        <RotateCw className="w-3.5 h-3.5" />
                        Rotation
                     </span>
                     <span className="font-mono text-foreground" aria-live="polite">
                        {rotation}°
                     </span>
                  </div>
                  <Slider
                     value={[rotation]}
                     min={0}
                     max={360}
                     step={1}
                     onValueChange={(value) => setRotation(value[0])}
                     disabled={isProcessing}
                     aria-label="Rotation angle"
                  />
               </div>

               {/* Keyboard Shortcuts Hint */}
               <div className="hidden sm:block text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                  <p className="font-medium mb-1">⌨️ Keyboard Shortcuts:</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                     <span>Enter - Apply</span>
                     <span>ESC - Cancel</span>
                     <span>+/- - Zoom</span>
                     <span>R - Rotate</span>
                  </div>
               </div>

               {/* Action Buttons */}
               <div className="flex gap-3 pt-1">
                  <Button
                     variant="outline"
                     onClick={onCancel}
                     disabled={isProcessing}
                     className="flex-1 h-10"
                     aria-label="Cancel and close"
                  >
                     <X className="w-4 h-4 mr-2" />
                     Cancel
                  </Button>
                  <Button
                     onClick={handleSave}
                     disabled={isProcessing || !croppedAreaPixels}
                     className="flex-1 h-10 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                     aria-label="Apply crop and close"
                  >
                     {isProcessing ? (
                        <>
                           <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                           Processing...
                        </>
                     ) : (
                        <>
                           <Check className="w-4 h-4 mr-2" />
                           Apply Crop
                        </>
                     )}
                  </Button>
               </div>
            </div>
         </DialogContent>
      </Dialog>
   );
};
