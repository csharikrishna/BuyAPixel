import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Mail, Lock, ArrowLeft, Sparkles, Shield, Zap, 
  Eye, EyeOff, CheckCircle2, AlertCircle, Chrome, KeyRound
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const signInSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Get redirect path from location state
  const from = (location.state as any)?.from?.pathname || '/';

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

  // Check for OAuth errors in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      let message = errorDescription || 'Authentication failed';
      
      if (error === 'auth_failed') {
        message = 'Authentication failed. Please try again.';
      } else if (error === 'unexpected') {
        message = 'An unexpected error occurred during sign in.';
      }

      toast({
        title: "Sign In Error",
        description: message,
        variant: "destructive",
      });

      // Clean up URL
      window.history.replaceState({}, '', '/signin');
    }
  }, [location, toast]);

  // Real-time email validation
  const validateEmail = useCallback((value: string) => {
    if (!value) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? '' : 'Please enter a valid email address';
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
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setIsTyping(true);
    
    // Debounced validation
    setTimeout(() => {
      const error = validateEmail(value);
      setFormErrors(prev => ({ ...prev, email: error }));
      setIsTyping(false);
    }, 500);
  }, [validateEmail]);

  // Handle password change with strength indicator
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
    
    if (value.length > 0 && value.length < 6) {
      setFormErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
    } else {
      setFormErrors(prev => ({ ...prev, password: '' }));
    }
  }, [calculatePasswordStrength]);

  // Sign in with email and password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
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
        // Provide user-friendly error messages
        let errorMessage = error.message;
        let errorTitle = "Sign In Failed";
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = "Please confirm your email address before signing in. Check your inbox for the confirmation link.";
          errorTitle = "Email Not Confirmed";
        } else if (error.message.includes('too many requests')) {
          errorMessage = "Too many login attempts. Please wait a few minutes and try again.";
          errorTitle = "Rate Limit Exceeded";
        }
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        // Save email if remember me is checked
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }
        
        toast({
          title: "Welcome back!",
          description: "You've been successfully signed in.",
        });
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth sign in
  const handleGoogleSignIn = async () => {
    try {
      setOauthLoading(true);
      
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
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
        
        if (error.message.includes('redirect')) {
          errorMessage = 'OAuth redirect configuration error. Please contact support.';
        } else if (error.message.includes('not enabled')) {
          errorMessage = 'Google authentication is not enabled. Please contact support.';
        }
        
        toast({
          title: "Sign In Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setOauthLoading(false);
      }
      // Don't reset loading on success - user is being redirected
    } catch (error) {
      console.error('Unexpected Google OAuth error:', error);
      toast({
        title: "Error",
        description: "Failed to initiate Google sign-in. Please try again.",
        variant: "destructive",
      });
      setOauthLoading(false);
    }
  };

  // Get password strength color and text
  const getPasswordStrengthInfo = () => {
    if (!password || passwordStrength === 0) return { color: 'bg-gray-200', text: '', width: '0%' };
    if (passwordStrength === 1) return { color: 'bg-red-500', text: 'Weak', width: '25%' };
    if (passwordStrength === 2) return { color: 'bg-orange-500', text: 'Fair', width: '50%' };
    if (passwordStrength === 3) return { color: 'bg-yellow-500', text: 'Good', width: '75%' };
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
              Continue your journey in India's first pixel marketplace where creativity meets opportunity.
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Creative Freedom</h3>
                <p className="text-white/80">Express yourself on the digital canvas</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Secure Platform</h3>
                <p className="text-white/80">Your pixels are protected and permanent</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Instant Results</h3>
                <p className="text-white/80">See your pixels live immediately</p>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-sm text-white/70 mb-3">Trusted by creators and businesses</p>
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
            <p className="text-muted-foreground">Sign in to your account to continue</p>
          </div>

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
              <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSignIn} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address
                <span className="text-destructive ml-1" aria-label="required">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  autoComplete="email"
                  className={cn(
                    "pl-10 h-12 transition-all",
                    formErrors.email && "border-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={!!formErrors.email}
                  aria-describedby={formErrors.email ? "email-error" : undefined}
                />
                {!isTyping && email && !formErrors.email && (
                  <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" aria-hidden="true" />
                )}
                {formErrors.email && (
                  <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" aria-hidden="true" />
                )}
              </div>
              {formErrors.email && (
                <p id="email-error" className="text-xs text-destructive flex items-center gap-1 mt-1" role="alert">
                  <AlertCircle className="w-3 h-3" />
                  {formErrors.email}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">
                Password
                <span className="text-destructive ml-1" aria-label="required">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  autoComplete="current-password"
                  className={cn(
                    "pl-10 pr-10 h-12 transition-all",
                    formErrors.password && "border-destructive focus-visible:ring-destructive"
                  )}
                  aria-invalid={!!formErrors.password}
                  aria-describedby={formErrors.password ? "password-error" : "password-strength"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-1" id="password-strength">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password strength:</span>
                    <span className={cn(
                      "font-medium",
                      strengthInfo.color.replace('bg-', 'text-')
                    )}>
                      {strengthInfo.text}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-300", strengthInfo.color)}
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
                <p id="password-error" className="text-xs text-destructive flex items-center gap-1 mt-1" role="alert">
                  <AlertCircle className="w-3 h-3" />
                  {formErrors.password}
                </p>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  aria-label="Remember me"
                />
                <Label 
                  htmlFor="remember" 
                  className="text-sm font-normal cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
              <Link 
                to="/forgot-password" 
                className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                Forgot password?
              </Link>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 btn-premium relative overflow-hidden group" 
              disabled={loading || oauthLoading || !!formErrors.email || !!formErrors.password}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
                  Sign In
                </>
              )}
            </Button>
          </form>
          
          {/* Sign Up Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
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
                <p className="font-medium text-foreground mb-1">Your security matters</p>
                <p>We use industry-standard encryption to protect your data. Your information is never shared with third parties.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
