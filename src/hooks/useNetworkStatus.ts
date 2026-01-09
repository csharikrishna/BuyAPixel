import { useState, useEffect } from 'react';

type ConnectionType = 'bluetooth' | 'cellular' | 'ethernet' | 'mixed' | 'none' | 'other' | 'unknown' | 'wifi' | 'wimax';
type EffectiveConnectionType = '2g' | '3g' | '4g' | 'slow-2g';

interface NetworkInformation extends EventTarget {
   readonly type?: ConnectionType;
   readonly effectiveType?: EffectiveConnectionType;
   readonly downlink?: number;
   readonly rtt?: number;
   readonly saveData?: boolean;
   onchange?: EventListener;
}

interface NavigatorWithConnection extends Navigator {
   connection?: NetworkInformation;
   mozConnection?: NetworkInformation;
   webkitConnection?: NetworkInformation;
}

export function useNetworkStatus() {
   const [isOnline, setIsOnline] = useState(navigator.onLine);

   // connection speed: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'
   const [connectionQuality, setConnectionQuality] = useState<EffectiveConnectionType | 'unknown'>('unknown');

   useEffect(() => {
      const nav = navigator as NavigatorWithConnection;
      const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

      const updateStatus = () => {
         setIsOnline(navigator.onLine);
         if (connection && connection.effectiveType) {
            setConnectionQuality(connection.effectiveType);
         }
      };

      // Initial check
      updateStatus();

      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);

      if (connection) {
         connection.addEventListener('change', updateStatus);
      }

      return () => {
         window.removeEventListener('online', updateStatus);
         window.removeEventListener('offline', updateStatus);
         if (connection) {
            connection.removeEventListener('change', updateStatus);
         }
      };
   }, []);

   return { isOnline, connectionQuality };
}
