import { WifiOff } from "lucide-react";

export const OfflineBanner = () => {
   return (
      <div className="bg-yellow-500/90 text-yellow-950 px-4 py-2 text-center flex items-center justify-center gap-2 backdrop-blur-sm shadow-sm sticky top-0 z-50">
         <WifiOff className="w-4 h-4" />
         <span className="text-sm font-medium">
            You are currently offline. Check your internet connection.
         </span>
      </div>
   );
};
