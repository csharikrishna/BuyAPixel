/**
 * QR Code Utility Functions
 * Provides utilities for generating QR code URLs and downloading QR images
 */

import { toast } from 'sonner';

/**
 * Base URL for QR code generation API
 * Can be overridden via VITE_QR_API_URL environment variable
 */
export const QR_API_URL =
   import.meta.env.VITE_QR_API_URL || 'https://api.qrserver.com/v1/create-qr-code';

/**
 * Generates a URL for a QR code image
 * @param data - The data to encode in the QR code
 * @param size - The size of the QR code in pixels (default: 200)
 * @returns URL string for the QR code image
 */
export const getQrCodeUrl = (data: string, size: number = 200): string => {
   return `${QR_API_URL}/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
};

/**
 * Downloads a QR code as an image file
 * @param data - The data encoded in the QR code
 * @param filename - The filename for the downloaded image
 * @param size - The size of the QR code in pixels (default: 300)
 */
export const downloadQrCode = async (
   data: string,
   filename: string,
   size: number = 300
): Promise<void> => {
   try {
      const qrUrl = getQrCodeUrl(data, size);
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('QR saved to downloads');
   } catch (err) {
      console.error('QR download failed:', err);
      toast.error('Download failed');
   }
};

/**
 * Generates the profile QR code URL for a user
 * @param userId - The user's ID
 * @param origin - The window origin (defaults to current)
 * @returns Full URL to the user's profile
 */
export const getProfileUrl = (
   userId: string,
   origin: string = window.location.origin
): string => {
   return `${origin}/profile?id=${userId}`;
};

/**
 * Generates the pixel QR code URL for a pixel location
 * @param x - The x coordinate
 * @param y - The y coordinate
 * @param origin - The window origin (defaults to current)
 * @returns Full URL to the pixel location
 */
export const getPixelUrl = (
   x: number,
   y: number,
   origin: string = window.location.origin
): string => {
   return `${origin}/?pixel=${x},${y}`;
};
