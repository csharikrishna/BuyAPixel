/**
 * Image Optimization Utilities
 * 
 * Uses Supabase Storage image transforms to serve optimized images
 * based on device size and zoom level.
 */

// Supabase Storage transformation parameters
interface ImageTransformOptions {
   width?: number;
   height?: number;
   quality?: number;
   format?: 'origin' | 'webp';
   resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Get an optimized image URL with Supabase transforms
 * 
 * @param url - Original image URL
 * @param width - Target width in pixels
 * @param quality - Image quality (1-100), default 80
 * @returns Optimized image URL
 */
export const getOptimizedImageUrl = (
   url: string | null | undefined,
   width: number = 400,
   quality: number = 80
): string => {
   if (!url) return '';

   // Only transform Supabase storage URLs
   if (url.includes('supabase.co/storage')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}width=${width}&quality=${quality}`;
   }

   return url;
};

/**
 * Get image URL optimized for pixel grid based on zoom level
 * 
 * @param url - Original image URL
 * @param zoom - Current zoom level (0.1 - 3.0)
 * @returns Optimized image URL
 */
export const getGridImageUrl = (
   url: string | null | undefined,
   zoom: number = 1
): string => {
   if (!url) return '';

   // At low zoom, use smaller images
   // At high zoom, use higher quality
   let width: number;
   let quality: number;

   if (zoom < 0.5) {
      width = 50;
      quality = 60;
   } else if (zoom < 1) {
      width = 100;
      quality = 70;
   } else if (zoom < 2) {
      width = 200;
      quality = 80;
   } else {
      width = 400;
      quality = 90;
   }

   return getOptimizedImageUrl(url, width, quality);
};

/**
 * Get thumbnail URL for listings/previews
 * 
 * @param url - Original image URL
 * @returns Thumbnail URL (150px width)
 */
export const getThumbnailUrl = (
   url: string | null | undefined
): string => {
   return getOptimizedImageUrl(url, 150, 75);
};

/**
 * Get billboard/featured image URL
 * 
 * @param url - Original image URL
 * @returns High quality image URL
 */
export const getBillboardImageUrl = (
   url: string | null | undefined
): string => {
   return getOptimizedImageUrl(url, 600, 85);
};

/**
 * Preload an image to browser cache
 * 
 * @param url - Image URL to preload
 * @returns Promise that resolves when loaded
 */
export const preloadImage = (url: string): Promise<void> => {
   return new Promise((resolve, reject) => {
      if (!url) {
         resolve();
         return;
      }

      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
      img.src = url;
   });
};

/**
 * Preload multiple images in parallel
 * 
 * @param urls - Array of image URLs
 * @returns Promise that resolves when all loaded
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
   const validUrls = urls.filter(Boolean);
   await Promise.allSettled(validUrls.map(preloadImage));
};

/**
 * Check if browser supports WebP format
 */
export const supportsWebP = (): boolean => {
   if (typeof document === 'undefined') return false;

   const canvas = document.createElement('canvas');
   canvas.width = 1;
   canvas.height = 1;
   return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};
