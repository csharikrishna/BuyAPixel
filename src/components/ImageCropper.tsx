import { useState, useCallback } from 'react';
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
   Move
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export const ImageCropper = ({ image, aspect = 1, onCropComplete, onCancel, open }: ImageCropperProps) => {
   const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
   const [zoom, setZoom] = useState(1);
   const [rotation, setRotation] = useState(0);
   const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
   const [isProcessing, setIsProcessing] = useState(false);

   const onCropChange = (crop: Point) => {
      setCrop(crop);
   };

   const onZoomChange = (zoom: number) => {
      setZoom(zoom);
   };

   const onCropCompleteHandler = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
   }, []);

   const createImage = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
         const image = new Image();
         image.addEventListener('load', () => resolve(image));
         image.addEventListener('error', (error) => reject(error));
         image.setAttribute('crossOrigin', 'anonymous');
         image.src = url;
      });

   const getCroppedImg = async (
      imageSrc: string,
      pixelCrop: Area,
      rotation = 0
   ): Promise<Blob> => {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
         throw new Error('No 2d context');
      }

      const maxSize = Math.max(image.width, image.height);
      const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

      canvas.width = safeArea;
      canvas.height = safeArea;

      ctx.translate(safeArea / 2, safeArea / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-safeArea / 2, -safeArea / 2);

      ctx.drawImage(
         image,
         safeArea / 2 - image.width * 0.5,
         safeArea / 2 - image.height * 0.5
      );

      const data = ctx.getImageData(0, 0, safeArea, safeArea);

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.putImageData(
         data,
         0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
         0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
      );

      return new Promise((resolve, reject) => {
         canvas.toBlob((blob) => {
            if (!blob) {
               reject(new Error('Canvas is empty'));
               return;
            }
            resolve(blob);
         }, 'image/jpeg', 0.95);
      });
   };

   const handleSave = async () => {
      if (croppedAreaPixels) {
         setIsProcessing(true);
         try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
            onCropComplete(croppedImage);
         } catch (e) {
            console.error(e);
         } finally {
            setIsProcessing(false);
         }
      }
   };

   const handleReset = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
   };

   const rotateLeft = () => {
      setRotation((prev) => (prev - 90 + 360) % 360);
   };

   const rotateRight = () => {
      setRotation((prev) => (prev + 90) % 360);
   };

   const zoomIn = () => {
      setZoom((prev) => Math.min(prev + 0.2, 3));
   };

   const zoomOut = () => {
      setZoom((prev) => Math.max(prev - 0.2, 1));
   };

   return (
      <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
         <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
            {/* Screen reader only title and description */}
            <DialogTitle className="sr-only">Crop & Adjust Image</DialogTitle>
            <DialogDescription className="sr-only">Use the controls below to crop, zoom, and rotate your image</DialogDescription>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-card">
               <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                     <Crop className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                     <h2 className="text-base font-semibold text-foreground">Crop & Adjust</h2>
                     <p className="text-xs text-muted-foreground">Drag to reposition • Scroll to zoom</p>
                  </div>
               </div>
               <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
               >
                  <X className="w-4 h-4" />
               </Button>
            </div>

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
                  style={{
                     containerStyle: {
                        background: 'hsl(var(--muted) / 0.3)'
                     },
                     cropAreaStyle: {
                        border: '2px solid hsl(var(--primary))',
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
                     }
                  }}
               />

               {/* Move hint overlay */}
               <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-background/90 backdrop-blur-sm rounded-full text-xs text-muted-foreground border shadow-sm">
                  <Move className="w-3 h-3" />
                  <span>Drag to move</span>
               </div>
            </div>

            {/* Controls */}
            <div className="px-5 py-4 space-y-4 bg-card border-t">
               {/* Quick Actions */}
               <div className="flex items-center justify-center gap-2">
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={rotateLeft}
                     className="h-8 text-xs"
                  >
                     <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                     -90°
                  </Button>
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={handleReset}
                     className="h-8 text-xs"
                  >
                     <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                     Reset
                  </Button>
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={rotateRight}
                     className="h-8 text-xs"
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
                     <span className="font-mono text-foreground">{Math.round(zoom * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                        variant="ghost"
                        size="icon"
                        onClick={zoomOut}
                        disabled={zoom <= 1}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                     >
                        <ZoomOut className="w-3.5 h-3.5" />
                     </Button>
                     <Slider
                        value={[zoom]}
                        min={1}
                        max={3}
                        step={0.01}
                        onValueChange={(value) => setZoom(value[0])}
                        className="flex-1"
                     />
                     <Button
                        variant="ghost"
                        size="icon"
                        onClick={zoomIn}
                        disabled={zoom >= 3}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                     <span className="font-mono text-foreground">{rotation}°</span>
                  </div>
                  <Slider
                     value={[rotation]}
                     min={0}
                     max={360}
                     step={1}
                     onValueChange={(value) => setRotation(value[0])}
                  />
               </div>

               {/* Action Buttons */}
               <div className="flex gap-3 pt-1">
                  <Button
                     variant="outline"
                     onClick={onCancel}
                     className="flex-1 h-10"
                  >
                     <X className="w-4 h-4 mr-2" />
                     Cancel
                  </Button>
                  <Button
                     onClick={handleSave}
                     disabled={isProcessing}
                     className="flex-1 h-10 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                  >
                     {isProcessing ? (
                        <>
                           <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                           Processing...
                        </>
                     ) : (
                        <>
                           <Check className="w-4 h-4 mr-2" />
                           Apply
                        </>
                     )}
                  </Button>
               </div>
            </div>
         </DialogContent>
      </Dialog>
   );
};
