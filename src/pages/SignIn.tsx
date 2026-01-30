import { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Clock,
  Info,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { cn, getErrorMessage } from '@/lib/utils';

// ======================
// TYPES & CONSTANTS
// ======================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes [web:89]
const RATE_LIMIT_DURATION_MS = 5 * 1000; // 5 seconds between attempts [web:93]
const PASSWORD_MIN_LENGTH = 8; // Updated from 6 for better security [web:95]

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address' })
    .max(100, 'Email must be less than 100 characters'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    }),
});

interface LocationState {
  from?: {
    pathname: string;
  };
}

interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

interface FormErrors {
  email?: string;
  password?: string;
}

type SignInMethod = 'password' | 'magic-link';
type AuthPhase = 'idle' | 'loading' | 'success' | 'error';

// ======================
// UTILITY FUNCTIONS
// ======================

const formatLockoutTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getPasswordStrengthInfo = (password: string, strength: number) => {
  if (!password || strength === 0)
    return { color: 'bg-gray-200', text: '', width: 0, textColor: 'text-gray-500' };
  if (strength === 1)
    return {
      color: 'bg-red-500',
      text: 'Weak',
      width: 25,
      textColor: 'text-red-600',
    };
  if (strength === 2)
    return {
      color: 'bg-orange-500',
      text: 'Fair',
      width: 50,
      textColor: 'text-orange-600',
    };
  if (strength === 3)
    return {
      color: 'bg-yellow-500',
      text: 'Good',
      width: 75,
      textColor: 'text-yellow-600',
    };
  return {
    color: 'bg-green-500',
    text: 'Strong',
    width: 100,
    textColor: 'text-green-600',
  };
};

// ======================
// MAIN COMPONENT
// ======================

const SignIn = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Refs
  const typingTimerRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // React 19 hooks
  const [isPending, startTransition] = useTransition();

  // State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('password');
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt>({
    count: 0,
    lastAttempt: 0,
    lockedUntil: null,
  });
  const [timeUntilUnlock, setTimeUntilUnlock] = useState(0);
  const [authPhase, setAuthPhase] = useState<AuthPhase>('idle');
  const [isVisible, setIsVisible] = useState(false);

  const from = (location.state as LocationState | null)?.from?.pathname || '/';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  // Trigger entrance animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Load login attempts from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('login_attempts');
    if (stored) {
      try {
        const attempts: LoginAttempt = JSON.parse(stored);
        const now = Date.now();

        if (attempts.lockedUntil && attempts.lockedUntil < now) {
          const resetAttempts = { count: 0, lastAttempt: 0, lockedUntil: null };
          setLoginAttempts(resetAttempts);
          localStorage.setItem('login_attempts', JSON.stringify(resetAttempts));
        } else {
          setLoginAttempts(attempts);
        }
      } catch (e) {
        console.error('Failed to parse login attempts:', e);
      }
    }
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!loginAttempts.lockedUntil) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = loginAttempts.lockedUntil! - now;

      if (remaining <= 0) {
        const resetAttempts = { count: 0, lastAttempt: 0, lockedUntil: null };
        setLoginAttempts(resetAttempts);
        localStorage.setItem('login_attempts', JSON.stringify(resetAttempts));
        setTimeUntilUnlock(0);
      } else {
        setTimeUntilUnlock(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loginAttempts.lockedUntil]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Load remembered email
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Handle URL errors
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const errorCode = params.get('error_code');

    if (error || errorCode) {
      handleAuthError(error, errorDescription, errorCode);
      window.history.replaceState({}, '', '/signin');
    }
  }, [location]);

  const handleAuthError = useCallback(
    (error: string | null, errorDescription: string | null, errorCode: string | null) => {
      let title = 'Sign In Error';
      let message = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        : 'Authentication failed';

      const errorMap: Record<string, { title: string; message: string }> = {
        otp_expired: {
          title: 'Link Expired',
          message: 'Your sign-in link has expired. Please request a new one.',
        },
        access_denied: {
          title: 'Access Denied',
          message: 'Authentication was cancelled or denied.',
        },
        email_not_confirmed: {
          title: 'Email Not Confirmed',
          message: 'Please confirm your email address. Check your inbox for the confirmation link.',
        },
        invalid_credentials: {
          title: 'Invalid Credentials',
          message: 'The email or password you entered is incorrect.',
        },
      };

      if (errorCode && errorMap[errorCode]) {
        title = errorMap[errorCode].title;
        message = errorMap[errorCode].message;
      }

      toast({ title, description: message, variant: 'destructive' });
    },
    [toast]
  );

  // Email validation [web:94]
  const validateEmail = useCallback((value: string) => {
    if (!value) return '';
    const trimmed = value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed) ? '' : 'Please enter a valid email address';
  }, []);

  // Password strength calculation [web:95]
  const calculatePasswordStrength = useCallback((pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    return Math.min(strength, 4);
  }, []);

  // Email change handler [web:94]
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      setIsTyping(true);
      setMagicLinkSent(false);

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      startTransition(() => {
        typingTimerRef.current = setTimeout(() => {
          const error = validateEmail(value);
          setFormErrors((prev) => ({ ...prev, email: error }));
          setIsTyping(false);
        }, 500);
      });
    },
    [validateEmail]
  );

  // Password change handler
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPassword(value);
      setPasswordStrength(calculatePasswordStrength(value));

      if (value.length > 0 && value.length < PASSWORD_MIN_LENGTH) {
        setFormErrors((prev) => ({
          ...prev,
          password: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
        }));
      } else {
        setFormErrors((prev) => ({ ...prev, password: '' }));
      }
    },
    [calculatePasswordStrength]
  );

  // Rate limit check [web:89][web:93]
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();

    if (loginAttempts.lockedUntil && loginAttempts.lockedUntil > now) {
      const remainingMinutes = Math.ceil((loginAttempts.lockedUntil - now) / 60000);
      toast({
        title: 'Account Temporarily Locked',
        description: `Too many failed attempts. Please try again in ${remainingMinutes} minute${
          remainingMinutes > 1 ? 's' : ''
        }.`,
        variant: 'destructive',
      });
      return false;
    }

    if (now - loginAttempts.lastAttempt < RATE_LIMIT_DURATION_MS && loginAttempts.count > 0) {
      const remainingSeconds = Math.ceil(
        (RATE_LIMIT_DURATION_MS - (now - loginAttempts.lastAttempt)) / 1000
      );
      toast({
        title: 'Please Wait',
        description: `Please wait ${remainingSeconds} seconds before trying again.`,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  }, [loginAttempts, toast]);

  // Record failed attempt [web:89]
  const recordFailedAttempt = useCallback(() => {
    const now = Date.now();
    const newCount = loginAttempts.count + 1;

    let newAttempts: LoginAttempt = {
      count: newCount,
      lastAttempt: now,
      lockedUntil: null,
    };

    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      newAttempts.lockedUntil = now + LOCKOUT_DURATION_MS;
      toast({
        title: 'Account Locked',
        description: `Too many failed login attempts. Your account is locked for 15 minutes.`,
        variant: 'destructive',
      });
    } else {
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newCount;
      toast({
        title: 'Invalid Credentials',
        description: `Incorrect email or password. ${remainingAttempts} attempt${
          remainingAttempts > 1 ? 's' : ''
        } remaining.`,
        variant: 'destructive',
      });
    }

    setLoginAttempts(newAttempts);
    localStorage.setItem('login_attempts', JSON.stringify(newAttempts));
  }, [loginAttempts.count, toast]);

  // Reset login attempts
  const resetLoginAttempts = useCallback(() => {
    const resetAttempts = { count: 0, lastAttempt: 0, lockedUntil: null };
    setLoginAttempts(resetAttempts);
    localStorage.setItem('login_attempts', JSON.stringify(resetAttempts));
  }, []);

  // Password sign in handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signInMethod === 'magic-link') {
      handleMagicLinkSignIn();
      return;
    }

    if (!checkRateLimit()) {
      return;
    }

    const validation = signInSchema.safeParse({ email, password });

    if (!validation.success) {
      const errors: FormErrors = {};
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
    setAuthPhase('loading');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) {
        if (
          !error.message.includes('Invalid login credentials') &&
          !error.message.includes('Email not confirmed')
        ) {
          console.error('Sign in error:', error);
        }

        recordFailedAttempt();
        setAuthPhase('error');

        const errorMessages: Record<string, string> = {
          'Invalid login credentials':
            'Invalid email or password. Please check your credentials and try again.',
          'Email not confirmed': 'Please confirm your email address before signing in.',
          'too many requests': 'Too many login attempts. Please wait a few minutes.',
          'User not found': 'No account found with this email. Please sign up first.',
        };

        let errorMessage = error.message;
        for (const [key, value] of Object.entries(errorMessages)) {
          if (error.message.includes(key)) {
            errorMessage = value;
            break;
          }
        }

        if (!error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Sign In Failed',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      } else {
        resetLoginAttempts();
        setAuthPhase('success');

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
    } catch (error: unknown) {
      console.error('Unexpected sign in error:', error);
      setAuthPhase('error');
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Magic link sign in handler [web:94][web:97]
  const handleMagicLinkSignIn = async () => {
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
    setAuthPhase('loading');

    try {
      const redirectUrl =
        from !== '/'
          ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(from)}`
          : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: false,
        },
      });

      if (error) {
        console.error('Magic link error:', error);
        setAuthPhase('error');

        const errorMessages: Record<string, { title: string; message: string }> = {
          'rate limit': {
            title: 'Rate Limit Exceeded',
            message: 'Too many requests. Please wait a few minutes before trying again.',
          },
          'User not found': {
            title: 'Account Not Found',
            message: 'No account found with this email. Please sign up first.',
          },
          'For security purposes': {
            title: 'Rate Limit',
            message: 'Please wait 60 seconds before requesting another link.',
          },
        };

        let errorTitle = 'Failed to Send Link';
        let errorMessage = error.message;

        for (const [key, value] of Object.entries(errorMessages)) {
          if (error.message.includes(key)) {
            errorTitle = value.title;
            errorMessage = value.message;
            break;
          }
        }

        toast({ title: errorTitle, description: errorMessage, variant: 'destructive' });
      } else {
        setMagicLinkSent(true);
        setAuthPhase('success');

        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        }

        toast({
          title: 'Check Your Email! 📧',
          description: `We've sent a magic link to ${email}. Click the link to sign in.`,
          duration: 6000,
        });
      }
    } catch (error: unknown) {
      console.error('Unexpected magic link error:', error);
      setAuthPhase('error');
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to send magic link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Google OAuth handler [web:89]
  const handleGoogleSignIn = async () => {
    try {
      setOauthLoading(true);

      const redirectUrl =
        from !== '/'
          ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(from)}`
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

        const errorMessages: Record<string, string> = {
          redirect: 'OAuth configuration error. Please contact support.',
          'not enabled': 'Google authentication is not enabled. Please use email/password.',
          network: 'Network error. Please check your connection.',
        };

        let errorMessage = error.message;
        for (const [key, value] of Object.entries(errorMessages)) {
          if (error.message.includes(key)) {
            errorMessage = value;
            break;
          }
        }

        toast({
          title: 'Sign In Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        setOauthLoading(false);
      }

      setTimeout(() => setOauthLoading(false), 10000);
    } catch (error: unknown) {
      console.error('Unexpected Google OAuth error:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to initiate Google sign-in.',
        variant: 'destructive',
      });
      setOauthLoading(false);
    }
  };

  // Memoized values
  const strengthInfo = useMemo(
    () => getPasswordStrengthInfo(password, passwordStrength),
    [password, passwordStrength]
  );

  const isAccountLocked = useMemo(
    () => loginAttempts.lockedUntil && loginAttempts.lockedUntil > Date.now(),
    [loginAttempts.lockedUntil]
  );

  const formattedLockoutTime = useMemo(
    () => (timeUntilUnlock > 0 ? formatLockoutTime(timeUntilUnlock) : ''),
    [timeUntilUnlock]
  );

  // Schema.org structured data
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Sign In - BuyAPixel',
      description: 'Sign in to your BuyAPixel account',
      url: 'https://buyapixel.in/signin',
    }),
    []
  );

  return (
    <>
      <Helmet>
        <title>Sign In - BuyAPixel | Access Your Pixel Portfolio</title>
        <meta
          name="description"
          content="Sign in to BuyAPixel to manage your digital pixels, track your portfolio, and connect with the community. Secure authentication with multiple options."
        />
        <meta property="og:title" content="Sign In - BuyAPixel" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Sign in to your BuyAPixel account" />
        <link rel="canonical" href="https://buyapixel.in/signin" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* Left Side - Hero/Branding */}
        <div
          className={cn(
            'hidden lg:flex relative overflow-hidden bg-primary/5 items-center justify-center p-12 transition-all duration-700',
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          )}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent via-secondary to-primary opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-white/10 blur-3xl animate-pulse" />
            <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-white/5 blur-3xl animate-pulse delay-1000" />
            <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] rounded-full bg-indigo-500/20 blur-2xl animate-pulse delay-500" />
          </div>

          {/* Content */}
          <div className="relative z-10 text-white max-w-lg w-full">
            <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
              <Sparkles className="w-4 h-4 text-yellow-300" aria-hidden="true" />
              <span className="text-xs font-medium tracking-wide uppercase">
                Return to the Canvas
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Welcome Back to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">
                BuyAPixel
              </span>
            </h1>

            <p className="text-lg text-white/80 mb-10 leading-relaxed font-light">
              Manage your digital real estate, track your portfolio performance, and connect with the
              pixel art community.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="group bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors p-5 rounded-2xl border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-yellow-300" aria-hidden="true" />
                </div>
                <h3 className="font-semibold mb-1">Fast Performance</h3>
                <p className="text-xs text-white/60">Optimized dashboard experience</p>
              </div>

              <div className="group bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors p-5 rounded-2xl border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400/20 to-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="w-5 h-5 text-blue-300" aria-hidden="true" />
                </div>
                <h3 className="font-semibold mb-1">Secure Account</h3>
                <p className="text-xs text-white/60">Enterprise-grade protection</p>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-4 text-sm text-white/50">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-primary bg-white/10 backdrop-blur-sm"
                  />
                ))}
              </div>
              <p>Join thousands of pixel owners</p>
            </div>
          </div>
        </div>

        {/* Right Side - Sign In Form */}
        <div className="flex items-center justify-center bg-background px-4 sm:px-8 py-8 lg:py-0">
          <div
            className={cn(
              'w-full max-w-md transition-all duration-700 delay-200',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <div className="mb-6">
              <Link
                to="/"
                className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors group mb-6"
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

            {/* Lockout Warning */}
            {isAccountLocked && (
              <Alert variant="destructive" className="mb-4" role="alert">
                <Ban className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Account Temporarily Locked</AlertTitle>
                <AlertDescription>
                  Too many failed login attempts. Please try again in {formattedLockoutTime}.
                </AlertDescription>
              </Alert>
            )}

            {/* Warning for multiple attempts */}
            {loginAttempts.count > 0 &&
              loginAttempts.count < MAX_LOGIN_ATTEMPTS &&
              !isAccountLocked && (
                <Alert className="mb-4 border-yellow-500" role="alert">
                  <AlertCircle className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                  <AlertTitle className="text-yellow-700 dark:text-yellow-400">Warning</AlertTitle>
                  <AlertDescription className="text-yellow-600 dark:text-yellow-300">
                    {MAX_LOGIN_ATTEMPTS - loginAttempts.count} attempt
                    {MAX_LOGIN_ATTEMPTS - loginAttempts.count > 1 ? 's' : ''} remaining before
                    account lockout.
                  </AlertDescription>
                </Alert>
              )}

            {!magicLinkSent ? (
              <>
                {/* Google Sign In */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 mb-4"
                  onClick={handleGoogleSignIn}
                  disabled={oauthLoading || loading || !!isAccountLocked}
                  aria-label="Sign in with Google"
                >
                  {oauthLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Chrome className="mr-2 h-4 w-4" aria-hidden="true" />
                      Continue with Google
                    </>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>

                {/* Sign In Method Toggle [web:97] */}
                <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={signInMethod === 'password'}
                    aria-controls="password-panel"
                    onClick={() => {
                      setSignInMethod('password');
                      setMagicLinkSent(false);
                    }}
                    disabled={!!isAccountLocked}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
                      signInMethod === 'password' ? 'bg-background shadow-sm' : 'hover:bg-background/50',
                      isAccountLocked && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Lock className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
                    Password
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={signInMethod === 'magic-link'}
                    aria-controls="magic-link-panel"
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
                    <Mail className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
                    Magic Link
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSignIn} className="space-y-3" noValidate>
                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">
                      Email Address
                      <span className="text-destructive ml-1" aria-label="required">
                        *
                      </span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="relative flex-1">
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={handleEmailChange}
                          required
                          autoComplete="email"
                          disabled={!!isAccountLocked || isPending}
                          className={cn('h-11 pr-8', formErrors.email && 'border-destructive')}
                          aria-invalid={!!formErrors.email}
                          aria-describedby={formErrors.email ? 'email-error' : undefined}
                        />
                        {!isTyping && email && !formErrors.email && (
                          <CheckCircle2
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500"
                            aria-hidden="true"
                          />
                        )}
                        {formErrors.email && (
                          <AlertCircle
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                    {formErrors.email && (
                      <p
                        id="email-error"
                        className="text-xs text-destructive flex items-center gap-1"
                        role="alert"
                      >
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Password Field (conditional) */}
                  {signInMethod === 'password' && (
                    <div className="space-y-1.5" id="password-panel" role="tabpanel">
                      <Label htmlFor="password">
                        Password
                        <span className="text-destructive ml-1" aria-label="required">
                          *
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted">
                          <Lock className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="relative flex-1">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={password}
                            onChange={handlePasswordChange}
                            required
                            autoComplete="current-password"
                            disabled={!!isAccountLocked}
                            className={cn('h-11 pr-9', formErrors.password && 'border-destructive')}
                            aria-invalid={!!formErrors.password}
                            aria-describedby={formErrors.password ? 'password-error' : undefined}
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{showPassword ? 'Hide password' : 'Show password'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* Password Strength [web:95] */}
                      {password && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Password strength:</span>
                            <span className={cn('font-medium', strengthInfo.textColor)}>
                              {strengthInfo.text}
                            </span>
                          </div>
                          <Progress value={strengthInfo.width} className="h-1.5" />
                        </div>
                      )}

                      {formErrors.password && (
                        <p
                          id="password-error"
                          className="text-xs text-destructive flex items-center gap-1"
                          role="alert"
                        >
                          <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          {formErrors.password}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Magic Link Info [web:97] */}
                  {signInMethod === 'magic-link' && (
                    <div
                      className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200"
                      id="magic-link-panel"
                      role="tabpanel"
                    >
                      <div className="flex gap-3">
                        <Mail
                          className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div className="text-sm">
                          <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Passwordless Sign In
                          </p>
                          <p className="text-blue-700 dark:text-blue-300">
                            We'll send a secure link to your registered email. No password needed!
                            [web:97]
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        disabled={!!isAccountLocked}
                        aria-label="Remember my email"
                      />
                      <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                    {signInMethod === 'password' && (
                      <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                        Forgot password?
                      </Link>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-11 mt-1"
                    disabled={
                      loading ||
                      oauthLoading ||
                      !!isAccountLocked ||
                      !!formErrors.email ||
                      (signInMethod === 'password' && (!!formErrors.password || !password))
                    }
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        {signInMethod === 'magic-link' ? 'Sending...' : 'Signing in...'}
                      </>
                    ) : (
                      <>
                        {signInMethod === 'magic-link' ? (
                          <>
                            <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                            Send Magic Link
                          </>
                        ) : (
                          <>
                            <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
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
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Check Your Email!</h3>
                <p className="text-muted-foreground mb-4">
                  We've sent a magic link to <strong className="text-foreground">{email}</strong>
                </p>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" onClick={() => setMagicLinkSent(false)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleMagicLinkSignIn}
                    disabled={loading}
                    className="text-primary"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Resend Link
                  </Button>
                </div>
              </div>
            )}

            {/* Sign Up Link & Support */}
            {!magicLinkSent && (
              <>
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-primary hover:underline font-medium">
                      Create one now
                    </Link>
                  </p>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-primary mt-0.5" aria-hidden="true" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Your security matters</p>
                      <p>
                        Account protection: {MAX_LOGIN_ATTEMPTS} login attempts allowed. Lockout
                        duration: 15 minutes. [web:89]
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SignIn;
