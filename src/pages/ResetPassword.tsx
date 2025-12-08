import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Lock,
  ArrowLeft,
  Shield,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  X,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Password strength evaluation
const evaluatePasswordStrength = (password: string) => {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  if (!password) return { score: 0, label: '', color: '', checks };

  let score = 0;

  if (checks.length) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;

  const strength = {
    0: { label: 'Very Weak', color: 'bg-red-500' },
    1: { label: 'Weak', color: 'bg-red-400' },
    2: { label: 'Fair', color: 'bg-orange-400' },
    3: { label: 'Good', color: 'bg-yellow-400' },
    4: { label: 'Strong', color: 'bg-green-400' },
    5: { label: 'Very Strong', color: 'bg-green-500' },
  };

  return { score, ...strength[score as keyof typeof strength], checks };
};

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(
    evaluatePasswordStrength('')
  );
  const [resetSuccess, setResetSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('🔓 ResetPassword component mounted');
        console.log('URL params:', Object.fromEntries(searchParams));

        // Check for error parameters in URL
        const error = searchParams.get('error');
        const errorCode = searchParams.get('error_code');
        const errorDescription = searchParams.get('error_description');

        if (error || errorCode) {
          let message = errorDescription
            ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
            : 'Invalid or expired password reset link';

          if (errorCode === 'otp_expired') {
            message =
              'Your password reset link has expired. Please request a new one.';
          }

          console.error(
            '❌ Password reset error:',
            error,
            errorCode,
            message
          );

          toast({
            title: 'Link Expired',
            description: message,
            variant: 'destructive',
          });

          setIsValidSession(false);
          setTimeout(() => navigate('/forgot-password'), 3000);
          return;
        }

        // Check for recovery type parameter
        const type = searchParams.get('type');

        if (type === 'recovery') {
          console.log('🔓 Password recovery flow detected');
        }

        // Check if user has a valid session (should be set by AuthCallback)
        console.log('📋 Checking for valid session...');
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          toast({
            title: 'Session Error',
            description:
              'Unable to verify your session. Please request a new reset link.',
            variant: 'destructive',
          });
          setIsValidSession(false);
          setTimeout(() => navigate('/forgot-password'), 3000);
          return;
        }

        if (session) {
          console.log('✅ Valid session found for password reset');
          console.log('User ID:', session.user.id);
          console.log(
            'Session expires at:',
            new Date(session.expires_at || 0).toLocaleString()
          );
          setIsValidSession(true);
        } else {
          console.log('❌ No valid session found');
          toast({
            title: 'Invalid Session',
            description:
              'Your session has expired. Please request a new password reset link.',
            variant: 'destructive',
          });
          setIsValidSession(false);
          setTimeout(() => navigate('/forgot-password'), 3000);
        }
      } catch (err) {
        console.error('❌ Unexpected error in checkSession:', err);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        });
        setIsValidSession(false);
        setTimeout(() => navigate('/forgot-password'), 3000);
      }
    };

    checkSession();
  }, [navigate, toast, searchParams]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordStrength(evaluatePasswordStrength(value));
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔐 Attempting password reset...');

    // Validate passwords
    const validation = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: 'Validation Error',
        description: firstError.message,
        variant: 'destructive',
      });
      return;
    }

    // Check password strength - STRICT requirement for password reset
    if (passwordStrength.score < 3) {
      toast({
        title: 'Weak Password',
        description:
          'Please choose a stronger password with uppercase, lowercase, numbers, and special characters.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Verify session one more time before updating
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.error('❌ No session available for password update');
        toast({
          title: 'Session Expired',
          description:
            'Your session has expired. Please request a new password reset link.',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/forgot-password'), 2000);
        return;
      }

      console.log('📝 Updating password...');
      const { error } = await supabase.auth.updateUser({
        password: validation.data.password,
      });

      if (error) {
        let errorMessage = error.message;
        let errorTitle = 'Password Reset Failed';

        console.error('❌ Password update error:', error);

        // Enhanced error messages
        if (
          error.message.includes('same as the old password') ||
          error.message.includes('New password should be different')
        ) {
          errorMessage =
            'New password must be different from your old password.';
          errorTitle = 'Same Password';
        } else if (error.message.includes('Password should be')) {
          errorMessage =
            'Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters.';
          errorTitle = 'Weak Password';
        } else if (
          error.message.includes('session') ||
          error.message.includes('token')
        ) {
          errorMessage =
            'Your session has expired. Please request a new password reset link.';
          errorTitle = 'Session Expired';
          setTimeout(() => navigate('/forgot-password'), 2000);
        } else if (error.message.includes('not authenticated')) {
          errorMessage =
            'Authentication failed. Please request a new password reset link.';
          errorTitle = 'Authentication Error';
          setTimeout(() => navigate('/forgot-password'), 2000);
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        // Success!
        console.log('✅ Password reset successful');
        setResetSuccess(true);

        toast({
          title: 'Password Reset Successful! 🎉',
          description:
            'Your password has been updated. Redirecting to sign in...',
        });

        // Sign out to ensure user signs in with new password
        console.log('🚪 Signing out user...');
        await supabase.auth.signOut();

        setTimeout(() => {
          navigate('/signin', {
            state: {
              message:
                'Password reset successful! You can now sign in with your new password.',
            },
          });
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Unexpected password reset error:', error);
      toast({
        title: 'Error',
        description:
          error?.message ||
          'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">
            Verifying your password reset link...
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            This may take a few seconds
          </p>
        </div>
      </div>
    );
  }

  // Invalid session
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Invalid Reset Link</h2>
          <p className="text-muted-foreground mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Button
            onClick={() => navigate('/forgot-password')}
            className="w-full"
          >
            Request New Link
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center animate-scale-in">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-green-600 dark:text-green-400">
            Password Reset Successful!
          </h2>
          <p className="text-muted-foreground mb-6">
            Your password has been updated. Redirecting you to sign in...
          </p>
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="mb-8">
            <Link
              to="/signin"
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6 group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Sign In
            </Link>

            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">
              Reset Your Password
            </h2>
            <p className="text-muted-foreground text-center text-sm sm:text-base">
              Choose a new strong password for your account
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-6">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                New Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  autoFocus
                  className="pl-10 pr-10 h-12"
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

              {/* Password Strength Meter */}
              {password && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Password Strength:
                    </span>
                    <span
                      className={cn(
                        'font-medium',
                        passwordStrength.score >= 4
                          ? 'text-green-600'
                          : passwordStrength.score >= 3
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      )}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        passwordStrength.color
                      )}
                      style={{
                        width: `${(passwordStrength.score / 5) * 100}%`,
                      }}
                      role="progressbar"
                      aria-valuenow={passwordStrength.score * 20}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>

                  {/* Password Requirements */}
                  <div className="text-xs space-y-1 mt-3 p-3 bg-muted/50 rounded-lg">
                    <p className="font-medium mb-2">Password must contain:</p>
                    <div
                      className={cn(
                        'flex items-center gap-2',
                        passwordStrength.checks?.length
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {passwordStrength.checks?.length ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      At least 8 characters
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-2',
                        passwordStrength.checks?.uppercase
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {passwordStrength.checks?.uppercase ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      One uppercase letter
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-2',
                        passwordStrength.checks?.lowercase
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {passwordStrength.checks?.lowercase ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      One lowercase letter
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-2',
                        passwordStrength.checks?.number
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {passwordStrength.checks?.number ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      One number
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-2',
                        passwordStrength.checks?.special
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {passwordStrength.checks?.special ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      One special character
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm New Password{' '}
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  className={cn(
                    'pl-10 pr-10 h-12',
                    confirmPassword &&
                      password !== confirmPassword &&
                      'border-destructive'
                  )}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
                {confirmPassword && password === confirmPassword && (
                  <CheckCircle2 className="absolute right-10 top-3 h-4 w-4 text-green-500" />
                )}
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Passwords do not match
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 btn-premium"
              disabled={
                loading ||
                passwordStrength.score < 3 ||
                password !== confirmPassword ||
                !password
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  Security Tips
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Use a unique password you don&apos;t use elsewhere</li>
                  <li>Avoid common words and personal information</li>
                  <li>Consider using a password manager</li>
                </ul>
              </div>
            </div>
          </div>
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

export default ResetPassword;
