import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Copy,
  Eye,
  Trash2,
  Crop
} from 'lucide-react';
import { cn, getErrorMessage } from '@/lib/utils';
import { ImageCropper } from '@/components/ImageCropper';

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImage?: string;
  folder?: string;
  accept?: string;
  bucket?: string;
  cropAspectRatio?: number;
  className?: string;
  placeholder?: string;
}

export const ImageUpload = ({
  onImageUploaded,
  currentImage,
  folder = 'posts',
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  bucket = 'blog-images',
  cropAspectRatio,
  className,
  placeholder = "Click to upload or drag and drop",
  maxSizeMB = 5
}: ImageUploadProps & { maxSizeMB?: number }) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentImage) {
      setPreview(currentImage);
    }
  }, [currentImage]);

  const processFile = (file: File) => {
    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image size should be less than ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (cropAspectRatio) {
      // Create object URL for cropping
      const objectUrl = URL.createObjectURL(file);
      setImageToCrop(objectUrl);
      setCropperOpen(true);
    } else {
      // Direct upload if no cropping needed
      uploadImage(file);
    }
  };

  const uploadImage = async (file: Blob) => {
    try {
      setUploading(true);

      // Generate unique filename
      // Blob might not have name, so we generate one
      const fileExt = file.type.split('/')[1] || 'jpg';
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      setPreview(publicUrl);
      onImageUploaded(publicUrl);
      toast.success('Image uploaded successfully!');
    } catch (error: unknown) {
      console.error('Upload error:', error);
      toast.error(getErrorMessage(error) || 'Failed to upload image');
    } finally {
      setUploading(false);
      // Clean up cropping state if needed
      if (imageToCrop) {
        URL.revokeObjectURL(imageToCrop);
        setImageToCrop(null);
      }
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    setCropperOpen(false);
    uploadImage(croppedBlob);
  };

  const handleCropCancel = () => {
    setCropperOpen(false);
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyUrl = () => {
    if (preview) {
      navigator.clipboard.writeText(preview);
      toast.success('Image URL copied to clipboard!');
    }
  };

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <Input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          id="image-upload"
        />

        {!preview ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/20',
              dragActive
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-border/50 hover:border-primary/50 hover:bg-muted/50 hover:scale-[1.01]',
              uploading && 'pointer-events-none opacity-50'
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <div className="relative bg-background p-4 rounded-full border shadow-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Uploading image...</p>
                  <p className="text-sm text-muted-foreground">Please wait a moment</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-primary/10 p-4 rounded-full ring-8 ring-primary/5 transition-transform group-hover:scale-110 duration-300">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{placeholder}</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Supports PNG, JPG, GIF or WebP (max. {maxSizeMB}MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card className="overflow-hidden bg-background border-2 border-muted">
            <div className="relative w-full bg-muted/20 flex justify-center items-center p-4 min-h-[200px]">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-auto max-h-[400px] object-contain rounded-md shadow-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 p-2 bg-muted/30 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  copyUrl();
                }}
                className="h-8 w-full sm:w-auto"
              >
                <Copy className="w-3 h-3 mr-2" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(preview, '_blank');
                }}
                className="h-8 w-full sm:w-auto"
              >
                <Eye className="w-3 h-3 mr-2" />
                View
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="h-8 w-full sm:w-auto"
              >
                <Upload className="w-3 h-3 mr-2" />
                Change
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="h-8 w-full sm:w-auto"
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Remove
              </Button>
            </div>
          </Card>
        )}
      </div>

      {imageToCrop && (
        <ImageCropper
          open={cropperOpen}
          image={imageToCrop}
          aspect={cropAspectRatio}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
};
