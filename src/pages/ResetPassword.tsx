import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(72),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user came from password reset email
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      } else {
        toast({
          title: "Invalid Session",
          description: "Please request a new password reset link",
          variant: "destructive",
        });
        navigate('/forgot-password');
      }
    });
  }, [navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    const validation = resetPasswordSchema.safeParse({ password, confirmPassword });
    
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
      const { error } = await supabase.auth.updateUser({
        password: validation.data.password,
      });

      if (error) {
        toast({
          title: "Password Reset Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. Redirecting to sign in...",
        });
        setTimeout(() => {
          navigate('/signin');
        }, 2000);
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

  if (!isValidSession) {
    return null;
  }

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
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Reset Your Password</h2>
            <p className="text-muted-foreground text-center text-sm sm:text-base">
              Choose a new strong password for your account
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={72}
                  className="pl-10 h-12"
                />
              </div>
              <p className="text-xs text-muted-foreground">Must be at least 6 characters long</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={72}
                  className="pl-10 h-12"
                />
              </div>
            </div>
            
            <Button type="submit" className="w-full h-12 btn-premium" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
