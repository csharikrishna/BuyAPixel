/**
 * Error Boundary Component
 * Catches JavaScript errors in child component tree and displays fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
   children: ReactNode;
   /** Optional custom fallback component */
   fallback?: ReactNode;
   /** Called when an error is caught */
   onError?: (error: Error, errorInfo: ErrorInfo) => void;
   /** Optional page name for error message context */
   pageName?: string;
}

interface ErrorBoundaryState {
   hasError: boolean;
   error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
   constructor(props: ErrorBoundaryProps) {
      super(props);
      this.state = { hasError: false, error: null };
   }

   static getDerivedStateFromError(error: Error): ErrorBoundaryState {
      return { hasError: true, error };
   }

   componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
      this.props.onError?.(error, errorInfo);
   }

   handleReset = (): void => {
      this.setState({ hasError: false, error: null });
   };

   handleReload = (): void => {
      window.location.reload();
   };

   handleHome = (): void => {
      window.location.href = '/';
   };

   render(): ReactNode {
      if (this.state.hasError) {
         // Custom fallback if provided
         if (this.props.fallback) {
            return this.props.fallback;
         }

         // Default fallback UI
         return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
               <Card className="w-full max-w-md border-red-500/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 shadow-2xl">
                  <CardContent className="p-8 text-center space-y-6">
                     {/* Icon */}
                     <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-red-500/20">
                        <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                     </div>

                     {/* Message */}
                     <div>
                        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                           Something went wrong
                        </h2>
                        <p className="text-sm text-muted-foreground">
                           {this.props.pageName
                              ? `An error occurred while loading ${this.props.pageName}.`
                              : 'An unexpected error occurred.'}
                        </p>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                           <details className="mt-4 text-left">
                              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                 Show error details
                              </summary>
                              <pre className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-xs overflow-auto max-h-40 text-red-800 dark:text-red-200">
                                 {this.state.error.message}
                                 {'\n\n'}
                                 {this.state.error.stack}
                              </pre>
                           </details>
                        )}
                     </div>

                     {/* Actions */}
                     <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                           onClick={this.handleReset}
                           variant="outline"
                           className="gap-2 backdrop-blur-sm"
                        >
                           <RefreshCw className="w-4 h-4" />
                           Try Again
                        </Button>
                        <Button
                           onClick={this.handleReload}
                           variant="outline"
                           className="gap-2 backdrop-blur-sm"
                        >
                           <RefreshCw className="w-4 h-4" />
                           Reload Page
                        </Button>
                        <Button
                           onClick={this.handleHome}
                           variant="ghost"
                           className="gap-2"
                        >
                           <Home className="w-4 h-4" />
                           Go Home
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            </div>
         );
      }

      return this.props.children;
   }
}

export default ErrorBoundary;
