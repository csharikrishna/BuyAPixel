import { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Copy,
  Eye,
  Trash2,
  Crop,
  XCircle,
  AlertTriangle,
  FileImage,
  RefreshCw,
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
  maxSizeMB?: number;
  maxWidth?: number;
  maxHeight?: number;
  compressBeforeUpload?: boolean;
  compressionQuality?: number;
  allowRetry?: boolean;
}

// Constants
const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_MAX_WIDTH = 2048;
const DEFAULT_MAX_HEIGHT = 2048;
const DEFAULT_COMPRESSION_QUALITY = 0.85;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

/**
 * Compress image using Canvas API
 */
const compressImage = async (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          // Use OffscreenCanvas if available (better performance in 2026)
          const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
          
          let canvas: HTMLCanvasElement | OffscreenCanvas;
          let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

          if (supportsOffscreenCanvas) {
            canvas = new OffscreenCanvas(width, height);
            ctx = canvas.getContext('2d', { alpha: true });
          } else {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d', { alpha: true });
          }

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob
          const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          
          if (canvas instanceof OffscreenCanvas) {
            canvas
              .convertToBlob({ type: outputFormat, quality })
              .then(resolve)
              .catch(reject);
          } else {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('Failed to compress image'));
                }
              },
              outputFormat,
              quality
            );
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Validate file before processing
 */
const validateFile = (
  file: File,
  maxSizeMB: number,
  accept: string
): { valid: boolean; error?: string } => {
  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // Check file type
  if (!file.type.startsWith('image/')) {
    return {
      valid: false,
      error: 'Please upload an image file',
    };
  }

  // Check if MIME type is in allowed list
  const acceptedTypes = accept.split(',').map((t) => t.trim());
  if (!acceptedTypes.includes(file.type) && !acceptedTypes.includes('image/*')) {
    return {
      valid: false,
      error: `File type ${file.type} is not supported. Allowed types: ${accept}`,
    };
  }

  return { valid: true };
};

export const ImageUpload = ({
  onImageUploaded,
  currentImage,
  folder = 'posts',
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  bucket = 'blog-images',
  cropAspectRatio,
  className,
  placeholder = 'Click to upload or drag and drop',
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  maxWidth = DEFAULT_MAX_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
  compressBeforeUpload = true,
  compressionQuality = DEFAULT_COMPRESSION_QUALITY,
  allowRetry = true,
}: ImageUploadProps) => {
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  // React 19 hooks
  const [isPending, startTransition] = useTransition();

  // State
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Abort ongoing upload
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Revoke all object URLs to prevent memory leaks
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current.clear();
    };
  }, []);

  // Update preview when currentImage changes
  useEffect(() => {
    if (currentImage) {
      setPreview(currentImage);
    }
  }, [currentImage]);

  // Create and track object URL
  const createObjectUrl = useCallback((blob: Blob | File): string => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  // Revoke object URL
  const revokeObjectUrl = useCallback((url: string) => {
    if (objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setOriginalFile(file);

      // Validate file
      const validation = validateFile(file, maxSizeMB, accept);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        toast.error(validation.error || 'Invalid file');
        return;
      }

      try {
        let processedFile: File | Blob = file;

        // Compress image if enabled
        if (compressBeforeUpload && file.type !== 'image/gif' && file.type !== 'image/svg+xml') {
          toast.info('Compressing image...', { duration: 2000 });
          
          const compressed = await compressImage(
            file,
            maxWidth,
            maxHeight,
            compressionQuality
          );

          // Only use compressed version if it's smaller
          if (compressed.size < file.size) {
            processedFile = compressed;
            setCompressedSize(compressed.size);
            
            const savedKB = ((file.size - compressed.size) / 1024).toFixed(2);
            toast.success(`Compressed! Saved ${savedKB} KB`, { duration: 3000 });
          } else {
            toast.info('Original size is optimal', { duration: 2000 });
          }
        }

        if (cropAspectRatio) {
          // Create object URL for cropping
          const objectUrl = createObjectUrl(processedFile);
          setImageToCrop(objectUrl);
          setCropperOpen(true);
        } else {
          // Direct upload if no cropping needed
          await uploadImage(processedFile);
        }
      } catch (error) {
        console.error('Processing error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to process image';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [
      maxSizeMB,
      accept,
      compressBeforeUpload,
      maxWidth,
      maxHeight,
      compressionQuality,
      cropAspectRatio,
      createObjectUrl,
    ]
  );

  const uploadImage = useCallback(
    async (file: Blob) => {
      if (!isMountedRef.current) return;

      try {
        setUploading(true);
        setUploadProgress(0);
        setError(null);

        // Create new AbortController for this upload
        abortControllerRef.current = new AbortController();

        // Generate unique filename
        const fileExt = file.type.split('/')[1] || 'jpg';
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Simulate progress (Supabase doesn't provide native progress for storage)
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        clearInterval(progressInterval);

        if (error) throw error;

        // Complete progress
        setUploadProgress(100);

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(data.path);

        if (!isMountedRef.current) return;

        startTransition(() => {
          setPreview(publicUrl);
          onImageUploaded(publicUrl);
        });

        const sizeKB = (file.size / 1024).toFixed(2);
        toast.success('Image uploaded successfully!', {
          description: `Size: ${sizeKB} KB`,
        });
      } catch (error: unknown) {
        if (!isMountedRef.current) return;

        // Check if upload was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          toast.info('Upload cancelled');
          return;
        }

        console.error('Upload error:', error);
        const errorMsg = getErrorMessage(error) || 'Failed to upload image';
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        if (isMountedRef.current) {
          setUploading(false);
          setUploadProgress(0);
          abortControllerRef.current = null;

          // Clean up cropping state
          if (imageToCrop) {
            revokeObjectUrl(imageToCrop);
            setImageToCrop(null);
          }
        }
      }
    },
    [folder, bucket, onImageUploaded, imageToCrop, revokeObjectUrl]
  );

  const handleCropComplete = useCallback(
    (croppedBlob: Blob) => {
      setCropperOpen(false);
      uploadImage(croppedBlob);
    },
    [uploadImage]
  );

  const handleCropCancel = useCallback(() => {
    setCropperOpen(false);
    
    if (imageToCrop) {
      revokeObjectUrl(imageToCrop);
      setImageToCrop(null);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setOriginalFile(null);
    setCompressedSize(null);
  }, [imageToCrop, revokeObjectUrl]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleRemove = useCallback(() => {
    startTransition(() => {
      setPreview(null);
      onImageUploaded('');
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setOriginalFile(null);
    setCompressedSize(null);
    setError(null);
    
    toast.success('Image removed');
  }, [onImageUploaded]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast.info('Upload cancelled');
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (originalFile) {
      processFile(originalFile);
    }
  }, [originalFile, processFile]);

  const copyUrl = useCallback(() => {
    if (preview) {
      navigator.clipboard.writeText(preview);
      toast.success('Image URL copied to clipboard!');
    }
  }, [preview]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle when not in input
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + V to paste image
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        navigator.clipboard.read().then((items) => {
          for (const item of items) {
            const imageType = item.types.find((type) => type.startsWith('image/'));
            if (imageType) {
              item.getType(imageType).then((blob) => {
                const file = new File([blob], `pasted-image.${imageType.split('/')[1]}`, {
                  type: imageType,
                });
                processFile(file);
              });
            }
          }
        });
      }

      // ESC to cancel upload
      if (e.key === 'Escape' && uploading) {
        handleCancel();
      }
    },
    [uploading, handleCancel, processFile]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <div className={cn('space-y-4', className)}>
        <Input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          id="image-upload"
          aria-label="Upload image file"
        />

        {!preview ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                !uploading && fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload image area"
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
                <div className="space-y-3 w-full max-w-xs">
                  <p className="font-semibold text-foreground">Uploading image...</p>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel();
                    }}
                    className="mt-2"
                  >
                    <XCircle className="w-3 h-3 mr-2" />
                    Cancel Upload
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-primary/10 p-4 rounded-full ring-8 ring-primary/5 transition-transform hover:scale-110 duration-300">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{placeholder}</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Supports PNG, JPG, GIF or WebP (max. {maxSizeMB}MB)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Or press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+V</kbd>{' '}
                    to paste
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 text-left"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm text-destructive">
                  <p className="font-medium">Upload Failed</p>
                  <p className="text-xs mt-1">{error}</p>
                  {allowRetry && originalFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry();
                      }}
                      className="mt-2 h-7 text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Retry Upload
                    </Button>
                  )}
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
                loading="lazy"
              />
              
              {isPending && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            
            {compressedSize && (
              <div className="px-3 py-2 bg-primary/5 border-b flex items-center gap-2 text-xs text-muted-foreground">
                <FileImage className="w-3.5 h-3.5" />
                <span>
                  Compressed to {(compressedSize / 1024).toFixed(2)} KB
                  {originalFile && (
                    <> (saved {((originalFile.size - compressedSize) / 1024).toFixed(2)} KB)</>
                  )}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 p-2 bg-muted/30 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  copyUrl();
                }}
                className="h-8 w-full sm:w-auto"
                aria-label="Copy image URL"
              >
                <Copy className="w-3 h-3 mr-2" />
                Copy URL
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(preview, '_blank', 'noopener,noreferrer');
                }}
                className="h-8 w-full sm:w-auto"
                aria-label="View image in new tab"
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
                aria-label="Change image"
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
                aria-label="Remove image"
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
          maxWidth={maxWidth}
          maxHeight={maxHeight}
          quality={compressionQuality}
        />
      )}
    </>
  );
};
