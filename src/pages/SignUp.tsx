import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Phone, Calendar, ArrowLeft, Star, Users, Palette, Eye, EyeOff, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(72),
  confirmPassword: z.string(),
  fullName: z.string().trim().min(2, { message: "Full name must be at least 2 characters" }).max(100),
  phoneNumber: z.string().trim().max(20).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Password strength evaluation function
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

const SignUp = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    dateOfBirth: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(evaluatePasswordStrength(''));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Real-time field validation
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
        }
        break;
      case 'password':
        if (value && value.length < 8) {
          errors.password = 'Password must be at least 8 characters';
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
    }

    setFieldErrors(prev => ({ ...prev, ...errors }));
    if (!errors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update password strength for password field
    if (name === 'password') {
      setPasswordStrength(evaluatePasswordStrength(value));
    }

    // Real-time validation for touched fields
    if (touchedFields[name]) {
      validateField(name, value);
    }

    // Validate confirm password when password changes
    if (name === 'password' && touchedFields.confirmPassword) {
      validateField('confirmPassword', formData.confirmPassword);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouchedFields(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });

      if (error) {
        toast({
          title: "Google Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred with Google sign in.",
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allFields = Object.keys(formData);
    const touched: Record<string, boolean> = {};
    allFields.forEach(field => touched[field] = true);
    setTouchedFields(touched);

    // Validate all fields
    allFields.forEach(field => validateField(field, formData[field as keyof typeof formData]));

    // Validate form data with Zod
    const validation = signUpSchema.safeParse(formData);
    
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    // Check if there are any field errors
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error, data } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validation.data.fullName,
            phone_number: validation.data.phoneNumber || null,
            date_of_birth: validation.data.dateOfBirth || null
          }
        }
      });

      if (error) {
        let errorMessage = error.message;
        
        // Enhanced error messages
        if (error.message.includes('User already registered')) {
          errorMessage = "An account with this email already exists. Please sign in instead.";
        } else if (error.message.includes('Password should be')) {
          errorMessage = "Password is too weak. Please use a stronger password with uppercase, lowercase, numbers, and special characters.";
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Too many signup attempts. Please wait a few minutes and try again.";
        } else if (error.message.includes('Invalid email')) {
          errorMessage = "Please provide a valid email address.";
        }
        
        toast({
          title: "Sign Up Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account Created Successfully! 🎉",
          description: "Please check your email for a confirmation link to complete your registration.",
          duration: 6000,
        });
        
        // Update profile with additional information if user was created
        if (data.user && (validation.data.phoneNumber || validation.data.dateOfBirth)) {
          try {
            await supabase
              .from('profiles')
              .update({
                phone_number: validation.data.phoneNumber || null,
                date_of_birth: validation.data.dateOfBirth || null,
              })
              .eq('user_id', data.user.id);
          } catch (profileError) {
            console.error('Profile update error:', profileError);
          }
        }
        
        // Redirect to sign in after successful registration
        setTimeout(() => {
          navigate('/signin');
        }, 2000);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred during sign up. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col-reverse lg:flex-row">
      {/* Left Side - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link 
              to="/" 
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6"
              aria-label="Back to home page"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
            <p className="text-muted-foreground">Join India's first pixel marketplace</p>
          </div>

          {/* Social Authentication */}
          <div className="mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12"
              onClick={handleGoogleSignIn}
              aria-label="Sign up with Google"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
            
            <div className="relative my-6">
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

          <form onSubmit={handleSignUp} className="space-y-4" noValidate>
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  required
                  className={`pl-10 h-11 ${fieldErrors.fullName && touchedFields.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  aria-invalid={fieldErrors.fullName && touchedFields.fullName ? 'true' : 'false'}
                  aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
                />
              </div>
              {fieldErrors.fullName && touchedFields.fullName && (
                <p id="fullName-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  required
                  className={`pl-10 h-11 ${fieldErrors.email && touchedFields.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  aria-invalid={fieldErrors.email && touchedFields.email ? 'true' : 'false'}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
              </div>
              {fieldErrors.email && touchedFields.email && (
                <p id="email-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Optional Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone (optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    placeholder="Phone number"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`pl-10 h-11 ${fieldErrors.phoneNumber && touchedFields.phoneNumber ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    aria-invalid={fieldErrors.phoneNumber && touchedFields.phoneNumber ? 'true' : 'false'}
                  />
                </div>
                {fieldErrors.phoneNumber && touchedFields.phoneNumber && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.phoneNumber}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Birth Date (optional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    max={new Date().toISOString().split('T')[0]}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                  className={`pl-10 pr-10 h-11 ${fieldErrors.password && touchedFields.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  aria-invalid={fieldErrors.password && touchedFields.password ? 'true' : 'false'}
                  aria-describedby="password-strength password-requirements"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Meter */}
              {formData.password && (
                <div id="password-strength" className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password Strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.score >= 4 ? 'text-green-600' : 
                      passwordStrength.score >= 3 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                  
                  {/* Password Requirements */}
                  <div id="password-requirements" className="text-xs space-y-1 mt-2">
                    <div className={`flex items-center gap-1 ${passwordStrength.checks?.length ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {passwordStrength.checks?.length ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.checks?.uppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {passwordStrength.checks?.uppercase ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One uppercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.checks?.lowercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {passwordStrength.checks?.lowercase ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One lowercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.checks?.number ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {passwordStrength.checks?.number ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One number
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.checks?.special ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {passwordStrength.checks?.special ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One special character
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                  className={`pl-10 pr-10 h-11 ${fieldErrors.confirmPassword && touchedFields.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  aria-invalid={fieldErrors.confirmPassword && touchedFields.confirmPassword ? 'true' : 'false'}
                  aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && touchedFields.confirmPassword && (
                <p id="confirmPassword-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 btn-premium" 
              disabled={loading || Object.keys(fieldErrors).length > 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/signin" className="text-primary hover:underline font-medium hover-underline">
                Sign in here
              </Link>
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Right Side - Features/Benefits */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-accent via-secondary to-primary opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-10 w-32 h-32 bg-white rounded-full animate-pulse" />
          <div className="absolute top-60 left-20 w-24 h-24 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-32 right-20 w-40 h-40 bg-white rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-60 left-40 w-28 h-28 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
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
              Join thousands of creators and businesses building their digital presence on India's premier pixel marketplace.
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Premium Quality</h3>
                <p className="text-white/80">High-resolution canvas with permanent pixels</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Growing Community</h3>
                <p className="text-white/80">Connect with thousands of pixel artists</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Creative Tools</h3>
                <p className="text-white/80">Advanced tools to bring your vision to life</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
            <p className="text-sm text-white/90">
              🎉 <strong>Special Launch Offer:</strong> Get 25% off your first pixel purchase!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
