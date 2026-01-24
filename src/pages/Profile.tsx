import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, RefreshCw, Edit, AlertCircle,
  User, Sparkles, CheckCircle2, Phone, Calendar
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ProfileEditModal from '@/components/ProfileEditModal';
import { SharePixelDialog } from '@/components/SharePixelDialog';
import { RealtimeChannel } from '@supabase/supabase-js';
import { EditPixelDialog } from '@/components/EditPixelDialog';

import { ProfileDetails } from '@/components/profile/ProfileDetails';
import { MyPixels } from '@/components/profile/MyPixels';
import { TrophyCase } from '@/components/TrophyCase';
import { Profile as UserProfile, UserPixel, PixelStats, ProfileField, ProfileCompletionData } from '@/types/profile';

// Loading skeleton component
const ProfileSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-8">
    <div className="container mx-auto px-4 py-4 md:py-8">
      <div className="flex items-center space-x-4 mb-8">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Card className="w-full max-w-4xl mx-auto backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border-purple-500/20">
        <CardHeader className="text-center">
          <Skeleton className="w-32 h-32 rounded-full mx-auto mb-4" />
          <Skeleton className="h-8 w-48 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  </div>
);

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userPixels, setUserPixels] = useState<UserPixel[]>([]);
  const [pixelsLoading, setPixelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // States for delete account
  const [deleteLoading, setDeleteLoading] = useState(false);

  // States for other dialogs
  const [exportLoading, setExportLoading] = useState(false);
  const [editingPixel, setEditingPixel] = useState<UserPixel | null>(null);
  const [sharePixel, setSharePixel] = useState<UserPixel | null>(null);

  // Determine viewing mode
  const publicUserId = searchParams.get('id');
  const targetUserId = publicUserId || user?.id;
  const isOwnProfile = !publicUserId || (user && user.id === publicUserId);

  // Calculate profile completion with detailed breakdown
  const profileCompletionData = useMemo<ProfileCompletionData>(() => {
    if (!profile) {
      return {
        percentage: 0,
        completedFields: [],
        missingFields: [],
        allFields: []
      };
    }

    const fields: ProfileField[] = [
      {
        name: 'full_name',
        label: 'Full Name',
        completed: Boolean(profile.full_name && profile.full_name.trim().length >= 2),
        value: profile.full_name,
        icon: <User className="w-4 h-4" />
      },
      {
        name: 'phone_number',
        label: 'Phone Number',
        completed: Boolean(profile.phone_number),
        value: profile.phone_number,
        icon: <Phone className="w-4 h-4" />
      },
      {
        name: 'date_of_birth',
        label: 'Date of Birth',
        completed: Boolean(profile.date_of_birth),
        value: profile.date_of_birth,
        icon: <Calendar className="w-4 h-4" />
      },
      {
        name: 'avatar_url',
        label: 'Profile Picture',
        completed: Boolean(profile.avatar_url && !profile.avatar_url.includes('dicebear.com')),
        value: profile.avatar_url,
        icon: <User className="w-4 h-4" />
      }
    ];

    const completedFields = fields.filter(f => f.completed);
    const missingFields = fields.filter(f => !f.completed);
    const percentage = Math.round((completedFields.length / fields.length) * 100);

    return {
      percentage,
      completedFields,
      missingFields,
      allFields: fields
    };
  }, [profile]);

  // Memoized pixel statistics - prefer database values over calculated
  const pixelStats = useMemo<PixelStats>(() => {
    // Use database values if available (more accurate, includes transactions)
    const totalPixels = profile?.pixel_count ?? userPixels.length;
    const totalInvestment = profile?.total_spent ?? userPixels.reduce((sum, p) => sum + (p.price_paid || 0), 0);
    const averagePrice = totalPixels > 0 ? totalInvestment / totalPixels : 0;

    return { totalPixels, totalInvestment, averagePrice };
  }, [profile?.pixel_count, profile?.total_spent, userPixels]);

  // Fetch profile data
  const fetchProfile = useCallback(async (showToast = false) => {
    if (!targetUserId) return;

    setProfileLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        if (isOwnProfile && user) {
          console.warn('Profile not found, attempting to create one');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || 'User')}`,
              phone_number: null,
              date_of_birth: null,
              // New fields will use database defaults (pixel_count=0, total_spent=0)
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            throw new Error('Failed to create profile. Please contact support.');
          }
          setProfile({
            ...newProfile,
            email: user.email ?? null // Ensure email matches auth for own profile
          });
        } else {
          // For public view, if profile not found
          throw new Error("Profile not found");
        }
      } else {
        setProfile({
          ...data,
          // Only show email if it's your own profile to protect privacy
          email: isOwnProfile ? (user?.email ?? null) : null
        });
        if (showToast) {
          toast.success("Profile refreshed successfully");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      console.error('Error fetching profile:', err);
      setError(errorMessage);
      toast.error("Failed to load profile data");
    } finally {
      setProfileLoading(false);
    }
  }, [targetUserId, isOwnProfile, user]);

  // Fetch user pixels
  const fetchUserPixels = useCallback(async (showToast = false) => {
    if (!targetUserId) return;

    setPixelsLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from('pixels')
        .select('*')
        .eq('owner_id', targetUserId)
        .order('purchased_at', { ascending: false });

      if (fetchError) throw fetchError;

      const pixels: UserPixel[] = (data || []).map((row) => ({
        id: row.id as string,
        x: row.x as number,
        y: row.y as number,
        image_url: row.image_url || undefined,
        link_url: row.link_url || undefined,
        alt_text: row.alt_text || undefined,
        price_paid: row.price_paid || 0,
        purchased_at: row.purchased_at || new Date().toISOString(),
        // Include new fields from database
        block_id: row.block_id || undefined,
        times_resold: row.times_resold || undefined,
        last_sale_price: row.last_sale_price || undefined,
        last_sale_date: row.last_sale_date || undefined
      }));

      setUserPixels(pixels);
      if (showToast && pixels.length > 0) {
        toast.success(`Loaded ${pixels.length} pixel${pixels.length !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('Error fetching user pixels:', err);
      toast.error("Failed to load pixels");
    } finally {
      setPixelsLoading(false);
    }
  }, [targetUserId]);

  // Export user data as JSON
  const handleExportData = useCallback(async () => {
    setExportLoading(true);

    try {
      const exportData = {
        profile: profile,
        pixels: userPixels,
        stats: pixelStats,
        exportDate: new Date().toISOString(),
        exportedBy: user?.email
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `buyapixel-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Your data has been exported successfully!");
    } catch (err) {
      console.error('Error exporting data:', err);
      toast.error("Failed to export data");
    } finally {
      setExportLoading(false);
    }
  }, [profile, userPixels, pixelStats, user?.email]);

  // Delete account
  const handleDeleteAccount = useCallback(async () => {
    // Note: Confirmation is handled by ProfileDetails component.
    // This function runs only after user confirms.
    if (!isOwnProfile || !user) return;

    setDeleteLoading(true);

    try {
      console.log('🗑️ Starting account deletion process...');

      if (userPixels.length > 0) {
        const { error: pixelsError } = await supabase
          .from('pixels')
          .delete()
          .eq('owner_id', user.id);

        if (pixelsError) {
          console.error('Error deleting pixels:', pixelsError);
          toast.error('Failed to delete your pixels. Please contact support.');
          setDeleteLoading(false);
          return;
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      }

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error('Error signing out:', signOutError);
      }

      toast.success('Your account has been deleted. We hope to see you again!', {
        duration: 5000
      });

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);

    } catch (err) {
      console.error('Error deleting account:', err);
      toast.error('Failed to delete account. Please try again or contact support.');
      setDeleteLoading(false); // Only set to false on error, otherwise we are navigating away
    }
  }, [userPixels, user, navigate, isOwnProfile]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchProfile(true),
      fetchUserPixels(true)
    ]);
    setIsRefreshing(false);
  }, [fetchProfile, fetchUserPixels]);

  // Initial data fetch
  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
      fetchUserPixels();
    }
  }, [targetUserId, fetchProfile, fetchUserPixels]);

  // Redirect to signin if not authenticated and not viewing a public profile
  useEffect(() => {
    if (!authLoading && !user && !publicUserId) {
      toast.error("Please sign in to view your profile");
      navigate('/signin', { state: { from: '/profile' } });
    }
  }, [authLoading, user, navigate, publicUserId]);

  // Real-time subscription (only for own profile)
  useEffect(() => {
    if (!user?.id || !isOwnProfile) return;

    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel(`user-profile-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pixels',
          filter: `owner_id=eq.${user.id}`
        }, (payload) => {
          console.log('Pixel change detected:', payload);
          fetchUserPixels();
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('Profile change detected:', payload);
          fetchProfile();
        })
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, fetchUserPixels, fetchProfile, isOwnProfile]);

  const handleEditProfile = useCallback(() => {
    if (isOwnProfile) setEditModalOpen(true);
  }, [isOwnProfile]);

  const handleCloseModal = useCallback(() => {
    setEditModalOpen(false);
  }, []);

  const handlePixelVisit = useCallback((url: string) => {
    if (!url) return;
    try {
      const validUrl = url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `https://${url}`;
      window.open(validUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Invalid URL:', err);
      toast.error("Invalid URL format");
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast.success("Signed out successfully");
      navigate('/');
    } catch (err) {
      console.error('Sign out error:', err);
      toast.error("Failed to sign out");
    }
  }, [navigate]);

  // Loading state
  if (authLoading || (profileLoading && !profile)) {
    return <ProfileSkeleton />;
  }

  // If no public user ID and no authenticated user
  if (!user && !publicUserId) {
    return null;
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <Card className="w-full max-w-md border-red-500/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 shadow-2xl">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                {publicUserId ? 'Profile Not Found' : 'Error Loading Profile'}
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => fetchProfile()} variant="outline" className="backdrop-blur-sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button onClick={() => navigate('/')} variant="ghost">
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-8 relative">
      {/* Premium gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />

      <div className="container relative mx-auto px-4 py-4 md:py-8 max-w-6xl">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center space-x-3 md:space-x-4">
            <Link to="/" aria-label="Back to home">
              <Button variant="ghost" size="sm" className="group backdrop-blur-sm hover:bg-white/60 dark:hover:bg-gray-800/60">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                {isOwnProfile ? 'Account Overview' : 'Public Profile'}
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                {isOwnProfile ? 'Manage your account and pixels ✨' : `Viewing profile for ${profile?.full_name || 'User'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              aria-label="Refresh data"
              className="backdrop-blur-sm bg-white/60 dark:bg-gray-800/60 border-purple-500/20 hover:bg-white/80 dark:hover:bg-gray-800/80 hover:border-purple-500/30 transition-all duration-300"
            >
              <RefreshCw className={`w-4 h-4 text-purple-600 dark:text-purple-400 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>

            {isOwnProfile && (
              <Button
                onClick={handleEditProfile}
                className="gap-2 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 border-0 text-white"
                size="sm"
                aria-label="Edit profile"
              >
                <Edit className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Edit Profile</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            )}
          </div>
        </header>

        {/* Profile Completion Alert - Only for Owner */}
        {isOwnProfile && profileCompletionData.percentage < 100 && (
          <div className="mb-6 rounded-xl p-4 border border-orange-500/20 bg-gradient-to-r from-orange-50/80 to-pink-50/80 dark:from-orange-950/30 dark:to-pink-950/30 backdrop-blur-xl shadow-lg flex items-center gap-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full shrink-0">
              <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                Complete your profile
                {profileCompletionData.percentage > 0 && (
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-orange-200/50 dark:bg-orange-800/50 text-orange-800 dark:text-orange-200">
                    {profileCompletionData.percentage}% Done
                  </span>
                )}
              </h3>
              <p className="text-sm text-orange-800/80 dark:text-orange-200/80 mt-0.5">
                Unlock all features by filling in
                <span className="font-semibold mx-1">{profileCompletionData.missingFields.length}</span>
                remaining field{profileCompletionData.missingFields.length !== 1 ? 's' : ''}.
              </p>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={handleEditProfile}
              className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white border-0 shadow-md shrink-0"
            >
              Complete Now
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ProfileDetails
              profile={profile}
              email={user?.email} // Passed user.email instead of profile.email to rely on Auth
              isOwnProfile={isOwnProfile}
              profileCompletionData={profileCompletionData}
              pixelStats={pixelStats}
              onEditProfile={handleEditProfile}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
              deleteLoading={deleteLoading}
            />
          </div>

          <div className="lg:col-span-2">
            <TrophyCase userId={targetUserId || ""} />
          </div>

          <div className="lg:col-span-3">
            <MyPixels
              userPixels={userPixels}
              pixelStats={pixelStats}
              loading={pixelsLoading}
              isOwnProfile={isOwnProfile}
              exportLoading={exportLoading}
              onExportData={handleExportData}
              onVisitPixel={handlePixelVisit}
              onSharePixel={setSharePixel}
              onEditPixel={setEditingPixel}
            />
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <ProfileEditModal
        isOpen={editModalOpen}
        onClose={handleCloseModal}
        profile={profile}
        onProfileUpdate={() => {
          fetchProfile(true);
          handleCloseModal();
        }}
      />

      {/* Share Pixel Dialog */}
      <SharePixelDialog
        isOpen={!!sharePixel}
        onClose={() => setSharePixel(null)}
        pixel={sharePixel ? { x: sharePixel.x, y: sharePixel.y } : null}
      />

      {/* Edit Pixel Dialog */}
      {editingPixel && (
        <EditPixelDialog
          isOpen={!!editingPixel}
          onClose={() => setEditingPixel(null)}
          pixel={editingPixel}
          onUpdate={() => {
            fetchUserPixels(true);
            setEditingPixel(null);
          }}
        />
      )}
    </div>
  );
};

export default Profile;
