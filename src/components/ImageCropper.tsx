import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, X, RotateCw, ZoomIn } from 'lucide-react';

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

   const onCropChange = (crop: Point) => {
      setCrop(crop);
   };

   const onZoomChange = (zoom: number) => {
      setZoom(zoom);
   };

   const onRotationChange = (rotation: number) => {
      setRotation(rotation);
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
         }, 'image/jpeg');
      });
   };

   const handleSave = async () => {
      if (croppedAreaPixels) {
         try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
            onCropComplete(croppedImage);
         } catch (e) {
            console.error(e);
         }
      }
   };

   return (
      <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
         <DialogContent className="sm:max-w-[600px] h-[90vh] sm:h-auto flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-4 sm:p-6 pb-2">
               <DialogTitle>Adjust Image</DialogTitle>
            </DialogHeader>

            <div className="relative flex-1 min-h-[300px] bg-black">
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
               />
            </div>

            <div className="p-4 sm:p-6 space-y-4 bg-background border-t">
               <div className="space-y-4">
                  <div className="flex items-center gap-4">
                     <ZoomIn className="w-4 h-4 text-muted-foreground" />
                     <Slider
                        value={[zoom]}
                        min={1}
                        max={3}
                        step={0.1}
                        onValueChange={(value) => setZoom(value[0])}
                        className="flex-1"
                     />
                  </div>

                  <div className="flex items-center gap-4">
                     <RotateCw className="w-4 h-4 text-muted-foreground" />
                     <Slider
                        value={[rotation]}
                        min={0}
                        max={360}
                        step={1}
                        onValueChange={(value) => setRotation(value[0])}
                        className="flex-1"
                     />
                  </div>
               </div>

               <DialogFooter className="flex-row gap-2 justify-end">
                  <Button variant="outline" onClick={onCancel}>
                     <X className="w-4 h-4 mr-2" />
                     Cancel
                  </Button>
                  <Button onClick={handleSave}>
                     <Check className="w-4 h-4 mr-2" />
                     Apply
                  </Button>
               </DialogFooter>
            </div>
         </DialogContent>
      </Dialog>
   );
};
