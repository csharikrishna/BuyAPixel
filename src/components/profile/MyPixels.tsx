import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
   TrendingUp, MapPin, Loader2, Download,
   ExternalLink, Share2, Edit
} from 'lucide-react';
import { UserPixel, PixelStats } from '@/types/profile';
import { formatRelativeDate } from '@/utils/dateUtils';

interface MyPixelsProps {
   userPixels: UserPixel[];
   pixelStats: PixelStats;
   loading: boolean;
   isOwnProfile: boolean;
   exportLoading: boolean;
   onExportData: () => void;
   onVisitPixel: (url: string) => void;
   onSharePixel: (pixel: UserPixel) => void;
   onEditPixel: (pixel: UserPixel) => void;
}

export const MyPixels = ({
   userPixels,
   pixelStats,
   loading,
   isOwnProfile,
   exportLoading,
   onExportData,
   onVisitPixel,
   onSharePixel,
   onEditPixel
}: MyPixelsProps) => {
   return (
      <div className="lg:col-span-2 space-y-6">
         {/* Stats Overview */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-purple-500 to-blue-600 text-white border-0 shadow-lg group hover:scale-[1.02] transition-transform duration-300">
               <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                     <p className="text-purple-100">Total Investment</p>
                     <TrendingUp className="w-5 h-5 text-purple-200 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-3xl font-bold mb-1">${pixelStats.totalInvestment.toFixed(2)}</h3>
                  <p className="text-xs text-purple-200">Lifetime value</p>
               </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-purple-500/10 shadow-lg group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-xl bg-white/60 dark:bg-gray-900/60">
               <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                     <p className="text-muted-foreground">Total Pixels</p>
                     <MapPin className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className="text-3xl font-bold mb-1 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                     {pixelStats.totalPixels}
                  </h3>
                  <p className="text-xs text-muted-foreground">Owned locations</p>
               </CardContent>
            </Card>
         </div>

         {/* Pixels List */}
         <Card className="shadow-xl backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-purple-500/10">
            <CardHeader className="flex flex-row items-center justify-between">
               <div>
                  <CardTitle>My Pixels</CardTitle>
                  <CardDescription>
                     {isOwnProfile ? "Manage and view your pixels" : "Pixels owned by this user"}
                  </CardDescription>
               </div>
               {/* Export Data Button - Only for Owner */}
               {isOwnProfile && (
                  <Button
                     onClick={onExportData}
                     disabled={exportLoading}
                     variant="outline"
                     size="sm"
                  >
                     {exportLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                     ) : (
                        <Download className="w-4 h-4 mr-2" />
                     )}
                     Export Data
                  </Button>
               )}

            </CardHeader>
            <CardContent>
               {loading ? (
                  <div className="space-y-4">
                     <Skeleton className="h-24 w-full" />
                     <Skeleton className="h-24 w-full" />
                     <Skeleton className="h-24 w-full" />
                  </div>
               ) : userPixels.length === 0 ? (
                  <div className="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                     <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-gray-400" />
                     </div>
                     <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No pixels yet</h3>
                     <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {isOwnProfile ? "You haven't purchased any pixels yet." : "This user hasn't purchased any pixels yet."}
                     </p>
                     {isOwnProfile && (
                        <Link to="/">
                           <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/25 text-white border-0 transition-all duration-300">
                              Buy your first pixel
                           </Button>
                        </Link>
                     )}
                  </div>
               ) : (
                  <div className="space-y-4">
                     {userPixels.map((pixel) => (
                        <div
                           key={pixel.id}
                           className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-lg hover:border-purple-500/20 transition-all duration-300"
                        >
                           <div className="relative w-full sm:w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-800">
                              {pixel.image_url ? (
                                 <img
                                    src={pixel.image_url}
                                    alt={pixel.alt_text || `Pixel at ${pixel.x}, ${pixel.y}`}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                 />
                              ) : (
                                 <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400">
                                    <MapPin className="w-8 h-8 opacity-20" />
                                 </div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                           </div>

                           <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                 <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    Pixel Location ({pixel.x}, {pixel.y})
                                 </h4>
                              </div>

                              {pixel.link_url && (
                                 <a
                                    href={pixel.link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                                 >
                                    <ExternalLink className="w-3 h-3" />
                                    {pixel.link_url}
                                 </a>
                              )}

                              <div className="flex flex-wrap items-center gap-3 pt-1">
                                 <Badge variant="outline" className="text-xs font-normal">
                                    Purchased {formatRelativeDate(pixel.purchased_at)}
                                 </Badge>
                                 <Badge variant="outline" className="text-xs font-normal bg-green-50 text-green-700 border-green-200">
                                    ${pixel.price_paid}
                                 </Badge>
                              </div>
                           </div>

                           <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              <Button
                                 variant="default"
                                 size="sm"
                                 className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-blue-600 border-0 hover:shadow-md transition-all duration-300"
                                 onClick={() => onVisitPixel(pixel.link_url || '')}
                                 disabled={!pixel.link_url}
                              >
                                 <ExternalLink className="w-4 h-4 sm:mr-2" />
                                 <span className="hidden sm:inline">Visit</span>
                                 <span className="sm:hidden">Visit</span>
                              </Button>
                              <div className="flex flex-1 gap-2">
                                 <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => onSharePixel(pixel)}
                                 >
                                    <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                 </Button>
                                 {isOwnProfile && (
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       className="flex-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                       onClick={() => onEditPixel(pixel)}
                                    >
                                       <Edit className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    </Button>
                                 )}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </CardContent>
         </Card>
      </div>
   );
};
