import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, KeyRound, CheckCircle2, AlertCircle, Shield, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
});

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  // Real-time email validation
  const validateEmail = useCallback((value: string) => {
    if (!value) {
      setEmailError('');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setIsTyping(true);
    setEmailSent(false); // Reset sent state when email changes
    
    // Debounced validation
    setTimeout(() => {
      validateEmail(value);
      setIsTyping(false);
    }, 500);
  };

  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate email
    const validation = forgotPasswordSchema.safeParse({ email });
    
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      setEmailError(firstError.message);
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Sending password reset email to:', email);
      
      // Use auth/callback which will handle the redirect
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Password reset error:', error);
        
        let errorMessage = error.message;
        let errorTitle = "Password Reset Failed";
        
        // Enhanced error messages
        if (error.message.includes('rate limit') || error.message.includes('Email rate limit exceeded')) {
          errorMessage = "Too many requests. Please wait a few minutes before trying again.";
          errorTitle = "Rate Limit Exceeded";
        } else if (error.message.includes('User not found')) {
          // Don't reveal if user exists for security
          errorMessage = "If an account exists with this email, you will receive a password reset link.";
          errorTitle = "Check Your Email";
          // Still show success state for security
          setEmailSent(true);
        } else if (error.message.includes('Invalid email')) {
          errorMessage = "Please provide a valid email address.";
          errorTitle = "Invalid Email";
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = "Your email is not confirmed. Please check your inbox for the confirmation email first.";
          errorTitle = "Email Not Confirmed";
        } else if (error.message.includes('For security purposes')) {
          errorMessage = "For security reasons, please wait 60 seconds before requesting another link.";
          errorTitle = "Rate Limit";
        }
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: error.message.includes('User not found') ? "default" : "destructive",
        });
        
        // Set email sent to true even if user not found (security)
        if (error.message.includes('User not found')) {
          setEmailSent(true);
        }
      } else {
        console.log('✅ Password reset email sent successfully');
        setEmailSent(true);
        
        toast({
          title: "Email Sent! 📧",
          description: "Please check your email for the password reset link.",
          duration: 6000,
        });
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle resend
  const handleResend = async () => {
    setEmailSent(false);
    // Wait a moment for state to update, then resend
    setTimeout(() => {
      handleResetPassword();
    }, 100);
  };

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
                <KeyRound className="h-8 w-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">
              {emailSent ? "Check Your Email" : "Forgot Password?"}
            </h2>
            <p className="text-muted-foreground text-center text-sm sm:text-base">
              {emailSent 
                ? "We've sent you a password reset link" 
                : "Enter your email to receive a password reset link"}
            </p>
          </div>

          {!emailSent ? (
            <>
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={handleEmailChange}
                      required
                      autoComplete="email"
                      autoFocus
                      className={cn(
                        "pl-10 h-12",
                        emailError && "border-destructive focus-visible:ring-destructive"
                      )}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "email-error" : undefined}
                    />
                    {!isTyping && email && !emailError && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                    )}
                    {emailError && (
                      <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {emailError && (
                    <p id="email-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3 w-3" />
                      {emailError}
                    </p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 btn-premium" 
                  disabled={loading || !!emailError || !email}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Reset Link
                    </>
                  )}
                </Button>
              </form>

              {/* Information Box */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      What happens next?
                    </p>
                    <ul className="text-blue-700 dark:text-blue-300 space-y-1 text-xs">
                      <li>• You'll receive an email with a reset link</li>
                      <li>• The link expires in 60 minutes</li>
                      <li>• Click the link to set a new password</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="space-y-4">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center animate-scale-in">
                    <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-center text-muted-foreground mb-6">
                    We've sent a password reset link to <strong className="text-foreground">{email}</strong>
                  </p>
                </div>

                {/* Instructions */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Next Steps:
                  </h3>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">1</span>
                      <span>Check your email inbox</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">2</span>
                      <span>Click the password reset link</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">3</span>
                      <span>Create a new strong password</span>
                    </li>
                  </ol>
                </div>

                {/* Expiry Warning */}
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    The reset link expires in 60 minutes
                  </p>
                </div>

                {/* Didn't receive email */}
                <div className="pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Didn't receive the email?
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={() => {
                        setEmailSent(false);
                        setEmail('');
                      }}
                      variant="outline" 
                      className="w-full"
                    >
                      Try Different Email
                    </Button>
                    <Button 
                      onClick={handleResend}
                      variant="ghost" 
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Resending...
                        </>
                      ) : (
                        'Resend Link'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Check your spam folder if you don't see it
                  </p>
                </div>
              </div>
            </>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link to="/signin" className="text-primary hover:underline font-medium">
                Sign in here
              </Link>
            </p>
          </div>

          {/* Security Notice */}
          {!emailSent && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Security Note</p>
                  <p>
                    For security reasons, we won't confirm whether an account exists with this email.
                    If an account exists, you'll receive a reset link.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Help */}
        {emailSent && (
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Still having trouble?{' '}
              <Link to="/contact" className="text-primary hover:underline">
                Contact Support
              </Link>
            </p>
          </div>
        )}
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

export default ForgotPassword;
