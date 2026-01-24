/**
 * useQRScanner Hook
 * Manages QR code scanner lifecycle including initialization, scanning, and cleanup
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface UseQRScannerOptions {
   /** Whether the scanner should be active */
   enabled?: boolean;
   /** Frames per second for scanning */
   fps?: number;
   /** Size of the QR box */
   qrboxSize?: number;
   /** DOM element ID for the scanner */
   elementId?: string;
   /** Callback when a QR code is successfully scanned */
   onScanSuccess?: (decodedText: string) => void;
   /** Callback when scanning fails (optional, usually ignored) */
   onScanFailure?: (error: unknown) => void;
}

export interface UseQRScannerReturn {
   /** The last scanned result */
   scanResult: string | null;
   /** Any error that occurred */
   error: string | null;
   /** Whether the scanner is currently active */
   isScanning: boolean;
   /** Reset the scan state */
   resetScan: () => void;
   /** Set an error manually */
   setError: (error: string | null) => void;
}

export const useQRScanner = ({
   enabled = true,
   fps = 10,
   qrboxSize = 250,
   elementId = 'reader',
   onScanSuccess,
   onScanFailure,
}: UseQRScannerOptions = {}): UseQRScannerReturn => {
   const [scanResult, setScanResult] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [isScanning, setIsScanning] = useState(false);

   const scannerRef = useRef<Html5QrcodeScanner | null>(null);
   const timerRef = useRef<ReturnType<typeof setTimeout>>();

   const resetScan = useCallback(() => {
      setScanResult(null);
      setError(null);
   }, []);

   useEffect(() => {
      // Don't initialize if not enabled
      if (!enabled) {
         if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
            setIsScanning(false);
         }
         return;
      }

      const handleScanSuccess = (decodedText: string) => {
         setScanResult(decodedText);
         onScanSuccess?.(decodedText);
      };

      const handleScanFailure = (err: unknown) => {
         // Most scan failures are just "no QR found in frame" - ignore them
         onScanFailure?.(err);
      };

      const config = {
         fps,
         qrbox: { width: qrboxSize, height: qrboxSize },
         formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
         rememberLastUsedCamera: true,
      };

      const initScanner = () => {
         const element = document.getElementById(elementId);
         if (element) {
            const scanner = new Html5QrcodeScanner(elementId, config, /* verbose= */ false);
            scannerRef.current = scanner;
            scanner.render(handleScanSuccess, handleScanFailure);
            setIsScanning(true);
         } else {
            // If element doesn't exist yet, retry in 50ms
            timerRef.current = setTimeout(initScanner, 50);
         }
      };

      // Start initialization process
      initScanner();

      return () => {
         if (timerRef.current) clearTimeout(timerRef.current);
         if (scannerRef.current) {
            scannerRef.current.clear().catch((error) => {
               console.error('Failed to clear html5-qrcode scanner. ', error);
            });
            scannerRef.current = null;
            setIsScanning(false);
         }
      };
   }, [enabled, fps, qrboxSize, elementId, onScanSuccess, onScanFailure]);

   return {
      scanResult,
      error,
      isScanning,
      resetScan,
      setError,
   };
};
