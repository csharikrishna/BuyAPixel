/**
 * Skeleton Primitives
 * Reusable, mobile-responsive skeleton components for consistent loading states
 */

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Card skeleton for profile/listing cards - Mobile responsive
 */
export const CardSkeleton = ({ className = "" }: { className?: string }) => (
   <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="pb-4 space-y-2">
         <Skeleton className="h-6 w-3/4" />
         <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-4">
         <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-xl mx-auto" />
         <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
         </div>
         <Skeleton className="h-10 w-full" />
      </CardContent>
   </Card>
);

/**
 * List item skeleton for pixel lists - Mobile responsive with stacked layout
 */
export const ListItemSkeleton = ({ className = "" }: { className?: string }) => (
   <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${className}`}>
      <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2 w-full">
         <Skeleton className="h-5 w-1/2 sm:w-1/3" />
         <Skeleton className="h-4 w-3/4 sm:w-1/2" />
         <div className="flex gap-2">
            <Skeleton className="h-6 w-16 sm:w-20" />
            <Skeleton className="h-6 w-14 sm:w-16" />
         </div>
      </div>
      <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
         <Skeleton className="h-9 flex-1 sm:flex-none sm:w-20" />
         <Skeleton className="h-9 flex-1 sm:flex-none sm:w-20" />
      </div>
   </div>
);

/**
 * Stats skeleton for stat displays - Mobile responsive grid
 */
export const StatsSkeleton = ({ className = "", columns = 4 }: { className?: string; columns?: number }) => (
   <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-3 sm:gap-4 ${className}`}>
      {Array(columns).fill(0).map((_, i) => (
         <div key={i} className="p-3 sm:p-4 rounded-lg border space-y-2">
            <Skeleton className="h-3 sm:h-4 w-2/3" />
            <Skeleton className="h-6 sm:h-8 w-1/2" />
         </div>
      ))}
   </div>
);

/**
 * Avatar skeleton - Multiple sizes
 */
export const AvatarSkeleton = ({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) => {
   const sizes = {
      sm: "w-8 h-8",
      md: "w-10 h-10 sm:w-12 sm:h-12",
      lg: "w-16 h-16 sm:w-24 sm:h-24",
      xl: "w-24 h-24 sm:w-32 sm:h-32"
   };
   return <Skeleton className={`${sizes[size]} rounded-full`} />;
};

/**
 * Profile skeleton - Full profile page loading state
 */
export const ProfileSkeleton = ({ className = "" }: { className?: string }) => (
   <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 sm:p-6">
         <AvatarSkeleton size="xl" />
         <div className="space-y-2 text-center sm:text-left flex-1">
            <Skeleton className="h-6 sm:h-8 w-40 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-48 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-32 mx-auto sm:mx-0" />
         </div>
      </div>
      {/* Stats Grid */}
      <StatsSkeleton columns={4} />
      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <CardSkeleton />
         <CardSkeleton />
      </div>
   </div>
);

/**
 * Table row skeleton
 */
export const TableRowSkeleton = ({ columns = 4 }: { columns?: number }) => (
   <div className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 border-b">
      {Array(columns).fill(0).map((_, i) => (
         <Skeleton key={i} className="h-4 flex-1" />
      ))}
   </div>
);

/**
 * Leaderboard row skeleton - For ranking lists
 */
export const LeaderboardRowSkeleton = ({ className = "" }: { className?: string }) => (
   <div className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl border ${className}`}>
      <Skeleton className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0" />
      <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1 min-w-0">
         <Skeleton className="h-4 w-24 sm:w-32" />
         <Skeleton className="h-3 w-16 sm:w-24" />
      </div>
      <Skeleton className="h-5 sm:h-6 w-12 sm:w-16 flex-shrink-0" />
   </div>
);

/**
 * Blog card skeleton
 */
export const BlogCardSkeleton = ({ className = "" }: { className?: string }) => (
   <Card className={`overflow-hidden ${className}`}>
      <Skeleton className="h-40 sm:h-48 w-full" />
      <CardContent className="p-4 space-y-3">
         <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
         </div>
         <Skeleton className="h-5 sm:h-6 w-3/4" />
         <Skeleton className="h-4 w-full" />
         <Skeleton className="h-4 w-2/3" />
      </CardContent>
   </Card>
);

/**
 * Pixel grid item skeleton - For MyPixels list
 */
export const PixelItemSkeleton = ({ className = "" }: { className?: string }) => (
   <div className={`flex items-center gap-3 p-3 rounded-xl border bg-card ${className}`}>
      <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
         <Skeleton className="h-4 sm:h-5 w-20" />
         <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-16" />
         </div>
      </div>
      <div className="flex flex-col gap-1.5">
         <Skeleton className="h-8 w-8 rounded-lg" />
         <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
   </div>
);

/**
 * Marketplace listing skeleton
 */
export const MarketplaceListingSkeleton = ({ className = "" }: { className?: string }) => (
   <Card className={`overflow-hidden border-2 ${className}`}>
      <CardHeader className="pb-3 space-y-2">
         <div className="flex justify-between items-start">
            <Skeleton className="h-5 sm:h-6 w-24" />
            <Skeleton className="h-5 w-12" />
         </div>
         <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-4">
         <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl mx-auto" />
         <div className="text-center">
            <Skeleton className="h-4 w-24 mx-auto" />
         </div>
         <div className="space-y-2 bg-muted/30 rounded-lg p-3 sm:p-4">
            <div className="flex justify-between">
               <Skeleton className="h-4 w-12" />
               <Skeleton className="h-5 sm:h-6 w-16" />
            </div>
         </div>
         <Skeleton className="h-10 sm:h-11 w-full rounded-md" />
      </CardContent>
   </Card>
);
