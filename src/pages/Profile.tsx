import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSkeleton } from '@/components/ui/skeleton-primitives';
import {
  ArrowLeft, RefreshCw, Edit, AlertCircle,
  User, Sparkles, CheckCircle2, Phone, Calendar,
  Shield, Download, Trash2, Loader2, BarChart3, ArrowUpRight
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ProfileEditModal from '@/components/ProfileEditModal';
import { SharePixelDialog } from '@/components/SharePixelDialog';
import { RealtimeChannel } from '@supabase/supabase-js';
import Footer from '@/components/Footer';
import { EditPixelDialog } from '@/components/EditPixelDialog';
import SEO from '@/components/SEO';

import { ProfileDetails } from '@/components/profile/ProfileDetails';
import { MyPixels } from '@/components/profile/MyPixels';
import { ChangePasswordSection } from '@/components/profile/ChangePasswordSection';
import { TrophyCase } from '@/components/TrophyCase';
import { PixelAnalytics } from '@/components/profile/PixelAnalytics';
import { ReferralSection } from '@/components/profile/ReferralSection';
import { Profile as UserProfile, UserPixel, PixelStats, ProfileField, ProfileCompletionData } from '@/types/profile';

// Wrapper for ProfileSkeleton with page layout
const ProfilePageSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-8">
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
      <ProfileSkeleton />
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
  const [activeSettingsTab, setActiveSettingsTab] = useState('security');

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

  // Check if email is verified
  const isEmailVerified = Boolean(user?.email_confirmed_at);

  const pageSeo = (
    <SEO
      title={isOwnProfile ? 'My Profile' : 'Public Profile'}
      description={isOwnProfile ? 'Manage your BuyASpot account, pixels, and profile details.' : 'View a public BuyASpot profile and explore owned pixels.'}
      canonical="https://buyaspot.in/profile"
      image="https://buyaspot.in/og-image.png"
      imageAlt="BuyASpot profile preview"
      noindex
    />
  );

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
          // Profile not found, attempting to create one
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .upsert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || 'User')}`,
              phone_number: null,
              date_of_birth: null,
            }, { onConflict: 'user_id' })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            throw new Error('Failed to create profile. Please contact support.');
          }
          setProfile({
            ...newProfile,
            bio: newProfile.bio || null,
            website_url: newProfile.website_url || null,
            email: user.email ?? null
          });
        } else {
          // For public view, if profile not found
          throw new Error("Profile not found");
        }
      } else {
        setProfile({
          ...data,
          bio: data.bio || null,
          website_url: data.website_url || null,
          // Only show email if it's your own profile to protect privacy
          email: isOwnProfile ? (user?.email ?? null) : null
        });
        if (showToast) {
          toast.success("Profile refreshed successfully");
        }
      }
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
      link.download = `BuyASpot-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Your data has been exported successfully!");
    } catch (err: unknown) {
      console.error('Error exporting data:', err);
      toast.error("Failed to export data");
    } finally {
      setExportLoading(false);
    }
  }, [profile, userPixels, pixelStats, user?.email]);

  // Delete account — uses the delete_own_account RPC
  const handleDeleteAccount = useCallback(async () => {
    if (!isOwnProfile || !user) return;

    setDeleteLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('delete_own_account');

      if (rpcError) {
        console.error('RPC error deleting account:', rpcError);
        throw new Error(rpcError.message || 'Failed to delete account');
      }

      const result = data as { success?: boolean; error?: string } | null;
      if (result && result.success === false) {
        throw new Error(result.error || 'Failed to delete account');
      }

      // Sign out (session may already be invalid since auth.users was deleted)
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore sign-out errors — the auth record is already gone
      }

      toast.success('Your account has been deleted. We hope to see you again!', {
        duration: 5000
      });

      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);

    } catch (err: unknown) {
      console.error('Error deleting account:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete account';
      toast.error(errorMessage + '. Please try again or contact support.');
      setDeleteLoading(false);
    }
  }, [user, navigate, isOwnProfile]);

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
        }, () => {
          fetchUserPixels();
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        }, () => {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      console.error('Sign out error:', err);
      toast.error("Failed to sign out");
    }
  }, [navigate]);

  // Loading state
  if (authLoading || (profileLoading && !profile)) {
    return <>{pageSeo}<ProfilePageSkeleton /></>;
  }

  // If no public user ID and no authenticated user
  if (!user && !publicUserId) {
    return <>{pageSeo}</>;
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <Card className="w-full max-w-md border-red-200 dark:border-red-500/20 bg-white dark:bg-gray-900 shadow-2xl">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-500/20 dark:to-orange-500/20 rounded-full flex items-center justify-center border border-red-200 dark:border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2 text-red-600 dark:text-red-400">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-8 relative">
      <SEO
        title={isOwnProfile ? 'My Profile' : 'Public Profile'}
        description={isOwnProfile ? 'Manage your BuyASpot account, pixels, and profile details.' : 'View a public BuyASpot profile and explore owned pixels.'}
        canonical="https://buyaspot.in/profile"
        image="https://buyaspot.in/og-image.png"
        imageAlt="BuyASpot profile preview"
        noindex
      />

      <div className="container relative mx-auto px-4 py-4 md:py-8 max-w-6xl">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center space-x-3 md:space-x-4">
            <Link to="/" aria-label="Back to home">
              <Button
  variant="ghost"
  size="sm"
  className="group hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isOwnProfile ? 'My Account' : 'Public Profile'}
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                {isOwnProfile ? 'Manage your profile, security, and pixels' : `Viewing profile for ${profile?.full_name || 'User'}`}
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
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>

            {isOwnProfile && (
              <Button
                onClick={handleEditProfile}
                className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg transition-all duration-300 border-0 text-white"
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

        {/* Main Content — Two-Column Desktop Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar — Profile Card */}
          <div className="lg:col-span-4 xl:col-span-4">
            <ProfileDetails
              profile={profile}
              email={user?.email}
              isOwnProfile={isOwnProfile}
              isEmailVerified={isEmailVerified}
              profileCompletionData={profileCompletionData}
              pixelStats={pixelStats}
              onEditProfile={handleEditProfile}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
              deleteLoading={deleteLoading}
            />
          </div>

          {/* Right Content — Tabs for different sections */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-6">
            {/* Trophy Case */}
            <TrophyCase userId={targetUserId || ""} />

            {/* Analytics Dashboard — Only for Own Profile */}
            {isOwnProfile && targetUserId && userPixels.length > 0 && (
              <>
                <PixelAnalytics userId={targetUserId} />
                <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50">
                  <CardContent className="p-6">
                    <Link to="/dashboard/analytics">
                      <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Open Full Analytics Dashboard
                        <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </>
            )}

            {isOwnProfile && targetUserId && userPixels.length === 0 && !pixelsLoading && (
              <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-indigo-500" />
                  </div>
                  <h3 className="font-bold text-xl mb-2">Unlock Pixel Analytics</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Purchase your first pixel to unlock the Owner Analytics Dashboard. Track views, clicks, and engagement from visitors all over the world!
                  </p>
                  <Link to="/buy-pixels">
                    <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Buy Your First Pixel
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Referral Section — Temporarily Disabled */}
            {/* {isOwnProfile && (
              <ReferralSection />
            )} */}

            {/* My Pixels */}
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

            {/* Settings Section — Only for Owner */}
            {isOwnProfile && (
              <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50">
                <CardHeader className="pb-0">
                  <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800">
                      <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                        <Shield className="w-4 h-4" />
                        <span className="hidden sm:inline">Security</span>
                        <span className="sm:hidden">Security</span>
                      </TabsTrigger>
                      <TabsTrigger value="data" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Data & Privacy</span>
                        <span className="sm:hidden">Privacy</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="security" className="mt-6 pb-6">
                      <ChangePasswordSection />
                    </TabsContent>

                    <TabsContent value="data" className="mt-6 pb-6 space-y-4">
                      {/* Export Data */}
                      <Card className="border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Download className="w-4 h-4 text-purple-500" />
                                Export Your Data
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                Download a copy of your profile, pixels, and activity data as JSON.
                              </p>
                            </div>
                            <Button
                              onClick={handleExportData}
                              disabled={exportLoading}
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                            >
                              {exportLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Export
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Danger Zone */}
                      <Card className="border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/10">
                        <CardContent className="p-5">
                          <h3 className="font-semibold text-sm text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
                            <Trash2 className="w-4 h-4" />
                            Danger Zone
                          </h3>
                          <p className="text-xs text-muted-foreground mb-3">
                            Permanently delete your account and all associated data. This action cannot be undone. 
                            Your pixels will be released back to the grid.
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            We recommend exporting your data before deleting your account.
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </CardHeader>
              </Card>
            )}
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
        pixel={sharePixel ? {
          x: sharePixel.x,
          y: sharePixel.y,
          imageUrl: sharePixel.image_url,
          linkUrl: sharePixel.link_url,
          pricePaid: sharePixel.price_paid,
          pixelName: sharePixel.alt_text,
        } : null}
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
      <Footer />
    </div>
  );
};

export default Profile;
