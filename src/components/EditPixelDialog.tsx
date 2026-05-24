import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Layers, Info } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";

interface EditPixelDialogProps {
   pixel: {
      id: string;
      x: number;
      y: number;
      image_url?: string;
      link_url?: string;
      alt_text?: string;
      block_id?: string;
   } | null;
   isOpen: boolean;
   onClose: () => void;
   onUpdate: () => void;
}

export function EditPixelDialog({ pixel, isOpen, onClose, onUpdate }: EditPixelDialogProps) {
   const [loading, setLoading] = useState(false);
   const [imageUrl, setImageUrl] = useState(pixel?.image_url || "");
   const [linkUrl, setLinkUrl] = useState(pixel?.link_url || "");
   const [altText, setAltText] = useState(pixel?.alt_text || "");
   const [blockPixelCount, setBlockPixelCount] = useState<number | null>(null);

   useEffect(() => {
      if (pixel) {
         setImageUrl(pixel.image_url || "");
         setLinkUrl(pixel.link_url || "");
         setAltText(pixel.alt_text || "");

         // If this pixel belongs to a block, count how many pixels are in it
         if (pixel.block_id) {
            supabase
               .from('pixels')
               .select('id', { count: 'exact', head: true })
               .eq('block_id', pixel.block_id)
               .then(({ count }) => {
                  setBlockPixelCount(count ?? null);
               });
         } else {
            setBlockPixelCount(null);
         }
      }
   }, [pixel]);

   const handleUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!pixel) return;

      // Store previous values for rollback
      const previousValues = {
         image_url: pixel.image_url,
         link_url: pixel.link_url,
         alt_text: pixel.alt_text
      };

      setLoading(true);

      try {
         const updateData = {
            image_url: imageUrl || null,
            link_url: linkUrl || null,
            alt_text: altText || null
         };

         if (pixel.block_id) {
            // Block pixel: update ALL pixels in the block + the pixel_blocks row
            // This ensures the image spans the entire block consistently

            // 1. Update all pixels in the block
            const { error: pixelsError } = await supabase
               .from('pixels')
               .update(updateData)
               .eq('block_id', pixel.block_id);

            if (pixelsError) throw pixelsError;

            // 2. Update the pixel_blocks row
            const { error: blockError } = await supabase
               .from('pixel_blocks')
               .update({
                  image_url: imageUrl || '', // pixel_blocks.image_url is NOT NULL
                  link_url: linkUrl || null,
                  alt_text: altText || null
               })
               .eq('id', pixel.block_id);

            if (blockError) {
               console.warn('Failed to update pixel_blocks row:', blockError);
               // Non-fatal — the pixel data is already updated
            }

            toast.success(`Block updated! (${blockPixelCount || 'all'} pixels)`);
         } else {
            // Individual pixel: update just this one
            const { error } = await supabase
               .from('pixels')
               .update(updateData)
               .eq('id', pixel.id);

            if (error) throw error;

            toast.success("Pixel updated successfully!");
         }

         onUpdate();
         onClose();
      } catch (error: unknown) {
         // Rollback on error
         setImageUrl(previousValues.image_url || "");
         setLinkUrl(previousValues.link_url || "");
         setAltText(previousValues.alt_text || "");
         toast.error("Failed to update pixel: " + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
         setLoading(false);
      }
   };

   const isBlock = Boolean(pixel?.block_id);

   return (
      <Dialog open={isOpen} onOpenChange={onClose}>
         <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b">
               <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  {isBlock ? (
                     <>
                        <Layers className="w-5 h-5 text-blue-500" />
                        Edit Pixel Block
                     </>
                  ) : (
                     <>Edit Pixel ({pixel?.x}, {pixel?.y})</>
                  )}
               </DialogTitle>
               <DialogDescription className="text-base">
                  {isBlock
                     ? "Changes will apply to all pixels in this block."
                     : "Customize your pixel's appearance. Upload an image to make it stand out on the canvas."
                  }
               </DialogDescription>
            </DialogHeader>

            {/* Block notice */}
            {isBlock && blockPixelCount && (
               <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-blue-700 dark:text-blue-300">
                     This pixel is part of a <Badge variant="secondary" className="mx-1 bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300">{blockPixelCount}-pixel block</Badge> — your changes will update the entire block.
                  </span>
               </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-6 pt-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Image */}
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <Label className="text-base font-semibold">Pixel Image</Label>
                        <p className="text-xs text-muted-foreground">
                           {isBlock
                              ? "This image will span across all pixels in the block."
                              : "Recommended: Square image, under 3MB."
                           }
                        </p>
                     </div>
                     <ImageUpload
                        onImageUploaded={setImageUrl}
                        currentImage={imageUrl}
                        bucket="blog-images"
                        folder="user-pixels"
                        cropAspectRatio={1}
                        maxSizeMB={3}
                        placeholder="Upload New Image"
                        className="w-full"
                     />
                  </div>

                  {/* Right Column: Details */}
                  <div className="space-y-6">
                     <div className="space-y-3">
                        <Label htmlFor="link" className="text-base font-semibold">Destination URL</Label>
                        <Input
                           id="link"
                           value={linkUrl}
                           onChange={(e) => setLinkUrl(e.target.value)}
                           placeholder="https://yourwebsite.com"
                           className="h-11"
                        />
                        <p className="text-xs text-muted-foreground">
                           Where visitors will go when they click your pixel.
                        </p>
                     </div>

                     <div className="space-y-3">
                        <Label htmlFor="alt" className="text-base font-semibold">Alt Text & Tooltip</Label>
                        <Input
                           id="alt"
                           value={altText}
                           onChange={(e) => setAltText(e.target.value)}
                           placeholder="My Awesome Pixel"
                           className="h-11"
                        />
                        <p className="text-xs text-muted-foreground">
                           Text shown when hovering over your pixel.
                        </p>
                     </div>
                  </div>
               </div>
               <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="h-11 px-6">
                     Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="h-11 px-6 bg-primary hover:bg-primary/90">
                     {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     {isBlock ? 'Update Block' : 'Save Changes'}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}
