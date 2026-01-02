import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  Copy,
  Eye,
  Trash2
} from 'lucide-react';
import { cn, getErrorMessage } from '@/lib/utils';

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImage?: string;
  folder?: string;
  accept?: string;
  bucket?: string;
}

export const ImageUpload = ({
  onImageUploaded,
  currentImage,
  folder = 'posts',
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  bucket = 'blog-images'
}: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
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
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadImage(file);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadImage(file);
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
    <div className="space-y-4">
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
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50',
            uploading && 'pointer-events-none opacity-50'
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading image...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-12 h-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PNG, JPG, GIF or WebP (max. 5MB)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="relative group">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  copyUrl();
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy URL
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(preview, '_blank');
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                View
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>
          <div className="p-3 bg-muted">
            <p className="text-xs text-muted-foreground truncate">{preview}</p>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Tip: Use descriptive filenames and compress images before uploading for better SEO
      </p>
    </div>
  );
};
