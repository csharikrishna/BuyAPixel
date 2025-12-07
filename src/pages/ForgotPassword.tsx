import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
});

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const validation = forgotPasswordSchema.safeParse({ email });
    
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Password Reset Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setEmailSent(true);
        toast({
          title: "Password Reset Email Sent",
          description: "Please check your email for the password reset link.",
          duration: 6000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="mb-8">
            <Link to="/signin" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign In
            </Link>
            
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
                <KeyRound className="h-8 w-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Forgot Password?</h2>
            <p className="text-muted-foreground text-center text-sm sm:text-base">
              {emailSent 
                ? "Check your email for the reset link" 
                : "Enter your email to receive a password reset link"}
            </p>
          </div>

          {!emailSent ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-12"
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full h-12 btn-premium" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                <p className="text-sm text-success text-center">
                  ✓ Password reset email sent successfully!
                </p>
              </div>
              <Button 
                onClick={() => setEmailSent(false)} 
                variant="outline" 
                className="w-full"
              >
                Send Another Email
              </Button>
            </div>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link to="/signin" className="text-primary hover:underline font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
