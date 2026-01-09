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
   Edit, AlertTriangle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Profile, PixelStats, ProfileCompletionData } from '@/types/profile';
import { formatDate, formatRelativeDate } from '@/utils/dateUtils';
import { getInitials } from '@/utils/stringUtils';

interface ProfileDetailsProps {
   profile: Profile | null;
   email: string | null | undefined;
   isOwnProfile: boolean;
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
      <div className="lg:col-span-1">
         <Card className="shadow-2xl sticky top-4 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-purple-500/10">
            <CardHeader className="text-center pb-4">
               <div className="flex justify-center mb-4">
                  <div className="relative group">
                     <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 rounded-full blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                     <Avatar className="relative w-32 h-32 border-4 border-white dark:border-gray-900 shadow-xl ring-2 ring-purple-500/20">
                        <AvatarImage
                           src={profile?.avatar_url || undefined}
                           alt={`${profile?.full_name || 'User'}'s profile picture`}
                        />
                        <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-purple-600 via-pink-500 to-blue-600 text-white">
                           {getInitials(profile?.full_name)}
                        </AvatarFallback>
                     </Avatar>
                  </div>
               </div>
               <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {profile?.full_name || 'Anonymous User'}
               </CardTitle>
               {isOwnProfile && (
                  <p className="text-sm text-muted-foreground break-all">{email}</p>
               )}

               <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <Badge variant="secondary" className="flex items-center gap-1 bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 backdrop-blur-sm" title={`Joined ${formatDate(profile?.created_at || '')}`}>
                     <Clock className="w-3 h-3" aria-hidden="true" />
                     {formatRelativeDate(profile?.created_at || '')}
                  </Badge>
                  <Badge variant="default" className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                     <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                     Verified
                  </Badge>
               </div>
            </CardHeader>

            <CardContent className="space-y-4">
               {/* Profile Completion Card - Only for Owner */}
               {isOwnProfile && (
                  <div className="bg-gradient-to-br from-orange-50/80 to-pink-50/80 dark:from-orange-950/30 dark:to-pink-950/30 rounded-xl p-4 border-2 border-orange-500/20 backdrop-blur-sm shadow-lg">
                     <div className="flex items-center justify-between mb-3">
                        <div>
                           <h3 className="font-semibold text-sm bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-1">
                              <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                              Profile Completion
                           </h3>
                           <p className="text-xs text-muted-foreground mt-0.5">
                              {profileCompletionData.percentage === 100
                                 ? '🎉 Complete!'
                                 : 'Complete to unlock all features'
                              }
                           </p>
                        </div>
                        <div className="text-right">
                           <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
                              {profileCompletionData.percentage}%
                           </p>
                        </div>
                     </div>

                     <Progress
                        value={profileCompletionData.percentage}
                        className="h-3 mb-4"
                     />

                     {/* Field Breakdown */}
                     <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                           Field Status
                        </p>
                        {profileCompletionData.allFields.map((field) => (
                           <div
                              key={field.name}
                              className={`flex items-center justify-between p-2 rounded-lg transition-all duration-300 backdrop-blur-sm ${field.completed
                                 ? 'bg-green-50/80 dark:bg-green-950/30 border border-green-500/30 shadow-sm'
                                 : 'bg-yellow-50/80 dark:bg-yellow-950/30 border border-yellow-500/30 shadow-sm'
                                 }`}
                           >
                              <div className="flex items-center gap-2">
                                 <div className={field.completed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                                    {field.icon}
                                 </div>
                                 <span className={`text-sm font-medium ${field.completed ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'
                                    }`}>
                                    {field.label}
                                 </span>
                              </div>
                              {field.completed ? (
                                 <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                              ) : (
                                 <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              )}
                           </div>
                        ))}
                     </div>

                     {/* Missing Fields Alert */}
                     {profileCompletionData.missingFields.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-orange-500/20">
                           <p className="text-xs font-medium text-orange-800 dark:text-orange-200 mb-2">
                              ⚠️ Missing Information:
                           </p>
                           <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 ml-4">
                              {profileCompletionData.missingFields.map((field) => (
                                 <li key={field.name} className="list-disc">
                                    Add your {field.label.toLowerCase()}
                                 </li>
                              ))}
                           </ul>
                           <Button
                              onClick={onEditProfile}
                              size="sm"
                              className="w-full mt-3 bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                           >
                              <Edit className="w-3 h-3 mr-2" />
                              Complete Profile Now
                           </Button>
                        </div>
                     )}
                  </div>
               )}


               {/* Account Status */}
               <div className="bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl p-4 border border-purple-500/20 backdrop-blur-sm shadow-lg">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                     <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                     Account Status
                  </h3>
                  <div className="space-y-2 text-sm">
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Type</span>
                        <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
                           {isOwnProfile ? 'Active Member' : 'Community Member'}
                        </Badge>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Pixels Owned</span>
                        <span className="font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{pixelStats.totalPixels}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Member Since</span>
                        <span className="font-semibold text-xs">{formatRelativeDate(profile?.created_at || '')}</span>
                     </div>
                  </div>
               </div>

               {/* User ID Card */}
               <div className="bg-gradient-to-br from-gray-50/50 to-slate-50/50 dark:from-gray-950/20 dark:to-slate-950/20 rounded-xl p-4 border border-gray-500/20 backdrop-blur-sm shadow-lg">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                     <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                     User ID
                  </h3>
                  <div className="flex items-center gap-2">
                     <code className="flex-1 text-xs bg-white/60 dark:bg-gray-900/60 p-2 rounded-lg border border-purple-500/20 font-mono truncate backdrop-blur-sm">
                        {profile?.user_id}
                     </code>
                     <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyUserId}
                        className="flex-shrink-0 hover:bg-purple-500/10"
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
                  <div className="space-y-2 pt-2">
                     <Button
                        variant="outline"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 border-red-200"
                        onClick={() => setDeleteDialogOpen(true)}
                     >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                     </Button>
                     <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={onSignOut}
                     >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Sign Out
                     </Button>
                  </div>
               )}

            </CardContent>

            {/* Delete Account Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
               <AlertDialogContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-red-500/20">
                  <AlertDialogHeader>
                     <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-2 mx-auto">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                     </div>
                     <AlertDialogTitle className="text-center text-xl text-red-600 dark:text-red-400">Delete Account & Data?</AlertDialogTitle>
                     <AlertDialogDescription className="text-center space-y-2">
                        <p>This action cannot be undone. This will permanently delete your account and remove your <strong>{pixelStats.totalPixels} pixels</strong> from the board.</p>
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
      </div>
   );
};
