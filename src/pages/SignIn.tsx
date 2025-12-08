import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Mail,
  Lock,
  ArrowLeft,
  Sparkles,
  Shield,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Chrome,
  KeyRound,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
});

interface LocationState {
  from?: {
    pathname: string;
  };
}

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [signInMethod, setSignInMethod] = useState<
    'password' | 'magic-link'
  >('password');

  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Get redirect path from location state (typed)
  const from =
    (location.state as LocationState | null)?.from?.pathname || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Load saved email if remember me was checked previously
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Check for OAuth/Auth errors in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const errorCode = params.get('error_code');

    if (error || errorCode) {
      let title = 'Sign In Error';
      let message = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        : 'Authentication failed';

      if (errorCode === 'otp_expired' || error === 'access_denied') {
        title = 'Link Expired';
        message =
          'Your sign-in link has expired. Please request a new one.';
      } else if (error === 'auth_failed') {
        message = 'Authentication failed. Please try again.';
      } else if (error === 'unexpected') {
        message = 'An unexpected error occurred during sign in.';
      } else if (errorCode === 'email_not_confirmed') {
        title = 'Email Not Confirmed';
        message =
          'Please confirm your email address. Check your inbox for the confirmation link.';
      }

      toast({
        title,
        description: message,
        variant: 'destructive',
      });

      // Clean up URL
      window.history.replaceState({}, '', '/signin');
    }
  }, [location, toast]);

  // Real-time email validation
  const validateEmail = useCallback((value: string) => {
    if (!value) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value)
      ? ''
      : 'Please enter a valid email address';
  }, []);

  // Password strength calculation
  const calculatePasswordStrength = useCallback((pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 10) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    return Math.min(strength, 4);
  }, []);

  // Handle email change with validation
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      setIsTyping(true);
      setMagicLinkSent(false); // Reset magic link state

      // Debounced validation
      setTimeout(() => {
        const error = validateEmail(value);
        setFormErrors((prev) => ({ ...prev, email: error }));
        setIsTyping(false);
      }, 500);
    },
    [validateEmail]
  );

  // Handle password change with strength indicator
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPassword(value);
      setPasswordStrength(calculatePasswordStrength(value));

      if (value.length > 0 && value.length < 6) {
        setFormErrors((prev) => ({
          ...prev,
          password: 'Password must be at least 6 characters',
        }));
      } else {
        setFormErrors((prev) => ({ ...prev, password: '' }));
      }
    },
    [calculatePasswordStrength]
  );

  // Sign in with email and password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // If magic link mode, send magic link instead
    if (signInMethod === 'magic-link') {
      handleMagicLinkSignIn();
      return;
    }

    // Validate form data
    const validation = signInSchema.safeParse({ email, password });

    if (!validation.success) {
      const errors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'email') errors.email = err.message;
        if (err.path[0] === 'password') errors.password = err.message;
      });
      setFormErrors(errors);

      toast({
        title: 'Validation Error',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) {
        let errorMessage = error.message;
        let errorTitle = 'Sign In Failed';

        if (error.message.includes('Invalid login credentials')) {
          errorMessage =
            'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage =
            'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
          errorTitle = 'Email Not Confirmed';
        } else if (error.message.includes('too many requests')) {
          errorMessage =
            'Too many login attempts. Please wait a few minutes and try again.';
          errorTitle = 'Rate Limit Exceeded';
        } else if (error.message.includes('User not found')) {
          errorMessage =
            'No account found with this email. Please sign up first.';
          errorTitle = 'Account Not Found';
        }

        console.error('Sign in error:', error);

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        // Save email if remember me is checked
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        toast({
          title: 'Welcome back! 👋',
          description: "You've been successfully signed in.",
        });
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Magic link sign in - FIXED VERSION
  const handleMagicLinkSignIn = async () => {
    // Validate email first
    const emailError = validateEmail(email);
    if (emailError) {
      setFormErrors((prev) => ({ ...prev, email: emailError }));
      toast({
        title: 'Invalid Email',
        description: emailError,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      console.log('🔗 Sending magic link to:', email);

      // FIXED: Include redirect parameter like OAuth does
      const redirectUrl =
        from !== '/'
          ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
              from
            )}`
          : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
          // FIXED: Set to false for sign-in (only allow existing users)
          shouldCreateUser: false,
        },
      });

      if (error) {
        console.error('Magic link error:', error);

        let errorMessage = error.message;
        let errorTitle = 'Failed to Send Link';

        if (
          error.message.includes('rate limit') ||
          error.message.includes('Email rate limit exceeded')
        ) {
          errorMessage =
            'Too many requests. Please wait a few minutes before trying again.';
          errorTitle = 'Rate Limit Exceeded';
        } else if (error.message.includes('User not found')) {
          errorMessage =
            'No account found with this email. Please sign up first or use password sign-in if you have an account.';
          errorTitle = 'Account Not Found';
        } else if (error.message.includes('For security purposes')) {
          errorMessage =
            'For security reasons, please wait 60 seconds before requesting another link.';
          errorTitle = 'Rate Limit';
        } else if (
          error.message.includes('Signups not allowed') ||
          error.message.includes('cannot be used')
        ) {
          errorMessage =
            'This email is not registered. Please sign up first or use password sign-in.';
          errorTitle = 'Account Not Found';
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        console.log('✅ Magic link sent successfully');
        setMagicLinkSent(true);

        // Save email if remember me is checked
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        }

        toast({
          title: 'Check Your Email! 📧',
          description: `We've sent a magic link to ${email}. Click the link to sign in.`,
          duration: 6000,
        });
      }
    } catch (error: any) {
      console.error('Magic link error:', error);
      toast({
        title: 'Error',
        description:
          error?.message ||
          'Failed to send magic link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth sign in
  const handleGoogleSignIn = async () => {
    try {
      setOauthLoading(true);

      console.log('🔐 Initiating Google OAuth...');

      // Include redirect parameter in callback URL
      const redirectUrl =
        from !== '/'
          ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
              from
            )}`
          : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);

        let errorMessage = error.message;

        if (errorMessage.includes('redirect')) {
          errorMessage =
            'OAuth redirect configuration error. Please contact support.';
        } else if (errorMessage.includes('not enabled')) {
          errorMessage =
            'Google authentication is not enabled. Please use email/password sign in.';
        } else if (errorMessage.includes('network')) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }

        toast({
          title: 'Sign In Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        setOauthLoading(false);
      }

      // Fallback timeout in case redirect fails
      setTimeout(() => {
        setOauthLoading(false);
      }, 10000);
    } catch (error: any) {
      console.error('Unexpected Google OAuth error:', error);
      toast({
        title: 'Error',
        description:
          error?.message ||
          'Failed to initiate Google sign-in. Please try again.',
        variant: 'destructive',
      });
      setOauthLoading(false);
    }
  };

  // Get password strength color and text
  const getPasswordStrengthInfo = () => {
    if (!password || passwordStrength === 0)
      return { color: 'bg-gray-200', text: '', width: '0%' };
    if (passwordStrength === 1)
      return { color: 'bg-red-500', text: 'Weak', width: '25%' };
    if (passwordStrength === 2)
      return { color: 'bg-orange-500', text: 'Fair', width: '50%' };
    if (passwordStrength === 3)
      return { color: 'bg-yellow-500', text: 'Good', width: '75%' };
    return { color: 'bg-green-500', text: 'Strong', width: '100%' };
  };

  const strengthInfo = getPasswordStrengthInfo();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Hero/Branding */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full animate-pulse" />
          <div className="absolute top-40 right-20 w-24 h-24 bg-white rounded-full animate-pulse [animation-delay:1s]" />
          <div className="absolute bottom-20 left-20 w-40 h-40 bg-white rounded-full animate-pulse [animation-delay:2s]" />
          <div className="absolute bottom-40 right-40 w-28 h-28 bg-white rounded-full animate-pulse [animation-delay:0.5s]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-start p-12 text-white">
          <div className="mb-8">
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Welcome Back to
              <span className="block text-6xl bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                BuyAPixel.in
              </span>
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-md">
              Continue your journey in India&apos;s first pixel marketplace
              where creativity meets opportunity.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  Creative Freedom
                </h3>
                <p className="text-white/80">
                  Express yourself on the digital canvas
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Secure Platform</h3>
                <p className="text-white/80">
                  Your pixels are protected and permanent
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Instant Results</h3>
                <p className="text-white/80">
                  See your pixels live immediately
                </p>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-sm text-white/70 mb-3">
              Trusted by creators and businesses
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300" />
                <span className="text-sm">Secure Authentication</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300" />
                <span className="text-sm">256-bit Encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link
              to="/"
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6 group"
              aria-label="Back to home page"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </Link>
            <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">
              {magicLinkSent
                ? 'Check your email for the magic link'
                : 'Sign in to your account to continue'}
            </p>
          </div>

          {!magicLinkSent ? (
            <>
              {/* Google Sign In Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 mb-6 hover:bg-accent/50 transition-colors"
                onClick={handleGoogleSignIn}
                disabled={oauthLoading || loading}
              >
                {oauthLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting to Google...
                  </>
                ) : (
                  <>
                    <Chrome className="mr-2 h-4 w-4" />
                    Continue with Google
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              {/* Sign In Method Toggle */}
              <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setSignInMethod('password');
                    setMagicLinkSent(false);
                  }}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
                    signInMethod === 'password'
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50'
                  )}
                >
                  <Lock className="w-4 h-4 inline-block mr-2" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignInMethod('magic-link');
                    setMagicLinkSent(false);
                  }}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
                    signInMethod === 'magic-link'
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50'
                  )}
                >
                  <Mail className="w-4 h-4 inline-block mr-2" />
                  Magic Link
                </button>
              </div>

              {/* Email/Password Form */}
              <form
                onSubmit={handleSignIn}
                className="space-y-5"
                noValidate
              >
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address
                    <span
                      className="text-destructive ml-1"
                      aria-label="required"
                    >
                      *
                    </span>
                  </Label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={handleEmailChange}
                      required
                      autoComplete="email"
                      className={cn(
                        'pl-10 h-12 transition-all',
                        formErrors.email &&
                          'border-destructive focus-visible:ring-destructive'
                      )}
                      aria-invalid={!!formErrors.email}
                      aria-describedby={
                        formErrors.email ? 'email-error' : undefined
                      }
                    />
                    {!isTyping && email && !formErrors.email && (
                      <CheckCircle2
                        className="absolute right-3 top-3 h-4 w-4 text-green-500"
                        aria-hidden="true"
                      />
                    )}
                    {formErrors.email && (
                      <AlertCircle
                        className="absolute right-3 top-3 h-4 w-4 text-destructive"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  {formErrors.email && (
                    <p
                      id="email-error"
                      className="text-xs text-destructive flex items-center gap-1 mt-1"
                      role="alert"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.email}
                    </p>
                  )}
                </div>

                {signInMethod === 'password' && (
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password
                      <span
                        className="text-destructive ml-1"
                        aria-label="required"
                      >
                        *
                      </span>
                    </Label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={handlePasswordChange}
                        required
                        autoComplete="current-password"
                        className={cn(
                          'pl-10 pr-10 h-12 transition-all',
                          formErrors.password &&
                            'border-destructive focus-visible:ring-destructive'
                        )}
                        aria-invalid={!!formErrors.password}
                        aria-describedby={
                          formErrors.password
                            ? 'password-error'
                            : 'password-strength'
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {password && (
                      <div className="space-y-1" id="password-strength">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Password strength:
                          </span>
                          <span
                            className={cn(
                              'font-medium',
                              strengthInfo.color.replace('bg-', 'text-')
                            )}
                          >
                            {strengthInfo.text}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all duration-300',
                              strengthInfo.color
                            )}
                            style={{ width: strengthInfo.width }}
                            role="progressbar"
                            aria-valuenow={passwordStrength * 25}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                    )}

                    {formErrors.password && (
                      <p
                        id="password-error"
                        className="text-xs text-destructive flex items-center gap-1 mt-1"
                        role="alert"
                      >
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.password}
                      </p>
                    )}
                  </div>
                )}

                {signInMethod === 'magic-link' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex gap-3">
                      <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                          Passwordless Sign In
                        </p>
                        <p className="text-blue-700 dark:text-blue-300">
                          We&apos;ll send a secure link to your registered
                          email. No password needed!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(checked as boolean)
                      }
                      aria-label="Remember me"
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Remember me
                    </Label>
                  </div>
                  {signInMethod === 'password' && (
                    <Link
                      to="/forgot-password"
                      className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 btn-premium relative overflow-hidden group"
                  disabled={
                    loading ||
                    oauthLoading ||
                    !!formErrors.email ||
                    (signInMethod === 'password' &&
                      (!!formErrors.password || !password))
                  }
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {signInMethod === 'magic-link'
                        ? 'Sending magic link...'
                        : 'Signing in...'}
                    </>
                  ) : (
                    <>
                      {signInMethod === 'magic-link' ? (
                        <>
                          <Mail className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                          Send Magic Link
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
                          Sign In
                        </>
                      )}
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            // Magic Link Sent State
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center animate-scale-in">
                <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Check Your Email
              </h3>
              <p className="text-muted-foreground mb-6">
                We&apos;ve sent a magic link to{' '}
                <strong className="text-foreground">{email}</strong>
              </p>
              <div className="space-y-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-foreground mb-1">
                      What to do next:
                    </p>
                    <ol className="space-y-1 text-xs list-decimal list-inside">
                      <li>Check your email inbox</li>
                      <li>Click the magic link in the email</li>
                      <li>You&apos;ll be automatically signed in</li>
                    </ol>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  The link expires in 60 minutes
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMagicLinkSent(false);
                    setEmail('');
                  }}
                >
                  Use different email
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleMagicLinkSignIn}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    'Resend link'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Don&apos;t see the email? Check your spam folder.
              </p>
            </div>
          )}

          {!magicLinkSent && (
            <>
              {/* Sign Up Link */}
              <div className="mt-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link
                    to="/signup"
                    className="text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  >
                    Create one now
                  </Link>
                </p>
              </div>

              {/* Support Link */}
              <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Need help?{' '}
                  <Link
                    to="/contact"
                    className="text-secondary hover:underline focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 rounded"
                  >
                    Contact Support
                  </Link>
                </p>
              </div>

              {/* Security Notice */}
              <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">
                      Your security matters
                    </p>
                    <p>
                      We use industry-standard encryption to protect your
                      data. Your information is never shared with third
                      parties.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add animation styles */}
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

export default SignIn;
