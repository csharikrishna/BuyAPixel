/**
 * File Upload Utilities
 * Handles file validation, compression, and size management for pixel uploads
 */

// Constants
export const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB hard limit per requirements
export const MAX_FILE_SIZE_MB = 0.5;

// Allowed file types for pixel uploads
export const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/heic': ['heic'],
  'image/heif': ['heif'], // HEIC can also be HEIF
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
};

// Magic bytes for file validation (prevent spoofed files)
const MAGIC_BYTES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  heic: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp at offset 4
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
    
    case 'application/pdf':
      return bytes.slice(0, 4).every((byte, i) => byte === MAGIC_BYTES.pdf[i]);
    
    case 'image/heic':
    case 'image/heif':
      // HEIC has ftyp at offset 4
      return bytes.slice(4, 8).every((byte, i) => byte === MAGIC_BYTES.heic[i]);
    
    default:
      return true; // For unsupported checks, assume valid
  }
}

/**
 * Validate file size
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size must be ≤ ${MAX_FILE_SIZE_MB}MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return { valid: true };
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
 * Comprehensive file validation
 */
export async function validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // Check file size first (fastest check)
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) return sizeCheck;

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
 * Compress image to meet 500KB limit
 * Note: This is for image files only (JPG, PNG, HEIC)
 */
export async function compressImage(
  file: File,
  targetSizeBytes: number = MAX_FILE_SIZE_BYTES,
): Promise<Blob> {
  // For non-image files or if already small enough, return as-is
  if (!file.type.startsWith('image/')) {
    if (file.size <= targetSizeBytes) {
      return file;
    }
    throw new Error(`${file.type} cannot be compressed. File too large (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { alpha: true });

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Start with original dimensions
          let width = img.width;
          let height = img.height;
          canvas.width = width;
          canvas.height = height;

          // Draw image
          ctx.drawImage(img, 0, 0);

          // Compress iteratively with quality reduction
          let quality = 0.95;
          let blob: Blob | null = null;

          const compress = (quality: number) => {
            canvas.toBlob(
              (resultBlob) => {
                if (!resultBlob) {
                  reject(new Error('Failed to compress image'));
                  return;
                }

                blob = resultBlob;

                if (blob.size <= targetSizeBytes || quality <= 0.1) {
                  resolve(blob);
                } else {
                  // Reduce quality further
                  compress(quality - 0.05);
                }
              },
              'image/jpeg',
              quality
            );
          };

          compress(quality);
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
    'image/heic': 'HEIC Image',
    'image/heif': 'HEIF Image',
    'application/pdf': 'PDF Document',
    'application/msword': 'Word Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (.docx)',
  };

  return descriptions[mimeType] || 'File';
}
