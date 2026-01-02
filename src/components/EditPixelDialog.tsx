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
         toast.error("Failed to update pixel: " + error.message);
      } finally {
         setLoading(false);
      }
   };

   return (
      <Dialog open={isOpen} onOpenChange={onClose}>
         <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
               <DialogTitle>Edit Pixel ({pixel?.x}, {pixel?.y})</DialogTitle>
               <DialogDescription>
                  Update the image and link for your pixel.
               </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
               <div className="space-y-2">
                  <Label>Pixel Image</Label>
                  <ImageUpload
                     onImageUploaded={setImageUrl}
                     currentImage={imageUrl}
                     bucket="blog-images"
                     folder="user-pixels"
                  />
               </div>
               <div className="space-y-2">
                  <Label htmlFor="link">Link URL</Label>
                  <Input
                     id="link"
                     value={linkUrl}
                     onChange={(e) => setLinkUrl(e.target.value)}
                     placeholder="https://yourwebsite.com"
                  />
               </div>
               <div className="space-y-2">
                  <Label htmlFor="alt">Alt Text</Label>
                  <Input
                     id="alt"
                     value={altText}
                     onChange={(e) => setAltText(e.target.value)}
                     placeholder="Description of your pixel"
                  />
               </div>
               <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                     Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                     {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     Save Changes
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}
