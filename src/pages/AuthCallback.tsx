import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils';

type AuthStatus =
  | 'loading'
  | 'success'
  | 'error'
  | 'expired'
  | 'email_confirmed';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [authType, setAuthType] = useState<
    'signin' | 'signup' | 'recovery' | 'oauth' | 'email_confirmation'
  >('signin');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('🔐 Auth callback started');

      // Step 1: Check for existing valid session FIRST
      const { data: { session: existingSession } } = await supabase.auth.getSession();

      if (existingSession) {
        console.log('✅ Valid session already exists');
        await completeAuthentication(existingSession, 'signin');
        return;
      }

      // Step 2: Get URL parameters
      const errorCode = searchParams.get('error_code');
      const errorDescription = searchParams.get('error_description');
      const error = searchParams.get('error');
      const type = searchParams.get('type');
      const tokenHash = searchParams.get('token_hash');

      // Step 3: Handle OTP expired error ONLY if no session exists
      if ((errorCode === 'otp_expired' || error === 'access_denied') && !existingSession) {
        console.warn('⚠️ Link expired and no valid session found');
        handleExpiredLink();
        return;
      }

      // Step 4: Handle other errors
      if (error && error !== 'access_denied') {
        console.error('❌ Auth error:', error);
        handleAuthError(errorDescription || 'Authentication failed');
        return;
      }

      // Step 5: Handle token_hash authentication (NEW METHOD - more reliable)
      if (tokenHash) {
        console.log('🔑 Token hash detected, verifying...');
        await handleTokenHash(tokenHash, type || 'magiclink');
        return;
      }

      // Step 6: No session and no token - redirect to sign in
      console.warn('⚠️ No authentication data found');
      setStatus('error');
      setErrorMessage('No authentication data found. Please try signing in again.');
      toast({
        title: 'Session Not Found',
        description: 'Please try signing in again.',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/signin', { replace: true }), 3000);

    } catch (error: unknown) {
      console.error('❌ Unexpected error:', error);
      handleAuthError(getErrorMessage(error) || 'An unexpected error occurred');
    }
  };

  const handleTokenHash = async (tokenHash: string, type: string) => {
    try {
      // Verify the token and create session
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === 'recovery' ? 'recovery' : (type === 'signup' ? 'signup' : 'magiclink'),
      });

      if (error) {
        console.error('❌ Token verification failed:', error);

        if (error.message.includes('expired') || error.message.includes('invalid')) {
          handleExpiredLink();
        } else {
          handleAuthError(error.message);
        }
        return;
      }

      if (data?.session) {
        console.log('✅ Session created via token verification');
        const authType = type === 'recovery' ? 'recovery' :
          type === 'signup' ? 'email_confirmation' : 'signin';
        await completeAuthentication(data.session, authType);
      }
    } catch (err: unknown) {
      console.error('❌ Token verification error:', err);
      handleAuthError(getErrorMessage(err) || 'Failed to verify authentication token');
    }
  };

  const completeAuthentication = async (session: any, type: string) => {
    try {
      // Handle password recovery redirect
      if (type === 'recovery') {
        setAuthType('recovery');
        setStatus('success');
        toast({
          title: 'Link Verified',
          description: 'Please enter your new password.',
        });
        setTimeout(() => navigate('/reset-password', { replace: true }), 500);
        return;
      }

      // Create/update profile
      await handleProfileCreation(session);

      // Set success status
      setStatus('success');

      const messages = {
        email_confirmation: {
          title: 'Email Verified! 🎉',
          description: 'Your account is now active. Welcome to BuyAPixel!'
        },
        oauth: {
          title: 'Success! 🎉',
          description: 'Welcome back via Google!'
        },
        signin: {
          title: 'Welcome Back! 👋',
          description: "You're now signed in."
        }
      };

      const message = messages[type as keyof typeof messages] || messages.signin;

      toast({
        title: message.title,
        description: message.description,
      });

      // Redirect after delay
      const redirectTo = searchParams.get('redirect') || '/';
      setTimeout(() => navigate(redirectTo, { replace: true }), 1500);

    } catch (err) {
      console.error('❌ Error completing authentication:', err);
      handleAuthError('Failed to complete sign in');
    }
  };

  const handleExpiredLink = () => {
    setStatus('expired');
    setErrorMessage('Your email link has expired or is invalid. Email links expire after 24 hours for security.');
    toast({
      title: 'Link Expired',
      description: 'Please request a new link to continue.',
      variant: 'destructive',
    });
  };

  const handleAuthError = (message: string) => {
    setStatus('error');
    setErrorMessage(message);
    toast({
      title: 'Authentication Error',
      description: message,
      variant: 'destructive',
    });
    setTimeout(() => navigate('/signin', { replace: true }), 5000);
  };

  const handleProfileCreation = async (session: any) => {
    try {
      console.log('🔍 Checking for existing profile...');

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existingProfile) {
        console.log('✅ Profile already exists');
        return;
      }

      console.log('📝 Creating new profile...');

      const displayName =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.email?.split('@')[0] ||
        'User';

      const avatarUrl =
        session.user.user_metadata?.avatar_url ||
        session.user.user_metadata?.picture ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;

      await supabase.from('profiles').upsert(
        {
          user_id: session.user.id,
          full_name: displayName,
          avatar_url: avatarUrl,
          phone_number: session.user.user_metadata?.phone_number || null,
          date_of_birth: session.user.user_metadata?.date_of_birth || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
          ignoreDuplicates: false,
        }
      );

      console.log('✅ Profile created successfully');
    } catch (err) {
      console.error('Error handling profile:', err);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setStatus('loading');
    handleCallback();
  };

  const handleRequestNewLink = () => {
    const authTypeMap = {
      recovery: '/forgot-password',
      email_confirmation: '/signup',
      signin: '/signin',
      signup: '/signup',
      oauth: '/signin',
    };

    navigate(authTypeMap[authType] || '/signin', {
      state: {
        message: 'Please request a new verification link',
      },
      replace: true,
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
              Completing sign in...
            </h2>
            <p className="text-muted-foreground">
              Please wait while we verify your link
            </p>

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
              Success! ✨
            </h2>
            <p className="text-muted-foreground">
              Redirecting you to the app...
            </p>

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
              {errorMessage}
            </p>
            <div className="space-y-3">
              <Button
                onClick={handleRequestNewLink}
                className="w-full"
                size="lg"
              >
                <Mail className="w-4 h-4 mr-2" />
                Request New Link
              </Button>
              {retryCount < 2 && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
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
            <p className="text-muted-foreground mb-6 text-sm">
              {errorMessage}
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/signin', { replace: true })}
                className="w-full"
                size="lg"
              >
                Return to Sign In
              </Button>
              {retryCount < 2 && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          </>
        )}
      </div>

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
