import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Edit, ArrowLeft, Mail, Phone, Calendar, 
  User, MapPin, Eye, TrendingUp, ExternalLink,
  Award, Clock, CheckCircle2, AlertCircle, Info,
  RefreshCw, Loader2, Download, Trash2, Shield,
  AlertTriangle, Copy, Check
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ProfileEditModal from '@/components/ProfileEditModal';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Input } from '@/components/ui/input';

// Type definitions
interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

interface UserPixel {
  x: number;
  y: number;
  id: string;
  image_url?: string;
  link_url?: string;
  alt_text?: string;
  price_paid: number;
  purchased_at: string;
}

interface PixelStats {
  totalPixels: number;
  totalInvestment: number;
  averagePrice: number;
}

interface ProfileField {
  name: string;
  label: string;
  completed: boolean;
  value: string | null;
  icon: React.ReactNode;
}

interface ProfileCompletionData {
  percentage: number;
  completedFields: ProfileField[];
  missingFields: ProfileField[];
  allFields: ProfileField[];
}

// Loading skeleton component
const ProfileSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20 lg:pb-8">
    <div className="container mx-auto px-4 py-4 md:py-8">
      <div className="flex items-center space-x-4 mb-8">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Card className="w-full max-w-4xl mx-auto">
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userPixels, setUserPixels] = useState<UserPixel[]>([]);
  const [pixelsLoading, setPixelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Memoized pixel statistics
  const pixelStats = useMemo<PixelStats>(() => {
    const totalPixels = userPixels.length;
    const totalInvestment = userPixels.reduce((sum, p) => sum + (p.price_paid || 0), 0);
    const averagePrice = totalPixels > 0 ? totalInvestment / totalPixels : 0;
    
    return { totalPixels, totalInvestment, averagePrice };
  }, [userPixels]);

  // Fetch profile data
  const fetchProfile = useCallback(async (showToast = false) => {
    if (!user?.id) return;
    
    setProfileLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      if (!data) {
        console.warn('Profile not found, attempting to create one');
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email || null,
            avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || 'User')}`,
            phone_number: null,
            date_of_birth: null,
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating profile:', createError);
          throw new Error('Failed to create profile. Please try again or contact support.');
        }
        
        setProfile({
          ...newProfile,
          email: user.email ?? null
        });
        if (showToast) {
          toast.success("Profile created successfully");
        }
      } else {
        setProfile({
          ...data,
          email: user.email ?? null
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
  }, [user?.id, user?.email, user?.user_metadata]);

  // Fetch user pixels
  const fetchUserPixels = useCallback(async (showToast = false) => {
    if (!user?.id) return;
    
    setPixelsLoading(true);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('pixels')
        .select('*')
        .eq('owner_id', user.id)
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
        purchased_at: row.purchased_at || new Date().toISOString()
      }));
      
      setUserPixels(pixels);
      if (showToast && pixels.length > 0) {
        toast.success(`Loaded ${pixels.length} pixel${pixels.length !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('Error fetching user pixels:', err);
      toast.error("Failed to load your pixels");
    } finally {
      setPixelsLoading(false);
    }
  }, [user?.id]);

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

  // Copy user ID to clipboard
  const handleCopyUserId = useCallback(() => {
    if (!user?.id) return;
    
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      toast.success("User ID copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy User ID");
    });
  }, [user?.id]);

  // Delete account
  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete my account') {
      toast.error('Please type "delete my account" to confirm');
      return;
    }

    setDeleteLoading(true);

    try {
      console.log('🗑️ Starting account deletion process...');

      // Delete user pixels first (if any)
      if (userPixels.length > 0) {
        const { error: pixelsError } = await supabase
          .from('pixels')
          .delete()
          .eq('owner_id', user!.id);

        if (pixelsError) {
          console.error('Error deleting pixels:', pixelsError);
          toast.error('Failed to delete your pixels. Please contact support.');
          setDeleteLoading(false);
          return;
        }
      }

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user!.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      }

      // Sign out the user
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error('Error signing out:', signOutError);
      }

      toast.success('Your account has been deleted. We hope to see you again!', {
        duration: 5000
      });

      // Redirect to home after a short delay
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);

    } catch (err) {
      console.error('Error deleting account:', err);
      toast.error('Failed to delete account. Please try again or contact support.');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setDeleteConfirmText('');
    }
  }, [deleteConfirmText, userPixels, user, navigate]);

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
    if (user?.id) {
      fetchProfile();
      fetchUserPixels();
    }
  }, [user?.id, fetchProfile, fetchUserPixels]);

  // Redirect to signin if not authenticated after loading
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Please sign in to view your profile");
      navigate('/signin', { state: { from: '/profile' } });
    }
  }, [authLoading, user, navigate]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

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
  }, [user?.id, fetchUserPixels, fetchProfile]);

  // Utility functions
  const formatDate = useCallback((dateString: string | null): string => {
    if (!dateString) return 'Not provided';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  const formatRelativeDate = useCallback((dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
      if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
      return `${Math.floor(diffInDays / 365)} years ago`;
    } catch {
      return formatDate(dateString);
    }
  }, [formatDate]);

  const getInitials = useCallback((name: string | null): string => {
    if (!name || name.trim().length === 0) return 'U';
    return name
      .trim()
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const handleEditProfile = useCallback(() => {
    setEditModalOpen(true);
  }, []);

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

  // Unauthenticated state
  if (!user) {
    return null;
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => fetchProfile()} variant="outline">
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20 lg:pb-8">
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center space-x-3 md:space-x-4">
            <Link to="/" aria-label="Back to home">
              <Button variant="ghost" size="sm" className="group">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Account Overview
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Manage your account and pixels
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
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
            <Button 
              onClick={handleEditProfile} 
              className="gap-2 transition-transform hover:scale-105" 
              size="sm"
              aria-label="Edit profile"
            >
              <Edit className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Edit Profile</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          </div>
        </header>

        {/* Profile Completion Alert */}
        {profileCompletionData.percentage < 100 && (
          <Alert className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <span className="font-semibold">Complete your profile</span> to unlock all features and enhance your experience. 
              <span className="font-semibold ml-1">{profileCompletionData.missingFields.length} field{profileCompletionData.missingFields.length !== 1 ? 's' : ''} remaining.</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Card */}
          <div className="lg:col-span-1">
            <Card className="shadow-xl sticky top-4">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <Avatar className="w-32 h-32 border-4 border-background shadow-lg ring-2 ring-primary/10">
                      <AvatarImage 
                        src={profile?.avatar_url || undefined} 
                        alt={`${profile?.full_name || 'User'}'s profile picture`}
                      />
                      <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                        {getInitials(profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {(!profile?.avatar_url || profile.avatar_url.includes('dicebear.com')) && (
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-background">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <CardTitle className="text-xl font-bold">
                  {profile?.full_name || 'Anonymous User'}
                </CardTitle>
                <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <Badge variant="secondary" className="flex items-center gap-1" title={`Joined ${formatDate(profile?.created_at || '')}`}>
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {formatRelativeDate(profile?.created_at || '')}
                  </Badge>
                  <Badge variant="default" className="flex items-center gap-1 bg-green-500">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    Verified
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Profile Completion Card */}
                <div className="bg-gradient-to-br from-orange-50 to-blue-50 dark:from-orange-950/20 dark:to-blue-950/20 rounded-lg p-4 border-2 border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground">Profile Completion</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {profileCompletionData.percentage === 100 
                          ? '🎉 Complete!' 
                          : 'Complete to unlock all features'
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
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
                        className={`flex items-center justify-between p-2 rounded-md transition-colors ${
                          field.completed 
                            ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' 
                            : 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={field.completed ? 'text-green-600' : 'text-yellow-600'}>
                            {field.icon}
                          </div>
                          <span className={`text-sm font-medium ${
                            field.completed ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'
                          }`}>
                            {field.label}
                          </span>
                        </div>
                        {field.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Missing Fields Alert */}
                  {profileCompletionData.missingFields.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        ⚠️ Missing Information:
                      </p>
                      <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 ml-4">
                        {profileCompletionData.missingFields.map((field) => (
                          <li key={field.name} className="list-disc">
                            Add your {field.label.toLowerCase()}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        onClick={handleEditProfile}
                        size="sm"
                        className="w-full mt-3 bg-orange-600 hover:bg-orange-700"
                      >
                        <Edit className="w-3 h-3 mr-2" />
                        Complete Profile Now
                      </Button>
                    </div>
                  )}
                </div>

                {/* Account Status */}
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    Account Status
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="default">Active Member</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Pixels Owned</span>
                      <span className="font-semibold">{pixelStats.totalPixels}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Member Since</span>
                      <span className="font-semibold text-xs">{formatRelativeDate(profile?.created_at || '')}</span>
                    </div>
                  </div>
                </div>

                {/* User ID Card */}
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    User ID
                  </h3>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background p-2 rounded border font-mono truncate">
                      {user.id}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyUserId}
                      className="flex-shrink-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Use this ID for support inquiries
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button 
                    onClick={handleExportData}
                    variant="outline"
                    className="w-full"
                    size="sm"
                    disabled={exportLoading}
                  >
                    {exportLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export My Data
                      </>
                    )}
                  </Button>

                  <Button 
                    onClick={handleSignOut}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    Sign Out
                  </Button>

                  <Button 
                    onClick={() => setDeleteDialogOpen(true)}
                    variant="destructive"
                    className="w-full"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Details & Pixels */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoCard 
                    icon={<Mail className="w-4 h-4" />}
                    label="Email"
                    value={user.email || 'Not provided'}
                    completed={true}
                  />
                  <InfoCard 
                    icon={<User className="w-4 h-4" />}
                    label="Full Name"
                    value={profile?.full_name || 'Not provided'}
                    completed={Boolean(profile?.full_name && profile.full_name.trim().length >= 2)}
                  />
                  <InfoCard 
                    icon={<Phone className="w-4 h-4" />}
                    label="Phone Number"
                    value={profile?.phone_number || 'Not provided'}
                    completed={Boolean(profile?.phone_number)}
                  />
                  <InfoCard 
                    icon={<Calendar className="w-4 h-4" />}
                    label="Date of Birth"
                    value={formatDate(profile?.date_of_birth)}
                    completed={Boolean(profile?.date_of_birth)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pixels Section */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    My Pixels
                    <Badge variant="outline" className="ml-2">{pixelStats.totalPixels}</Badge>
                  </CardTitle>
                  {userPixels.length > 0 && (
                    <Button 
                      onClick={() => fetchUserPixels(true)}
                      variant="ghost"
                      size="sm"
                      disabled={pixelsLoading}
                    >
                      <RefreshCw className={`w-4 h-4 ${pixelsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pixelsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : userPixels.length > 0 ? (
                  <div className="space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard 
                        icon={<Eye className="w-5 h-5" />}
                        label="Total Pixels"
                        value={pixelStats.totalPixels.toString()}
                        color="primary"
                      />
                      <StatCard 
                        icon={<TrendingUp className="w-5 h-5" />}
                        label="Total Investment"
                        value={`₹${pixelStats.totalInvestment.toLocaleString()}`}
                        color="success"
                      />
                      <StatCard 
                        icon={<Award className="w-5 h-5" />}
                        label="Avg. Price"
                        value={`₹${Math.round(pixelStats.averagePrice).toLocaleString()}`}
                        color="secondary"
                      />
                    </div>
                    
                    {/* Pixels List */}
                    <div className="bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <div className="space-y-2">
                        {userPixels.map((pixel) => (
                          <PixelItem 
                            key={pixel.id}
                            pixel={pixel}
                            onVisit={handlePixelVisit}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyPixelsState />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Modal */}
        <ProfileEditModal
          isOpen={editModalOpen}
          onClose={handleCloseModal}
          profile={profile}
          onProfileUpdate={() => fetchProfile(true)}
        />

        {/* Delete Account Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Account Permanently?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This action <strong className="text-destructive">cannot be undone</strong>. This will permanently delete your account and remove all your data from our servers.
                </p>
                
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <p className="font-semibold">What will be deleted:</p>
                  <ul className="space-y-1 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>Your profile and personal information</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>All {pixelStats.totalPixels} pixel{pixelStats.totalPixels !== 1 ? 's' : ''} you own</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>Your purchase history and data</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>Your account access (you'll be signed out)</span>
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip:</strong> Consider exporting your data before deleting your account.
                </p>

                <div className="space-y-2 pt-2">
                  <label htmlFor="delete-confirm" className="text-sm font-medium text-destructive">
                    Type <code className="text-destructive">"delete my account"</code> to confirm:
                  </label>
                  <Input
                    id="delete-confirm"
                    type="text"
                    placeholder="delete my account"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="border-destructive focus-visible:ring-destructive"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText.toLowerCase() !== 'delete my account'}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

// Sub-components
interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  completed?: boolean;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, label, value, completed = true }) => (
  <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
    completed 
      ? 'bg-muted/30 hover:bg-muted/50' 
      : 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800'
  }`}>
    <div className={completed ? 'text-muted-foreground' : 'text-yellow-600'} aria-hidden="true">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {!completed && (
          <AlertCircle className="w-3 h-3 text-yellow-600" />
        )}
      </div>
      <p className={`font-medium truncate ${!completed && value === 'Not provided' ? 'text-yellow-700 dark:text-yellow-400' : ''}`} title={value}>
        {value}
      </p>
    </div>
    {completed && value !== 'Not provided' && (
      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
    )}
  </div>
);

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'primary' | 'success' | 'secondary';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-green-600',
    secondary: 'text-secondary'
  };

  return (
    <div className="bg-muted/30 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className={colorClasses[color]} aria-hidden="true">{icon}</div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
};

interface PixelItemProps {
  pixel: UserPixel;
  onVisit: (url: string) => void;
}

const PixelItem: React.FC<PixelItemProps> = ({ pixel, onVisit }) => (
  <div className="flex items-center justify-between py-3 px-4 bg-background rounded-lg border hover:border-primary/50 transition-all hover:shadow-sm">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {pixel.image_url && (
        <img 
          src={pixel.image_url} 
          alt={pixel.alt_text || `Pixel at (${pixel.x}, ${pixel.y})`}
          className="w-10 h-10 rounded object-cover flex-shrink-0"
          loading="lazy"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {pixel.alt_text || `Pixel (${pixel.x}, ${pixel.y})`}
        </p>
        <p className="text-sm text-muted-foreground">
          Position: ({pixel.x}, {pixel.y}) • ₹{pixel.price_paid.toLocaleString()}
        </p>
      </div>
    </div>
    {pixel.link_url && (
      <Button
        size="sm"
        variant="outline"
        onClick={() => onVisit(pixel.link_url!)}
        className="flex-shrink-0 gap-1"
        aria-label={`Visit link for pixel at (${pixel.x}, ${pixel.y})`}
      >
        <span className="hidden sm:inline">Visit</span>
        <ExternalLink className="w-4 h-4" aria-hidden="true" />
      </Button>
    )}
  </div>
);

const EmptyPixelsState = () => (
  <div className="text-center py-12 px-4">
    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
      <MapPin className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
    </div>
    <h3 className="text-lg font-semibold mb-2">No Pixels Yet</h3>
    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
      Start building your digital real estate by purchasing your first pixels.
    </p>
    <Link to="/buy-pixels">
      <Button className="gap-2">
        <MapPin className="w-4 h-4" aria-hidden="true" />
        Buy Your First Pixels
      </Button>
    </Link>
  </div>
);

export default Profile;
