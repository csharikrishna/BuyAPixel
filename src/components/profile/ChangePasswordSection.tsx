import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, X, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Password strength evaluation (shared logic with ResetPassword)
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

  const strength: Record<number, { label: string; color: string }> = {
    0: { label: 'Very Weak', color: 'bg-red-500' },
    1: { label: 'Weak', color: 'bg-red-400' },
    2: { label: 'Fair', color: 'bg-orange-400' },
    3: { label: 'Good', color: 'bg-yellow-400' },
    4: { label: 'Strong', color: 'bg-green-400' },
    5: { label: 'Very Strong', color: 'bg-green-500' },
  };

  return { score, ...strength[score], checks };
};

export const ChangePasswordSection = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = evaluatePasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const isValid = passwordStrength.score >= 3 && passwordsMatch && newPassword.length >= 8;

  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error('Please fix the form errors before saving');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        let errorMessage = error.message;
        let errorTitle = 'Password Change Failed';

        if (
          error.message.includes('same as the old password') ||
          error.message.includes('New password should be different')
        ) {
          errorMessage = 'New password must be different from your current password.';
          errorTitle = 'Same Password';
        } else if (error.message.includes('Password should be')) {
          errorMessage = 'Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters.';
          errorTitle = 'Weak Password';
        }

        toast.error(errorTitle, { description: errorMessage });
        return;
      }

      setSuccess(true);
      toast.success('Password changed successfully!', {
        description: 'Your new password is now active.',
      });

      // Reset form
      setNewPassword('');
      setConfirmPassword('');

      // Cooldown to prevent rapid attempts
      setCooldown(true);
      setTimeout(() => {
        setCooldown(false);
        setSuccess(false);
      }, 30000);
    } catch (error: unknown) {
      console.error('Password change error:', error);
      toast.error('Failed to change password', {
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [isValid, newPassword]);

  return (
    <Card className="border-purple-200 dark:border-purple-500/20 bg-white dark:bg-gray-900 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your password to keep your account secure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-semibold text-green-700 dark:text-green-300">Password Updated!</p>
            <p className="text-sm text-muted-foreground mt-1">Your new password is now active.</p>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">
                New Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  className="pl-10 pr-10"
                  disabled={cooldown}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Strength:</span>
                    <span className={cn(
                      'font-medium',
                      passwordStrength.score >= 4 ? 'text-green-600' :
                      passwordStrength.score >= 3 ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all duration-300', passwordStrength.color)}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                    {[
                      { key: 'length', label: '8+ characters' },
                      { key: 'uppercase', label: 'Uppercase' },
                      { key: 'lowercase', label: 'Lowercase' },
                      { key: 'number', label: 'Number' },
                      { key: 'special', label: 'Special char' },
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        className={cn(
                          'flex items-center gap-1.5',
                          passwordStrength.checks?.[key as keyof typeof passwordStrength.checks]
                            ? 'text-green-600' : 'text-muted-foreground'
                        )}
                      >
                        {passwordStrength.checks?.[key as keyof typeof passwordStrength.checks] ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 shrink-0" />
                        )}
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm New Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  className={cn(
                    'pl-10 pr-10',
                    confirmPassword && !passwordsMatch && 'border-destructive'
                  )}
                  disabled={cooldown}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {confirmPassword && passwordsMatch && (
                  <CheckCircle2 className="absolute right-10 top-3 h-4 w-4 text-green-500" />
                )}
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Passwords do not match
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !isValid || cooldown}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : cooldown ? (
                'Please wait before trying again'
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
