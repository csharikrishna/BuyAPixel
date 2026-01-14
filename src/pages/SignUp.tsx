import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Mail,
  Lock,
  User,
  Phone,
  Calendar,
  ArrowLeft,
  Star,
  Users,
  Palette,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  AlertCircle,
  Chrome,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email({ message: 'Please enter a valid email address' })
      .max(255),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .max(72),
    confirmPassword: z.string(),
    fullName: z
      .string()
      .trim()
      .min(2, { message: 'Full name must be at least 2 characters' })
      .max(100),
    phoneNumber: z
      .string()
      .trim()
      .max(20)
      .optional()
      .or(z.literal('')),
    dateOfBirth: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const evaluatePasswordStrength = (password: string) => {
  if (!password) return { score: 0, label: '', color: '' };

  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

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

interface LocationState {
  from?: {
    pathname: string;
  };
}

const SignUp = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
  });
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(
    evaluatePasswordStrength('')
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] =
    useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const from =
    (location.state as LocationState | null)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const validateField = (name: string, value: string) => {
    const errors: Record<string, string> = {};

    switch (name) {
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.email = 'Please enter a valid email address';
        }
        break;
      case 'fullName':
        if (value && value.trim().length < 2) {
          errors.fullName = 'Name must be at least 2 characters';
        } else if (value && value.trim().length > 100) {
          errors.fullName = 'Name must be less than 100 characters';
        }
        break;
      case 'password':
        if (value && value.length < 8) {
          errors.password = 'Password must be at least 8 characters';
        } else if (value && value.length > 72) {
          errors.password = 'Password must be less than 72 characters';
        }
        break;
      case 'confirmPassword':
        if (value && value !== formData.password) {
          errors.confirmPassword = 'Passwords do not match';
        }
        break;
      case 'phoneNumber':
        if (value && !/^\+?[\d\s\-()]+$/.test(value)) {
          errors.phoneNumber = 'Please enter a valid phone number';
        }
        break;
      case 'dateOfBirth':
        if (value) {
          const dob = new Date(value);
          const today = new Date();
          const age = today.getFullYear() - dob.getFullYear();
          if (age < 13) {
            errors.dateOfBirth = 'You must be at least 13 years old';
          }
        }
        break;
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }));
    if (!errors[name]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'password') {
      setPasswordStrength(evaluatePasswordStrength(value));
    }

    if (touchedFields[name]) {
      validateField(name, value);
    }

    if (name === 'password' && touchedFields.confirmPassword) {
      validateField('confirmPassword', formData.confirmPassword);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const handleGoogleSignIn = async () => {
    try {
      setOauthLoading(true);

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
        let errorTitle = 'Sign Up Failed';

        if (error.message.includes('redirect')) {
          errorMessage =
            'OAuth redirect configuration error. Please contact support.';
        } else if (error.message.includes('not enabled')) {
          errorMessage =
            'Google authentication is not enabled. Please use email/password sign up.';
        } else if (error.message.includes('network')) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
        setOauthLoading(false);
      }

      setTimeout(() => {
        setOauthLoading(false);
      }, 10000);
    } catch (error) {
      console.error('Unexpected Google OAuth error:', error);
      toast({
        title: 'Error',
        description:
          'Failed to initiate Google sign up. Please try again.',
        variant: 'destructive',
      });
      setOauthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const allFields = Object.keys(formData);
    const touched: Record<string, boolean> = {};
    allFields.forEach((field) => (touched[field] = true));
    setTouchedFields(touched);

    allFields.forEach((field) =>
      validateField(field, formData[field as keyof typeof formData])
    );

    const validation = signUpSchema.safeParse(formData);

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: 'Validation Error',
        description: firstError.message,
        variant: 'destructive',
      });
      return;
    }

    if (Object.keys(fieldErrors).length > 0) {
      toast({
        title: 'Please fix errors',
        description:
          'Please correct the errors in the form before submitting.',
        variant: 'destructive',
      });
      return;
    }

    if (passwordStrength.score < 2) {
      toast({
        title: 'Weak Password',
        description:
          'Your password is too weak. Please use uppercase, lowercase, numbers, and special characters.',
        variant: 'destructive',
      });
      return;
    } else if (passwordStrength.score < 3) {
      toast({
        title: 'Password Could Be Stronger',
        description:
          'For better security, consider adding uppercase, lowercase, numbers, and special characters.',
      });
    }

    setLoading(true);

    try {
      const redirectUrl =
        from !== '/'
          ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
            from
          )}`
          : `${window.location.origin}/auth/callback`;

      const { error, data } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validation.data.fullName,
            phone_number: validation.data.phoneNumber || null,
            date_of_birth: validation.data.dateOfBirth || null,
          },
        },
      });

      if (error) {
        let errorMessage = error.message;
        let errorTitle = 'Sign Up Failed';

        if (
          error.message.includes('User already registered') ||
          error.message.includes('already been registered')
        ) {
          errorMessage =
            'An account with this email already exists. Please sign in instead.';
          errorTitle = 'Account Already Exists';
        } else if (error.message.includes('Password should be')) {
          errorMessage =
            'Password is too weak. Please use a stronger password with uppercase, lowercase, numbers, and special characters.';
          errorTitle = 'Weak Password';
        } else if (error.message.includes('rate limit')) {
          errorMessage =
            'Too many signup attempts. Please wait a few minutes and try again.';
          errorTitle = 'Rate Limit Exceeded';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Please provide a valid email address.';
          errorTitle = 'Invalid Email';
        } else if (
          error.message.includes('Anonymous sign-ins are disabled')
        ) {
          errorMessage =
            'Email confirmation is required. Please use a valid email address.';
          errorTitle = 'Email Required';
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        const needsEmailConfirmation = data.user && !data.session;

        if (needsEmailConfirmation) {
          setEmailSent(true);
          toast({
            title: 'Account Created! 🎉',
            description:
              'Please check your email for a confirmation link to activate your account.',
            duration: 8000,
          });
        } else {
          toast({
            title: 'Welcome to BuyAPixel! 🎉',
            description:
              'Your account has been created successfully. Setting up your profile...',
            duration: 5000,
          });
        }
      }
    } catch (error) {
      console.error('Sign up error:', error);
      toast({
        title: 'Error',
        description:
          'An unexpected error occurred during sign up. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Email confirmation screen
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-md text-center space-y-6">
          <div>
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <Mail className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Check Your Email! 📧</h2>
            <p className="text-muted-foreground">
              We&apos;ve sent a confirmation link to{' '}
              <strong>{formData.email}</strong>
            </p>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm space-y-4 text-left">
            <h3 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Next Steps:
            </h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  1
                </span>
                <span>Check your inbox for an email from BuyAPixel</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  2
                </span>
                <span>Click the confirmation link in the email</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  3
                </span>
                <span>You&apos;ll be automatically signed in and redirected</span>
              </li>
            </ol>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or wait a
              few minutes.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setEmailSent(false)}>
                Use Different Email
              </Button>
              <Button variant="default" onClick={() => navigate('/signin')}>
                Go to Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main sign-up page - FIXED VERSION WITHOUT SCROLLING
  return (
    <div className="min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Side - Sign Up Form */}
      <div className="flex items-center justify-center bg-background px-4 sm:px-8 py-8 lg:py-0">
        {/* Form container - no max-height, no overflow scroll */}
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors group"
              aria-label="Back to home page"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </Link>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
            <p className="text-muted-foreground">
              Join India&apos;s first pixel marketplace
            </p>
          </div>

          {/* Social Authentication */}
          <div className="mb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 hover:bg-accent/50 transition-colors"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading || loading}
              aria-label="Sign up with Google"
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

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or sign up with email
                </span>
              </div>
            </div>
          </div>

          {/* Form content */}
          <form onSubmit={handleSignUp} className="space-y-3" noValidate>
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div className="relative flex-1">
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    required
                    autoComplete="name"
                    className={`h-11 pr-8 ${fieldErrors.fullName && touchedFields.fullName
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                      }`}
                    aria-invalid={
                      fieldErrors.fullName && touchedFields.fullName
                        ? 'true'
                        : 'false'
                    }
                    aria-describedby={
                      fieldErrors.fullName ? 'fullName-error' : undefined
                    }
                  />
                  {!fieldErrors.fullName &&
                    touchedFields.fullName &&
                    formData.fullName && (
                      <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 pointer-events-none" />
                    )}
                </div>
              </div>
              {fieldErrors.fullName && touchedFields.fullName && (
                <p
                  id="fullName-error"
                  className="text-xs text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="relative flex-1">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    required
                    autoComplete="email"
                    className={`h-11 pr-8 ${fieldErrors.email && touchedFields.email
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                      }`}
                    aria-invalid={
                      fieldErrors.email && touchedFields.email
                        ? 'true'
                        : 'false'
                    }
                    aria-describedby={
                      fieldErrors.email ? 'email-error' : undefined
                    }
                  />
                  {!fieldErrors.email &&
                    touchedFields.email &&
                    formData.email && (
                      <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 pointer-events-none" />
                    )}
                </div>
              </div>
              {fieldErrors.email && touchedFields.email && (
                <p
                  id="email-error"
                  className="text-xs text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Phone & DOB */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber">Phone (optional)</Label>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Phone className="h-4 w-4" />
                  </div>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    autoComplete="tel"
                    className={`h-11 ${fieldErrors.phoneNumber && touchedFields.phoneNumber
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                      }`}
                    aria-invalid={
                      fieldErrors.phoneNumber && touchedFields.phoneNumber
                        ? 'true'
                        : 'false'
                    }
                  />
                </div>
                {fieldErrors.phoneNumber && touchedFields.phoneNumber && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.phoneNumber}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">Birth Date (optional)</Label>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    max={new Date().toISOString().split('T')[0]}
                    autoComplete="bday"
                    className={`h-11 ${fieldErrors.dateOfBirth && touchedFields.dateOfBirth
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                      }`}
                  />
                </div>
                {fieldErrors.dateOfBirth && touchedFields.dateOfBirth && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.dateOfBirth}
                  </p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <div className="relative flex-1">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Choose a strong password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={`h-11 pr-9 ${fieldErrors.password && touchedFields.password
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                      }`}
                    aria-invalid={
                      fieldErrors.password && touchedFields.password
                        ? 'true'
                        : 'false'
                    }
                    aria-describedby="password-strength password-requirements"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {formData.password && (
                <div id="password-strength" className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Password Strength:
                    </span>
                    <span
                      className={`font-medium ${passwordStrength.score >= 4
                          ? 'text-green-600'
                          : passwordStrength.score >= 3
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{
                        width: `${(passwordStrength.score / 5) * 100}%`,
                      }}
                      role="progressbar"
                      aria-valuenow={passwordStrength.score * 20}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>

                  {'checks' in passwordStrength && passwordStrength.checks && (
                    <div
                      id="password-requirements"
                      className="text-[11px] space-y-0.5 mt-1.5"
                    >
                      <div
                        className={`flex items-center gap-1 ${passwordStrength.checks.length
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                          }`}
                      >
                        {passwordStrength.checks.length ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        At least 8 characters
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordStrength.checks.uppercase
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                          }`}
                      >
                        {passwordStrength.checks.uppercase ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One uppercase letter
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordStrength.checks.lowercase
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                          }`}
                      >
                        {passwordStrength.checks.lowercase ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One lowercase letter
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordStrength.checks.number
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                          }`}
                      >
                        {passwordStrength.checks.number ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One number
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordStrength.checks.special
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                          }`}
                      >
                        {passwordStrength.checks.special ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One special character
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <div className="relative flex-1">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={`h-11 pr-9 ${fieldErrors.confirmPassword &&
                        touchedFields.confirmPassword
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                      }`}
                    aria-invalid={
                      fieldErrors.confirmPassword &&
                        touchedFields.confirmPassword
                        ? 'true'
                        : 'false'
                    }
                    aria-describedby={
                      fieldErrors.confirmPassword
                        ? 'confirmPassword-error'
                        : undefined
                    }
                  />
                  {!fieldErrors.confirmPassword &&
                    touchedFields.confirmPassword &&
                    formData.confirmPassword &&
                    formData.password === formData.confirmPassword && (
                      <CheckCircle2 className="absolute right-7 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 pointer-events-none" />
                    )}
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                </div>
              </div>
              {fieldErrors.confirmPassword &&
                touchedFields.confirmPassword && (
                  <p
                    id="confirmPassword-error"
                    className="text-xs text-destructive flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.confirmPassword}
                  </p>
                )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-1"
              disabled={
                loading ||
                oauthLoading ||
                Object.keys(fieldErrors).length > 0 ||
                passwordStrength.score < 2
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/signin"
                className="text-primary hover:underline font-medium"
              >
                Sign in here
              </Link>
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-3 mb-1">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Features/Benefits */}
      <div className="hidden lg:flex relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-accent via-secondary to-primary opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-10 w-32 h-32 bg-white rounded-full animate-pulse" />
          <div className="absolute top-60 left-20 w-24 h-24 bg-white rounded-full animate-pulse [animation-delay:1s]" />
          <div className="absolute bottom-32 right-20 w-40 h-40 bg-white rounded-full animate-pulse [animation-delay:2s]" />
          <div className="absolute bottom-60 left-40 w-28 h-28 bg-white rounded-full animate-pulse [animation-delay:0.5s]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-start p-12 text-white">
          <div className="mb-8">
            <h2 className="text-5xl font-bold mb-6 leading-tight">
              Start Your
              <span className="block text-6xl bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                Pixel Journey
              </span>
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-md">
              Join thousands of creators and businesses building their digital
              presence on India&apos;s premier pixel marketplace.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Premium Quality</h3>
                <p className="text-white/80">
                  High-resolution canvas with permanent pixels
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Growing Community</h3>
                <p className="text-white/80">
                  Connect with thousands of pixel artists
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Creative Tools</h3>
                <p className="text-white/80">
                  Advanced tools to bring your vision to life
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/20">
            <p className="text-sm text-white/70 mb-3">
              Trusted by creators and businesses
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300" />
                <span className="text-sm">Secure Platform</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-300" />
                <span className="text-sm">Quick Setup</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
