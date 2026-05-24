import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
   Clock, CheckCircle2, AlertCircle, Sparkles,
   Award, Shield, Check, Copy, Trash2, ExternalLink,
   Edit, AlertTriangle, Loader2, Globe, LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { Profile, PixelStats, ProfileCompletionData } from '@/types/profile';
import { formatDate, formatRelativeDate } from '@/utils/dateUtils';
import { getInitials } from '@/utils/stringUtils';

interface ProfileDetailsProps {
   profile: Profile | null;
   email: string | null | undefined;
   isOwnProfile: boolean;
   isEmailVerified: boolean;
   profileCompletionData: ProfileCompletionData;
   pixelStats: PixelStats;
   onEditProfile: () => void;
   onSignOut: () => void;
   onDeleteAccount: () => Promise<void>;
   deleteLoading: boolean;
}

export const ProfileDetails = ({
   profile,
   email,
   isOwnProfile,
   isEmailVerified,
   profileCompletionData,
   pixelStats,
   onEditProfile,
   onSignOut,
   onDeleteAccount,
   deleteLoading
}: ProfileDetailsProps) => {
   const [copied, setCopied] = useState(false);
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [deleteConfirmText, setDeleteConfirmText] = useState('');

   const handleCopyUserId = () => {
      if (!profile?.user_id) return;

      navigator.clipboard.writeText(profile.user_id).then(() => {
         setCopied(true);
         toast.success("User ID copied to clipboard");
         setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
         toast.error("Failed to copy User ID");
      });
   };

   const handleDeleteConfirm = async () => {
      if (deleteConfirmText.toLowerCase() !== 'delete my account') {
         toast.error('Please type "delete my account" to confirm');
         return;
      }

      // Call parent handler
      await onDeleteAccount();

      // Reset state on success (or let parent handle unmount/navigation)
      setDeleteDialogOpen(false);
      setDeleteConfirmText('');
   };

   return (
      <Card className="shadow-xl sticky top-4 bg-white dark:bg-gray-900 border-purple-100 dark:border-purple-500/20 h-fit overflow-hidden">
         {/* Decorative header gradient */}
         <div className="h-24 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
         </div>

         <CardHeader className="text-center pb-4 -mt-16 relative z-10">
            <div className="flex justify-center mb-3">
               <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-300"></div>
                  <Avatar className="relative w-28 h-28 lg:w-32 lg:h-32 border-4 border-white dark:border-gray-900 shadow-xl ring-2 ring-purple-500/20">
                     <AvatarImage
                        src={profile?.avatar_url || undefined}
                        alt={`${profile?.full_name || 'User'}'s profile picture`}
                     />
                     <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-purple-600 via-pink-500 to-blue-600 text-white">
                        {getInitials(profile?.full_name)}
                     </AvatarFallback>
                  </Avatar>
                  {isOwnProfile && (
                     <button
                        onClick={onEditProfile}
                        className="absolute bottom-1 right-1 w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform"
                        aria-label="Edit profile picture"
                     >
                        <Edit className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                     </button>
                  )}
               </div>
            </div>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
               {profile?.full_name || 'Anonymous User'}
            </CardTitle>
            {isOwnProfile && (
               <p className="text-sm text-muted-foreground break-all">{email}</p>
            )}

            {/* Bio */}
            {profile?.bio && (
               <p className="text-sm text-muted-foreground mt-2 italic leading-relaxed">
                  "{profile.bio}"
               </p>
            )}

            {/* Website */}
            {profile?.website_url && (
               <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400 hover:underline mt-1"
               >
                  <Globe className="w-3.5 h-3.5" />
                  {profile.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
               </a>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
               <Badge variant="secondary" className="flex items-center gap-1 bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 backdrop-blur-sm" title={`Joined ${formatDate(profile?.created_at || '')}`}>
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {formatRelativeDate(profile?.created_at || '')}
               </Badge>
               {isEmailVerified ? (
                  <Badge variant="default" className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                     <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                     Verified
                  </Badge>
               ) : (
                  <Badge variant="secondary" className="flex items-center gap-1 bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300">
                     <AlertCircle className="w-3 h-3" aria-hidden="true" />
                     Unverified
                  </Badge>
               )}
            </div>
         </CardHeader>

         <CardContent className="space-y-4">
            {/* Profile Completion Card - Only for Owner */}
            {isOwnProfile && profileCompletionData.percentage < 100 && (
               <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-xl p-4 border border-orange-200 dark:border-orange-500/20">
                  <div className="flex items-center justify-between mb-3">
                     <div>
                        <h3 className="font-semibold text-sm text-orange-800 dark:text-orange-200 flex items-center gap-1.5">
                           <Sparkles className="w-4 h-4 text-orange-500" />
                           Profile Completion
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                           Complete to unlock all features
                        </p>
                     </div>
                     <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {profileCompletionData.percentage}%
                     </p>
                  </div>

                  <Progress
                     value={profileCompletionData.percentage}
                     className="h-2 mb-3"
                  />

                  {/* Compact Field Status */}
                  <div className="space-y-1.5">
                     {profileCompletionData.allFields.map((field) => (
                        <div
                           key={field.name}
                           className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs transition-all ${field.completed
                              ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300'
                              : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'
                           }`}
                        >
                           <div className="flex items-center gap-2">
                              {field.icon}
                              <span className="font-medium">{field.label}</span>
                           </div>
                           {field.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                           ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                           )}
                        </div>
                     ))}
                  </div>

                  {profileCompletionData.missingFields.length > 0 && (
                     <Button
                        onClick={onEditProfile}
                        size="sm"
                        className="w-full mt-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all duration-300 border-0"
                     >
                        <Edit className="w-3 h-3 mr-2" />
                        Complete Profile
                     </Button>
                  )}
               </div>
            )}

            {/* Profile Completion — 100% Done */}
            {isOwnProfile && profileCompletionData.percentage === 100 && (
               <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-3 border border-green-200 dark:border-green-500/20 text-center">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center justify-center gap-1.5">
                     <CheckCircle2 className="w-4 h-4" />
                     Profile Complete! 🎉
                  </p>
               </div>
            )}

            {/* Account Status */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
               <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Award className="w-4 h-4 text-purple-500" />
                  Account Stats
               </h3>
               <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">Status</span>
                     <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-0 font-medium">
                        {isOwnProfile ? 'Active Member' : 'Community Member'}
                     </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">Pixels Owned</span>
                     <span className="font-bold text-purple-600 dark:text-purple-400">{pixelStats.totalPixels}</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">Total Invested</span>
                     <span className="font-bold text-green-600 dark:text-green-400">₹{pixelStats.totalInvestment.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">Member Since</span>
                     <span className="font-medium text-xs">{formatDate(profile?.created_at || '')}</span>
                  </div>
               </div>
            </div>

            {/* User ID Card */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
               <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Shield className="w-4 h-4 text-purple-500" />
                  User ID
               </h3>
               <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">
                     {profile?.user_id}
                  </code>
                  <Button
                     size="sm"
                     variant="ghost"
                     onClick={handleCopyUserId}
                     className="flex-shrink-0 hover:bg-purple-500/10"
                     aria-label="Copy User ID"
                  >
                     {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                     ) : (
                        <Copy className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                     )}
                  </Button>
               </div>
            </div>

            {/* Account Actions - Only for Owner */}
            {isOwnProfile && (
               <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700/50">
                  <Button
                     variant="ghost"
                     className="w-full justify-start text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                     onClick={onSignOut}
                  >
                     <LogOut className="w-4 h-4 mr-2" />
                     Sign Out
                  </Button>
                  <Button
                     variant="ghost"
                     className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                     onClick={() => setDeleteDialogOpen(true)}
                  >
                     <Trash2 className="w-4 h-4 mr-2" />
                     Delete Account
                  </Button>
               </div>
            )}

         </CardContent>

         {/* Delete Account Confirmation */}
         <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent className="bg-white dark:bg-gray-900 border-red-200 dark:border-red-500/20">
               <AlertDialogHeader>
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-2 mx-auto">
                     <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <AlertDialogTitle className="text-center text-xl text-red-600 dark:text-red-400">Delete Account & Data?</AlertDialogTitle>
                  <AlertDialogDescription className="text-center space-y-2">
                     <p>This action cannot be undone. This will permanently delete your account and release your <strong>{pixelStats.totalPixels} pixels</strong> back to the grid.</p>
                     <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-200 mt-4 text-left">
                        Type <strong>delete my account</strong> to confirm.
                     </div>
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <div className="py-2">
                  <Input
                     value={deleteConfirmText}
                     onChange={(e) => setDeleteConfirmText(e.target.value)}
                     placeholder="delete my account"
                     className="text-center border-red-200 focus-visible:ring-red-500"
                  />
               </div>
               <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteLoading} className="border-0 hover:bg-gray-100">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                     onClick={handleDeleteConfirm}
                     disabled={deleteLoading || deleteConfirmText.toLowerCase() !== 'delete my account'}
                     className="bg-red-600 hover:bg-red-700 text-white border-0"
                  >
                     {deleteLoading ? (
                        <>
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                           Deleting...
                        </>
                     ) : (
                        'Delete Account'
                     )}
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

      </Card>
   );
};
