import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔐 Auth callback started');
        console.log('URL params:', Object.fromEntries(searchParams));

        // Get URL parameters
        const errorCode = searchParams.get('error_code');
        const errorDescription = searchParams.get('error_description');
        const error = searchParams.get('error');
        const type = searchParams.get('type');
        const code = searchParams.get('code');

        // Handle errors in URL
        if (errorCode === 'otp_expired' || error === 'access_denied') {
          console.warn('⚠️ OTP expired or access denied');
          setStatus('expired');
          setErrorMessage(
            errorDescription
              ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
              : 'Your email link has expired. Please request a new one.'
          );
          toast({
            title: 'Link Expired',
            description:
              'Your email link has expired. Please request a new link.',
            variant: 'destructive',
          });
          return;
        }

        if (error && error !== 'access_denied') {
          console.error('❌ Auth error:', error, errorDescription);
          setStatus('error');
          setErrorMessage(
            errorDescription
              ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
              : 'An authentication error occurred.'
          );
          toast({
            title: 'Authentication Error',
            description: errorMessage || 'Please try signing in again.',
            variant: 'destructive',
          });
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        // ✅ FIXED: Handle PKCE code exchange (ALL email links use this now)
        // This includes: signup confirmation, magic links, OAuth, password reset
        if (code) {
          console.log('🔑 PKCE code detected, exchanging for session...');

          try {
            const { data, error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
              console.error('❌ Code exchange error:', exchangeError);

              let errorMsg = exchangeError.message;
              let errorTitle = 'Authentication Failed';

              // Handle specific PKCE errors
              if (exchangeError.message.includes('code verifier')) {
                errorMsg =
                  'Invalid authentication link. This may be caused by an outdated email template. Please request a new link.';
                errorTitle = 'Invalid Link';
                console.error(
                  '⚠️ PKCE code verifier missing - email template may be outdated'
                );
              } else if (exchangeError.message.includes('expired')) {
                errorMsg =
                  'Your authentication link has expired. Please request a new one.';
                errorTitle = 'Link Expired';
              } else if (
                exchangeError.message.includes('already been used')
              ) {
                errorMsg =
                  'This link has already been used. Please sign in or request a new link.';
                errorTitle = 'Link Already Used';
              }

              setStatus('error');
              setErrorMessage(errorMsg);
              toast({
                title: errorTitle,
                description: errorMsg,
                variant: 'destructive',
              });
              setTimeout(() => navigate('/signin'), 3000);
              return;
            }

            if (data?.session) {
              console.log('✅ Session created via PKCE code exchange');

              // Determine auth type based on type parameter and provider
              const isOAuth =
                data.session.user.app_metadata.provider === 'google';
              const isRecovery = type === 'recovery';
              const isEmailConfirmation = type === 'signup';

              if (isRecovery) {
                setAuthType('recovery');
                console.log('🔓 Password recovery confirmed');

                // Redirect to reset password page
                toast({
                  title: 'Link Verified',
                  description: 'Please enter your new password.',
                });
                navigate('/reset-password', { replace: true });
                return;
              } else if (isEmailConfirmation) {
                setAuthType('email_confirmation');
                console.log('📧 Email confirmed via PKCE');
              } else if (isOAuth) {
                setAuthType('oauth');
                console.log('🔐 OAuth sign-in via PKCE');
              } else {
                setAuthType('signin');
                console.log('🔑 Magic link sign-in via PKCE');
              }

              // Create profile if needed (with race condition protection)
              await handleProfileCreation(data.session);

              setStatus('success');

              // Customize success message based on auth type
              let title = 'Welcome Back! 👋';
              let description = "You're now signed in.";

              if (isEmailConfirmation) {
                title = 'Email Verified! 🎉';
                description =
                  'Your account is now active. Welcome to BuyAPixel!';
              } else if (isOAuth) {
                title = 'Success! 🎉';
                description = 'Welcome back via Google!';
              }

              toast({
                title,
                description,
              });

              const redirectTo = searchParams.get('redirect') || '/';
              setTimeout(
                () => navigate(redirectTo, { replace: true }),
                1500
              );
              return;
            } else {
              // Edge case: code exchange succeeded but no session
              console.warn('⚠️ Code exchange succeeded but no session created');
              setStatus('error');
              setErrorMessage(
                'Authentication completed but session was not created. Please sign in.'
              );
              setTimeout(() => navigate('/signin'), 3000);
              return;
            }
          } catch (err: any) {
            console.error(
              '❌ Unexpected error during code exchange:',
              err
            );
            setStatus('error');
            setErrorMessage(
              'Failed to complete authentication. Please try again.'
            );
            setTimeout(() => navigate('/signin'), 3000);
            return;
          }
        }

        // Fallback: Check for existing session (shouldn't normally reach here)
        console.log('📋 No code found, checking for existing session...');
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setStatus('error');
          setErrorMessage(sessionError.message);
          toast({
            title: 'Authentication Failed',
            description: sessionError.message,
            variant: 'destructive',
          });
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        if (!session) {
          console.warn('⚠️ No session or code found in callback');
          setStatus('error');
          setErrorMessage(
            'No authentication data found. Please try signing in again.'
          );
          toast({
            title: 'Session Not Found',
            description: 'Please try signing in again.',
            variant: 'destructive',
          });
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        // Session found (edge case - user already authenticated)
        console.log('✅ Existing session found for user:', session.user.id);

        await handleProfileCreation(session);

        setStatus('success');
        toast({
          title: 'Welcome Back! 👋',
          description: "You're already signed in.",
        });

        const redirectTo = searchParams.get('redirect') || '/';
        setTimeout(() => navigate(redirectTo, { replace: true }), 1500);
      } catch (error: any) {
        console.error('❌ Unexpected error during auth callback:', error);
        setStatus('error');
        setErrorMessage('An unexpected error occurred. Please try again.');

        toast({
          title: 'Unexpected Error',
          description: 'Something went wrong. Please try signing in again.',
          variant: 'destructive',
        });

        setTimeout(() => navigate('/signin'), 3000);
      }
    };

    handleCallback();
  }, [navigate, toast, searchParams]);

  // FIXED: Helper function with race condition protection
  const handleProfileCreation = async (session: any) => {
    try {
      console.log('🔍 Checking for existing profile...');

      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        // Don't throw - profile creation failure shouldn't block auth
        return;
      }

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
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          displayName
        )}`;

      // FIXED: Use upsert instead of insert to handle race conditions
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: session.user.id,
            full_name: displayName,
            avatar_url: avatarUrl,
            email: session.user.email,
            phone_number: session.user.user_metadata?.phone_number || null,
            date_of_birth: session.user.user_metadata?.date_of_birth || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id', // Specify the unique constraint
            ignoreDuplicates: false, // Update if exists
          }
        );

      if (upsertError) {
        console.error('Profile creation error:', upsertError);
        // Don't throw - continue with auth even if profile creation fails
        toast({
          title: 'Profile Setup Warning',
          description:
            'Your account was created but profile setup encountered an issue. You can update it later.',
          variant: 'destructive',
        });
      } else {
        console.log('✅ Profile created/updated successfully');
      }
    } catch (err) {
      console.error('Error handling profile:', err);
      // Don't throw - allow auth to continue
    }
  };

  const handleReturnToSignIn = () => {
    navigate('/signin');
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
        message:
          authType === 'recovery'
            ? 'Please request a new password reset link'
            : 'Please request a new verification link',
      },
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
                ? 'Verifying password reset link...'
                : authType === 'email_confirmation'
                ? 'Confirming your email...'
                : 'Completing sign in...'}
            </h2>
            <p className="text-muted-foreground">
              {authType === 'email_confirmation'
                ? 'Verifying your email address...'
                : 'Please wait while we set up your account'}
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
              {authType === 'email_confirmation'
                ? 'Email Verified! 🎉'
                : 'Success! ✨'}
            </h2>
            <p className="text-muted-foreground">
              {authType === 'email_confirmation'
                ? 'Your account is now active!'
                : 'Redirecting you to the app...'}
            </p>

            <div className="flex justify-center gap-2 mt-6">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
            </div>
          </>
        )}

        {status === 'email_confirmed' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center animate-scale-in">
                <CheckCircle2 className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-blue-600 dark:text-blue-400">
              Email Confirmed! ✅
            </h2>
            <p className="text-muted-foreground mb-6">
              {errorMessage ||
                'Your email has been verified. You can now sign in with your credentials.'}
            </p>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Redirecting to sign in page in 3 seconds...
              </p>
              <Button
                onClick={handleReturnToSignIn}
                className="w-full"
                size="lg"
              >
                Sign In Now
              </Button>
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
                Email links expire after 60 minutes for security.
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
