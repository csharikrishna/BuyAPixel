import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
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
          console.warn('No session found');
          setStatus('error');
          setErrorMessage('No session found. Please try signing in again.');
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        // Session exists, check/create profile
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
          console.error('Profile check error:', profileCheckError);
          // Don't fail here, continue with login
        }

        // Create profile if it doesn't exist
        if (!existingProfile) {
          console.log('Creating new profile for OAuth user');
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: session.user.id,
              full_name: session.user.user_metadata?.full_name || 
                         session.user.user_metadata?.name ||
                         session.user.email?.split('@')[0],
              avatar_url: session.user.user_metadata?.avatar_url ||
                          session.user.user_metadata?.picture,
              email: session.user.email,
            });

          if (insertError) {
            console.error('Profile creation error:', insertError);
            // Don't fail the login, user can update profile later
          }
        }

        // Success!
        setStatus('success');
        
        toast({
          title: "Welcome!",
          description: `Successfully signed in as ${session.user.email}`,
        });

        // Redirect to home after a brief delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);

      } catch (error) {
        console.error('Unexpected error during auth callback:', error);
        setStatus('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
        
        toast({
          title: "Error",
          description: "An unexpected error occurred during sign in.",
          variant: "destructive",
        });
        
        setTimeout(() => navigate('/signin'), 3000);
      }
    };

    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <div className="text-center max-w-md mx-auto p-8">
        {status === 'loading' && (
          <>
            <div className="mb-6">
              <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Completing sign in...</h2>
            <p className="text-muted-foreground">Please wait while we set up your account</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-green-600 dark:text-green-400">
              Success!
            </h2>
            <p className="text-muted-foreground">Redirecting you to the app...</p>
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
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
          </>
        )}

        {/* Loading dots animation */}
        {status === 'loading' && (
          <div className="flex justify-center gap-2 mt-6">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
