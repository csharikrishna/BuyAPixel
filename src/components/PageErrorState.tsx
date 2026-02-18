import { memo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PageErrorStateProps {
   /** Error message to display */
   message?: string;
   /** Optional callback for retry button */
   onRetry?: () => void;
   /** Whether to show the "Go Home" button */
   showHomeButton?: boolean;
}

/**
 * Shared full-page error state with retry and home actions.
 */
const PageErrorState = memo(function PageErrorState({
   message = 'Something went wrong. Please try again.',
   onRetry,
   showHomeButton = true,
}: PageErrorStateProps) {
   return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
         <Card className="w-full max-w-md border-destructive/20">
            <CardContent className="p-8 text-center space-y-6">
               <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
               </div>

               <div>
                  <h2 className="text-xl font-bold mb-2">Oops!</h2>
                  <p className="text-sm text-muted-foreground">{message}</p>
               </div>

               <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {onRetry && (
                     <Button onClick={onRetry} variant="outline" className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                     </Button>
                  )}
                  {showHomeButton && (
                     <Button
                        onClick={() => (window.location.href = '/')}
                        variant="ghost"
                        className="gap-2"
                     >
                        <Home className="w-4 h-4" />
                        Go Home
                     </Button>
                  )}
               </div>
            </CardContent>
         </Card>
      </div>
   );
});

export default PageErrorState;
