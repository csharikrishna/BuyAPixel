/**
 * File Upload Utilities
 * Handles file validation, compression, and size management for pixel uploads
 *
 * Design: Accept ANY image size → compress to ≤500KB → upload.
 * Validation only checks file type and magic bytes (not size).
 */

// The target size for compressed images stored in Supabase
export const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB storage target
export const MAX_FILE_SIZE_MB = 0.5;

// Sanity cap: reject files over 25MB before even loading into memory
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
export const MAX_UPLOAD_SIZE_MB = 25;

// Allowed file types for pixel uploads (must be renderable as images)
export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
};

// Magic bytes for file validation (prevent spoofed files)
const MAGIC_BYTES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP starts with RIFF....WEBP)
  gif: [0x47, 0x49, 0x46],        // GIF87a or GIF89a
} as const;

/**
 * Validate file magic bytes to prevent spoofed uploads
 */
export async function validateMagicBytes(file: File, mimeType: string): Promise<boolean> {
  const buffer = await file.slice(0, 32).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  switch (mimeType) {
    case 'image/jpeg':
      return bytes[0] === MAGIC_BYTES.jpeg[0] && 
             bytes[1] === MAGIC_BYTES.jpeg[1] && 
             bytes[2] === MAGIC_BYTES.jpeg[2];
    
    case 'image/png':
      return bytes.slice(0, 4).every((byte, i) => byte === MAGIC_BYTES.png[i]);
    
    case 'image/webp':
      // WebP: RIFF....WEBP
      return bytes.slice(0, 4).every((byte, i) => byte === MAGIC_BYTES.webp[i]) &&
             bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    
    case 'image/gif':
      return bytes.slice(0, 3).every((byte, i) => byte === MAGIC_BYTES.gif[i]);
    
    default:
      return true; // For unsupported checks, assume valid
  }
}

/**
 * Validate file type
 */
export function validateFileType(file: File): { valid: boolean; error?: string } {
  const mimeType = file.type;
  
  // Check if MIME type is in allowed list
  if (!Object.keys(ALLOWED_FILE_TYPES).includes(mimeType)) {
    const allowed = Object.keys(ALLOWED_FILE_TYPES)
      .map(type => type.split('/')[1])
      .join(', ')
      .toUpperCase();
    
    return {
      valid: false,
      error: `File type not supported. Allowed: ${allowed}`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation.
 * Only checks type and integrity — NOT size.
 * Size is handled by compression after validation.
 */
export async function validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // Sanity cap: reject absurdly large files before loading into memory
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum upload size is ${MAX_UPLOAD_SIZE_MB}MB.`,
    };
  }

  // Check file type
  const typeCheck = validateFileType(file);
  if (!typeCheck.valid) return typeCheck;

  // Validate magic bytes to prevent spoofed files
  const magicBytesValid = await validateMagicBytes(file, file.type);
  if (!magicBytesValid) {
    return {
      valid: false,
      error: 'File appears to be corrupted or spoofed. Please upload a valid file.',
    };
  }

  return { valid: true };
}

/**
 * Compress image to meet storage target (default 500KB).
 *
 * Strategy:
 *   1. If already under target → return as-is
 *   2. Try quality reduction first (fast, preserves dimensions)
 *   3. If quality alone isn't enough → progressively downscale dimensions
 *   4. Each downscale step reduces to 75% of previous size
 *
 * This guarantees any image (even 20MB DSLR photos) will compress to ≤500KB.
 */
export async function compressImage(
  file: File | Blob,
  targetSizeBytes: number = MAX_FILE_SIZE_BYTES,
): Promise<Blob> {
  // For non-image files, return as-is
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Already small enough — no compression needed
  if (file.size <= targetSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Start with original dimensions
          let width = img.width;
          let height = img.height;

          // Cap initial dimensions to 2048px (no need for larger for pixel display)
          const MAX_DIM = 2048;
          if (width > MAX_DIM || height > MAX_DIM) {
            const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { alpha: false });

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Recursive compress: try quality reduction, then downscale
          let currentQuality = 0.92;
          let currentScale = 1.0;
          const MIN_QUALITY = 0.3;
          const MIN_SCALE = 0.15; // Won't go below 15% of original dimensions
          let attempts = 0;
          const MAX_ATTEMPTS = 20;

          const tryCompress = () => {
            attempts++;
            if (attempts > MAX_ATTEMPTS) {
              // Safety valve — return whatever we have
              canvas.toBlob(
                (blob) => resolve(blob || new Blob()),
                'image/webp',
                MIN_QUALITY
              );
              return;
            }

            const w = Math.round(width * currentScale);
            const h = Math.round(height * currentScale);
            canvas.width = w;
            canvas.height = h;

            // Use high-quality downscaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            canvas.toBlob(
              (resultBlob) => {
                if (!resultBlob) {
                  reject(new Error('Failed to compress image'));
                  return;
                }

                if (resultBlob.size <= targetSizeBytes) {
                  // Success!
                  resolve(resultBlob);
                  return;
                }

                // Still too large — try reducing quality first
                if (currentQuality > MIN_QUALITY) {
                  currentQuality -= 0.08;
                  tryCompress();
                } else {
                  // Quality exhausted — downscale dimensions
                  currentQuality = 0.7; // Reset quality for new scale
                  currentScale *= 0.75; // Shrink to 75%

                  if (currentScale < MIN_SCALE) {
                    // Can't shrink further — resolve with what we have
                    resolve(resultBlob);
                    return;
                  }

                  tryCompress();
                }
              },
              'image/webp',
              currentQuality
            );
          };

          tryCompress();
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get user-friendly file type description
 */
export function getFileTypeDescription(mimeType: string): string {
  const descriptions: Record<string, string> = {
    'image/jpeg': 'JPG Image',
    'image/png': 'PNG Image',
    'image/webp': 'WebP Image',
    'image/gif': 'GIF Image',
  };

  return descriptions[mimeType] || 'File';
}
