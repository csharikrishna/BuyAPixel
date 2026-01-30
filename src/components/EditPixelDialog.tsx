import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";

interface EditPixelDialogProps {
   pixel: {
      id: string;
      x: number;
      y: number;
      image_url?: string;
      link_url?: string;
      alt_text?: string;
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

   useEffect(() => {
      if (pixel) {
         setImageUrl(pixel.image_url || "");
         setLinkUrl(pixel.link_url || "");
         setAltText(pixel.alt_text || "");
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

      // Optimistic update - show changes immediately
      setLoading(true);

      try {
         const { error } = await supabase
            .from('pixels')
            .update({
               image_url: imageUrl || null,
               link_url: linkUrl || null,
               alt_text: altText || null
            })
            .eq('id', pixel.id);

         if (error) throw error;

         toast.success("Pixel updated successfully!");
         onUpdate();
         onClose();
      } catch (error: any) {
         // Rollback on error
         setImageUrl(previousValues.image_url || "");
         setLinkUrl(previousValues.link_url || "");
         setAltText(previousValues.alt_text || "");
         toast.error("Failed to update pixel: " + error.message);
      } finally {
         setLoading(false);
      }
   };


   return (
      <Dialog open={isOpen} onOpenChange={onClose}>
         <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b">
               <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  Edit Pixel ({pixel?.x}, {pixel?.y})
               </DialogTitle>
               <DialogDescription className="text-base">
                  Customize your pixel's appearance. Upload an image to make it stand out on the canvas.
               </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-6 pt-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Image */}
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <Label className="text-base font-semibold">Pixel Image</Label>
                        <p className="text-xs text-muted-foreground">
                           Recommended: Square image, under 3MB.
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
                     Save Changes
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}
