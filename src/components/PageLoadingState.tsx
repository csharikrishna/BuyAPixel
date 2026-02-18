import { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoadingStateProps {
   /** Optional message to display below the spinner */
   message?: string;
}

/**
 * Shared full-page loading state with spinner and optional message.
 */
const PageLoadingState = memo(function PageLoadingState({
   message = 'Loading...',
}: PageLoadingStateProps) {
   return (
      <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
         </div>
      </div>
   );
});

export default PageLoadingState;
