import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

type AuthStatus = 'loading' | 'success' | 'error' | 'expired';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [authType, setAuthType] = useState<'signin' | 'signup' | 'recovery' | 'oauth'>('signin');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for errors in URL params (from Supabase redirects)
        const errorCode = searchParams.get('error_code');
        const errorDescription = searchParams.get('error_description');
        const error = searchParams.get('error');

        // Handle specific error cases
        if (errorCode === 'otp_expired' || error === 'access_denied') {
          console.warn('OTP expired or access denied');
          setStatus('expired');
          setErrorMessage(
            errorDescription 
              ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
              : 'Your email link has expired. Please request a new one.'
          );
          
          toast({
            title: "Link Expired",
            description: "Your email link has expired. Please sign in again to receive a new one.",
            variant: "destructive",
          });
          
          return;
        }

        // Handle OAuth errors
        if (error && error !== 'access_denied') {
          console.error('Auth error:', error, errorDescription);
          setStatus('error');
          setErrorMessage(
            errorDescription 
              ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
              : 'An authentication error occurred.'
          );
          
          toast({
            title: "Authentication Error",
            description: errorMessage || "Please try signing in again.",
            variant: "destructive",
          });
          
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        // Check for type parameter (password recovery, signup, etc.)
        const type = searchParams.get('type');
        if (type === 'recovery') {
          setAuthType('recovery');
          console.log('🔓 Password recovery flow detected');
          // Don't redirect yet - let ResetPassword handle it
          navigate('/reset-password', { replace: true });
          return;
        }

        // Check for PKCE code parameter (OAuth flow)
        const code = searchParams.get('code');
        
        let session = null;
        let sessionError = null;

        if (code) {
          // PKCE flow - exchange code for session
          console.log('🔐 PKCE flow detected - exchanging code for session...');
          setAuthType('oauth');
          
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            setStatus('error');
            setErrorMessage(exchangeError.message);
            
            toast({
              title: "Authentication Failed",
              description: exchangeError.message,
              variant: "destructive",
            });
            
            setTimeout(() => navigate('/signin'), 3000);
            return;
          }
          
          session = data.session;
          console.log('✅ Code exchange successful', session ? 'Session created' : 'No session');
        } else {
          // Try to get session from URL hash (magic link flow)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('🔗 Magic link flow detected - setting session from tokens...');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            session = data.session;
            sessionError = error;
          } else {
            // Fallback to getting existing session
            console.log('📋 Checking for existing session...');
            const { data, error } = await supabase.auth.getSession();
            session = data.session;
            sessionError = error;
          }
        }

        if (sessionError) {
          console.error('Session error:', sessionError);
          setStatus('error');
          setErrorMessage(sessionError.message);
          
          toast({
            title: "Authentication Failed",
            description: sessionError.message,
            variant: "destructive",
          });
          
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        if (!session) {
          console.warn('No session found after callback');
          setStatus('error');
          setErrorMessage('No session found. Please try signing in again.');
          
          toast({
            title: "Session Not Found",
            description: "Please try signing in again.",
            variant: "destructive",
          });
          
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        // Successfully authenticated - now handle profile
        console.log('✅ Session established for user:', session.user.id);
        console.log('User email:', session.user.email);

        // Check if profile exists
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
          console.error('Profile check error:', profileCheckError);
          // Continue anyway - profile can be created later
        }

        // Create profile if it doesn't exist
        if (!existingProfile) {
          console.log('📝 Creating new profile for user...');
          
          const displayName = 
            session.user.user_metadata?.full_name || 
            session.user.user_metadata?.name ||
            session.user.user_metadata?.preferred_username ||
            session.user.email?.split('@')[0] ||
            'User';

          const avatarUrl = 
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: session.user.id,
              full_name: displayName,
              avatar_url: avatarUrl,
              email: session.user.email,
              created_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Profile creation error:', insertError);
            // Don't fail the login - user can update profile later
            toast({
              title: "Profile Setup",
              description: "You can complete your profile setup later.",
              variant: "default",
            });
          } else {
            console.log('✅ Profile created successfully');
            setAuthType('signup');
          }
        } else {
          console.log('✅ Existing profile found');
        }

        // Success!
        setStatus('success');
        
        const welcomeMessage = authType === 'signup' 
          ? 'Welcome to BuyAPixel! Your account has been created.'
          : authType === 'oauth'
          ? `Welcome, ${existingProfile?.full_name || session.user.email}!`
          : `Welcome back, ${session.user.email}!`;

        toast({
          title: authType === 'signup' ? "Account Created! 🎉" : "Welcome Back! 👋",
          description: welcomeMessage,
        });

        // Redirect based on where user should go
        const redirectTo = searchParams.get('redirect') || '/';
        
        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 1500);

      } catch (error) {
        console.error('❌ Unexpected error during auth callback:', error);
        setStatus('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
        
        toast({
          title: "Unexpected Error",
          description: "Something went wrong. Please try signing in again.",
          variant: "destructive",
        });
        
        setTimeout(() => navigate('/signin'), 3000);
      }
    };

    handleCallback();
  }, [navigate, toast, searchParams]);

  const handleReturnToSignIn = () => {
    navigate('/signin');
  };

  const handleRequestNewLink = () => {
    navigate('/signin', { 
      state: { 
        message: 'Please sign in to receive a new email link' 
      } 
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="text-center max-w-md mx-auto p-8 bg-card rounded-lg shadow-lg border">
        {status === 'loading' && (
          <>
            <div className="mb-6">
              <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              {authType === 'recovery' 
                ? 'Verifying link...' 
                : authType === 'oauth'
                ? 'Completing OAuth sign in...'
                : 'Completing sign in...'}
            </h2>
            <p className="text-muted-foreground">
              {authType === 'recovery' 
                ? 'Please wait while we verify your password reset link'
                : authType === 'oauth'
                ? 'Please wait while we connect your account'
                : 'Please wait while we set up your account'}
            </p>

            {/* Loading dots animation */}
            <div className="flex justify-center gap-2 mt-6">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center animate-scale-in">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-green-600 dark:text-green-400">
              {authType === 'signup' ? 'Account Created! 🎉' : 'Success! ✨'}
            </h2>
            <p className="text-muted-foreground">
              {authType === 'signup' 
                ? 'Your account has been created. Redirecting...'
                : authType === 'oauth'
                ? 'OAuth sign in successful. Redirecting...'
                : 'Redirecting you to the app...'}
            </p>
            
            {/* Success animation */}
            <div className="flex justify-center gap-2 mt-6">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
            </div>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                <Mail className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-amber-600 dark:text-amber-400">
              Link Expired
            </h2>
            <p className="text-muted-foreground mb-6">
              {errorMessage || 'Your email link has expired or is invalid.'}
            </p>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Email links expire after a few minutes for security.
              </p>
              <Button 
                onClick={handleRequestNewLink}
                className="w-full"
                size="lg"
              >
                Request New Link
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-red-600 dark:text-red-400">
              Authentication Failed
            </h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage || 'An error occurred during authentication.'}
            </p>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Redirecting to sign in page in 3 seconds...
              </p>
              <Button 
                onClick={handleReturnToSignIn}
                variant="outline"
                className="w-full"
              >
                Return to Sign In Now
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Add custom animation styles */}
      <style>{`
        @keyframes scale-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;
