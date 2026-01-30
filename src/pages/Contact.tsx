import { useState, useCallback, useEffect, useRef, useMemo, useTransition } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Mail,
  User,
  MessageSquare,
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getErrorMessage, cn } from '@/lib/utils';

// ======================
// TYPES & INTERFACES
// ======================

interface FormData {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  honeypot: string; // Anti-spam field
}

interface FormErrors {
  [key: string]: string;
}

// ======================
// CONSTANTS
// ======================

const RATE_LIMIT_DURATION = 60000; // 60 seconds
const AUTO_SAVE_INTERVAL = 5000; // 5 seconds
const DRAFT_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

const CONTACT_CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'support', label: 'Technical Support' },
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'partnership', label: 'Business Partnership' },
  { value: 'feedback', label: 'Feedback & Suggestions' },
  { value: 'other', label: 'Other' },
];

const CONTACT_INFO = [
  {
    icon: Mail,
    title: 'Email',
    value: 'support@buyapixel.in',
    description: 'We respond within 24 hours',
    href: 'mailto:support@buyapixel.in',
    color: 'primary',
  },
  {
    icon: Phone,
    title: 'Phone',
    value: '+91 XXX XXX XXXX',
    description: 'Mon-Fri, 9 AM - 6 PM IST',
    href: 'tel:+91XXXXXXXXXX',
    color: 'secondary',
  },
  {
    icon: MapPin,
    title: 'Location',
    value: 'Mumbai, India',
    description: 'Serving India & beyond',
    href: null,
    color: 'accent',
  },
  {
    icon: Clock,
    title: 'Response Time',
    value: 'Within 24 hours',
    description: 'Usually much faster!',
    href: null,
    color: 'green',
  },
];

// ======================
// VALIDATION SCHEMA
// ======================

const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(100, 'Email must be less than 100 characters'),
  category: z.string().min(1, 'Please select a category'),
  subject: z
    .string()
    .trim()
    .min(5, 'Subject must be at least 5 characters')
    .max(150, 'Subject must be less than 150 characters'),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must be less than 1000 characters'),
  honeypot: z.string().max(0, 'Bot detected'),
});

// ======================
// UTILITY FUNCTIONS
// ======================

function calculateFormCompleteness(formData: FormData): number {
  const requiredFields = ['name', 'email', 'category', 'subject', 'message'];
  const filledFields = requiredFields.filter((field) => {
    const value = formData[field as keyof FormData];
    return value && value.trim().length > 0;
  });
  return Math.round((filledFields.length / requiredFields.length) * 100);
}

// ======================
// COMPONENT
// ======================

const Contact = () => {
  const { toast } = useToast();

  // Refs
  const isMountedRef = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const lastSubmitTimeRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // React 19 hooks
  const [isPending, startTransition] = useTransition();

  // State
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    category: '',
    subject: '',
    message: '',
    honeypot: '',
  });
  const [loading, setLoading] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Memoized values
  const formCompleteness = useMemo(() => calculateFormCompleteness(formData), [formData]);
  const hasUnsavedChanges = useMemo(() => {
    return Object.values(formData).some((value) => value.trim().length > 0);
  }, [formData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Trigger entrance animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Restore draft from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem('contact_form_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const draftAge = Date.now() - draft.timestamp;

        if (draftAge < DRAFT_EXPIRY_TIME) {
          toast({
            title: 'Draft Found',
            description: 'Would you like to restore your previous message?',
            action: (
              <Button
                size="sm"
                onClick={() => {
                  const { timestamp, ...draftData } = draft;
                  setFormData(draftData);
                  toast({
                    title: 'Draft Restored',
                    description: 'Your previous message has been restored.',
                  });
                }}
              >
                Restore
              </Button>
            ),
            duration: 10000,
          });
        } else {
          localStorage.removeItem('contact_form_draft');
        }
      } catch (error) {
        console.error('Failed to parse draft:', error);
        localStorage.removeItem('contact_form_draft');
      }
    }
  }, [toast]);

  // Auto-save draft
  useEffect(() => {
    if (!hasUnsavedChanges || messageSent) return;

    const autoSave = () => {
      const draft = {
        ...formData,
        timestamp: Date.now(),
      };
      localStorage.setItem('contact_form_draft', JSON.stringify(draft));
      setLastSaved(new Date());
    };

    autoSaveTimerRef.current = setTimeout(autoSave, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, hasUnsavedChanges, messageSent]);

  // Handlers
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;

      startTransition(() => {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      });

      // Clear error for this field
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setFormData((prev) => ({
          ...prev,
          category: value,
        }));
      });

      if (errors.category) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.category;
          return newErrors;
        });
      }
    },
    [errors.category]
  );

  const handleBlur = useCallback((fieldName: string) => {
    setTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check honeypot for bots
    if (formData.honeypot) {
      console.warn('Bot detected via honeypot');
      toast({
        title: 'Error',
        description: 'Invalid form submission detected.',
        variant: 'destructive',
      });
      return;
    }

    // Rate limiting
    if (lastSubmitTimeRef.current) {
      const timeSinceLastSubmit = Date.now() - lastSubmitTimeRef.current;
      const secondsRemaining = Math.ceil((RATE_LIMIT_DURATION - timeSinceLastSubmit) / 1000);

      if (secondsRemaining > 0) {
        toast({
          title: 'Please Wait',
          description: `You can submit another message in ${secondsRemaining} seconds.`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Validate with Zod
    const validation = contactFormSchema.safeParse(formData);

    if (!validation.success) {
      const fieldErrors: FormErrors = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);

      // Mark all fields as touched
      const allTouched: Record<string, boolean> = {};
      Object.keys(formData).forEach((key) => {
        allTouched[key] = true;
      });
      setTouched(allTouched);

      toast({
        title: 'Validation Error',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      console.log('📧 Submitting contact form...', {
        name: validation.data.name,
        email: validation.data.email,
        category: validation.data.category,
        subject: validation.data.subject,
      });

      // Store in database
      const { error: insertError } = await supabase.from('contact_messages').insert({
        name: validation.data.name,
        email: validation.data.email,
        category: validation.data.category,
        subject: validation.data.subject,
        message: validation.data.message,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw insertError;
      }

      console.log('✅ Contact message saved to database');

      // Update rate limit
      lastSubmitTimeRef.current = Date.now();
      setMessageSent(true);

      // Clear draft
      localStorage.removeItem('contact_form_draft');

      toast({
        title: 'Message Sent Successfully! 🎉',
        description: "Thank you for contacting us. We'll get back to you within 24 hours.",
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        category: '',
        subject: '',
        message: '',
        honeypot: '',
      });
      setErrors({});
      setTouched({});
      setLastSaved(null);

      // Scroll to success message
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } catch (error: unknown) {
      console.error('❌ Contact form error:', error);

      let errorMessage = getErrorMessage(error) || 'Failed to send message. Please try again.';

      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const clearForm = useCallback(() => {
    setFormData({
      name: '',
      email: '',
      category: '',
      subject: '',
      message: '',
      honeypot: '',
    });
    setErrors({});
    setTouched({});
    localStorage.removeItem('contact_form_draft');
    toast({
      title: 'Form Cleared',
      description: 'All fields have been reset.',
    });
  }, [toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Schema.org structured data
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact BuyAPixel',
      description: 'Get in touch with BuyAPixel support team',
      url: 'https://buyapixel.in/contact',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+91-XXX-XXX-XXXX',
        contactType: 'Customer Service',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    }),
    []
  );

  return (
    <>
      <Helmet>
        <title>Contact Us - BuyAPixel.in | Get Support & Assistance</title>
        <meta
          name="description"
          content="Have questions about BuyAPixel? Need support? Contact our team via email, phone, or our contact form. We respond within 24 hours."
        />
        <meta property="og:title" content="Contact Us - BuyAPixel.in" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Get in touch with BuyAPixel support team" />
        <link rel="canonical" href="https://buyapixel.in/contact" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <Header />

        <main className="container mx-auto px-4 py-12">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Contact</span>
          </nav>

          {/* Hero Section */}
          <div
            className={cn(
              'text-center mb-12 transition-all duration-700',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <Badge variant="secondary" className="mb-4">
              <MessageSquare className="w-3 h-3 mr-1" aria-hidden="true" />
              Support Center
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Get In Touch
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions about BuyAPixel.in? Need support? We'd love to hear from you.
            </p>
            {lastSaved && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Draft auto-saved at {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Success Message */}
          {messageSent && (
            <div
              className={cn(
                'max-w-4xl mx-auto mb-8 transition-all duration-500',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Message Sent Successfully!
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        Thank you for contacting us. We'll respond within 24 hours. Check your email
                        for confirmation.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Contact Form */}
            <div
              className={cn(
                'lg:col-span-2 transition-all duration-700 delay-150',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <Card className="border-2 hover:border-primary/20 transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-primary" aria-hidden="true" />
                        Send us a message
                      </CardTitle>
                      <CardDescription>
                        Fill out the form below and we'll respond as soon as possible.
                      </CardDescription>
                    </div>
                    {formCompleteness > 0 && formCompleteness < 100 && (
                      <Badge variant="outline" className="flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        {formCompleteness}%
                      </Badge>
                    )}
                  </div>
                  {formCompleteness > 0 && formCompleteness < 100 && (
                    <Progress value={formCompleteness} className="h-1 mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                    {/* Honeypot field (hidden from users) */}
                    <input
                      type="text"
                      name="honeypot"
                      value={formData.honeypot}
                      onChange={handleInputChange}
                      className="hidden"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                    />

                    {/* Name and Email Row */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Name Field */}
                      <div className="space-y-1.5">
                        <Label htmlFor="name">
                          Full Name <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                            <User className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="relative flex-1">
                            <Input
                              id="name"
                              name="name"
                              type="text"
                              placeholder="John Doe"
                              value={formData.name}
                              onChange={handleInputChange}
                              onBlur={() => handleBlur('name')}
                              required
                              disabled={loading || isPending}
                              className={cn(
                                'h-11',
                                touched.name && errors.name && 'border-destructive'
                              )}
                              maxLength={100}
                              aria-invalid={touched.name && !!errors.name}
                              aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
                            />
                          </div>
                        </div>
                        {touched.name && errors.name && (
                          <p
                            id="name-error"
                            className="text-xs text-destructive flex items-center gap-1 ml-11"
                            role="alert"
                          >
                            <AlertCircle className="w-3 h-3" aria-hidden="true" />
                            {errors.name}
                          </p>
                        )}
                      </div>

                      {/* Email Field */}
                      <div className="space-y-1.5">
                        <Label htmlFor="email">
                          Email Address <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                            <Mail className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="relative flex-1">
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              placeholder="you@example.com"
                              value={formData.email}
                              onChange={handleInputChange}
                              onBlur={() => handleBlur('email')}
                              required
                              disabled={loading || isPending}
                              className={cn(
                                'h-11',
                                touched.email && errors.email && 'border-destructive'
                              )}
                              maxLength={100}
                              aria-invalid={touched.email && !!errors.email}
                              aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                            />
                          </div>
                        </div>
                        {touched.email && errors.email && (
                          <p
                            id="email-error"
                            className="text-xs text-destructive flex items-center gap-1 ml-11"
                            role="alert"
                          >
                            <AlertCircle className="w-3 h-3" aria-hidden="true" />
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Category Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="category">
                        Category <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                          <HelpCircle className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <Select
                          value={formData.category}
                          onValueChange={handleCategoryChange}
                          disabled={loading || isPending}
                        >
                          <SelectTrigger
                            id="category"
                            className={cn(
                              'h-11',
                              touched.category && errors.category && 'border-destructive'
                            )}
                            aria-invalid={touched.category && !!errors.category}
                          >
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTACT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {touched.category && errors.category && (
                        <p
                          className="text-xs text-destructive flex items-center gap-1 ml-11"
                          role="alert"
                        >
                          <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          {errors.category}
                        </p>
                      )}
                    </div>

                    {/* Subject Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="subject">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="relative flex-1">
                          <Input
                            id="subject"
                            name="subject"
                            type="text"
                            placeholder="What is this regarding?"
                            value={formData.subject}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('subject')}
                            required
                            disabled={loading || isPending}
                            className={cn(
                              'h-11',
                              touched.subject && errors.subject && 'border-destructive'
                            )}
                            maxLength={150}
                            aria-invalid={touched.subject && !!errors.subject}
                            aria-describedby={touched.subject && errors.subject ? 'subject-error' : undefined}
                          />
                        </div>
                      </div>
                      {touched.subject && errors.subject && (
                        <p
                          id="subject-error"
                          className="text-xs text-destructive flex items-center gap-1 ml-11"
                          role="alert"
                        >
                          <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          {errors.subject}
                        </p>
                      )}
                    </div>

                    {/* Message Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="message">
                        Message <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell us more about your inquiry... (Ctrl+Enter to submit)"
                        value={formData.message}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur('message')}
                        required
                        disabled={loading || isPending}
                        rows={6}
                        className={cn(
                          'resize-none',
                          touched.message && errors.message && 'border-destructive'
                        )}
                        maxLength={1000}
                        aria-invalid={touched.message && !!errors.message}
                        aria-describedby={touched.message && errors.message ? 'message-error' : 'message-hint'}
                      />
                      {touched.message && errors.message && (
                        <p
                          id="message-error"
                          className="text-xs text-destructive flex items-center gap-1"
                          role="alert"
                        >
                          <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          {errors.message}
                        </p>
                      )}
                      <p id="message-hint" className="text-xs text-muted-foreground text-right">
                        {formData.message.length}/1000 characters
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        className="flex-1 h-11"
                        disabled={loading || isPending}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                            Send Message
                          </>
                        )}
                      </Button>
                      {hasUnsavedChanges && !loading && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={clearForm}
                          disabled={loading || isPending}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Contact Info Sidebar */}
            <aside
              className={cn(
                'space-y-6 transition-all duration-700 delay-300',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              {/* Contact Information */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-xl">Contact Information</CardTitle>
                  <CardDescription>Other ways to reach us</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {CONTACT_INFO.map((info, index) => {
                    const Icon = info.icon;
                    return (
                      <div key={index} className="flex items-start space-x-4">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            `bg-${info.color}/10 text-${info.color}`
                          )}
                        >
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1">{info.title}</h3>
                          {info.href ? (
                            <a
                              href={info.href}
                              className="text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              {info.value}
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground">{info.value}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Why Contact Us */}
              <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
                    Why Contact Us?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Fast response times',
                    'Knowledgeable support team',
                    'Solutions tailored to your needs',
                    'Available 24/7 via email',
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2
                        className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-sm">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link
                    to="/help"
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium">Help Center</span>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/terms"
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium">Terms of Service</span>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/privacy"
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium">Privacy Policy</span>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            </aside>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Contact;
