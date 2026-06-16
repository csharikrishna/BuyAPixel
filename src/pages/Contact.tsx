import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Loader2,
  Mail,
  User,
  MessageSquare,
  Phone,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  HelpCircle,
  Sparkles,
  CreditCard,
  Upload,
  FileText,
  X,
  Copy,
  Shield,
  DollarSign,
  Smartphone,
  AlertTriangle,
  MapPin,
  Ticket,
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
  honeypot: string;
}

interface FormErrors {
  [key: string]: string;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
}

// ======================
// CONSTANTS
// ======================

const RATE_LIMIT_DURATION = 60000;
const AUTO_SAVE_INTERVAL = 5000;
const DRAFT_EXPIRY_TIME = 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const FILE_TYPE_LABELS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

const CONTACT_CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'payment', label: 'Payment Issues' },
  { value: 'technical', label: 'Technical Problem' },
  { value: 'refund', label: 'Refund Request' },
  { value: 'account', label: 'Account Support' },
  { value: 'other', label: 'Other' },
];

const CONTACT_INFO = [
  {
    icon: Mail,
    title: 'Email',
    value: 'support@buyaspot.in',
    description: 'We respond within 24 hours',
    href: 'mailto:support@buyaspot.in',
    color: 'primary',
  },
  {
    icon: Phone,
    title: 'Phone',
    value: 'Email preferred',
    description: 'Mon-Fri, 9 AM - 6 PM IST',
    href: 'mailto:support@buyaspot.in',
    color: 'secondary',
  },
  {
    icon: MapPin,
    title: 'Location',
    value: 'Annamacharya Institute of Technology and Sciences',
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

const PAYMENT_HELP_ITEMS = [
  {
    id: 'upi-failed',
    icon: Smartphone,
    title: 'UPI Payment Failed',
    answer: 'Check your UPI app for the transaction status. If "Failed", no money was deducted — try again. If "Pending", wait 15-30 minutes for auto-resolution. Try a different UPI app or payment method if the issue persists.',
  },
  {
    id: 'payment-deducted',
    icon: AlertTriangle,
    title: 'Payment Deducted but Not Confirmed',
    answer: 'Wait 5-10 minutes and refresh. Check your email and profile for confirmation. If unresolved in 30 minutes, contact support with your transaction ID, amount, and a screenshot of the bank transaction.',
  },
  {
    id: 'refund-timeline',
    icon: Clock,
    title: 'Refund Processing Timeline',
    answer: 'Refund requests are reviewed within 24 hours. UPI refunds take 5-7 business days; card refunds take 5-10 business days. You\'ll receive an email when the refund is initiated.',
  },
  {
    id: 'pending-verification',
    icon: HelpCircle,
    title: 'Pending Payment Verification',
    answer: 'Payments may be "Pending" due to bank delays. Most resolve automatically within 15-30 minutes. Do NOT make duplicate payments. If pending after 1 hour, contact support.',
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ======================
// COMPONENT
// ======================

const Contact = () => {

  // Refs
  const isMountedRef = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const lastSubmitTimeRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
          toast('Draft Found', {
            description: 'Would you like to restore your previous message?',
            action: {
              label: 'Restore',
              onClick: () => {
                const { timestamp, ...draftData } = draft;
                setFormData(draftData);
                toast.success('Draft Restored', {
                  description: 'Your previous message has been restored.',
                });
              },
            },
            duration: 10000,
          });
        } else {
          localStorage.removeItem('contact_form_draft');
        }
      } catch (error: unknown) {
        console.error('Failed to parse draft:', error);
        localStorage.removeItem('contact_form_draft');
      }
    }
  }, []);

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
      setFormData((prev) => ({ ...prev, [name]: value }));
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
      setFormData((prev) => ({ ...prev, category: value }));
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
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  }, []);

  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so the same file can be re-selected
    e.target.value = '';

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setUploadError(`Invalid file type. Supported: ${Object.values(FILE_TYPE_LABELS).join(', ')}`);
      toast.error('Invalid File Type', {
        description: `Please upload one of: ${Object.values(FILE_TYPE_LABELS).join(', ')}`,
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`);
      toast.error('File Too Large', {
        description: `Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}.`,
      });
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('support-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) {
        throw uploadErr;
      }

      const { data: urlData } = supabase.storage
        .from('support-attachments')
        .getPublicUrl(filePath);

      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        url: urlData.publicUrl || filePath,
      });

      toast.success('File Uploaded Successfully', {
        description: `${file.name} (${formatFileSize(file.size)})`,
      });
    } catch (error: unknown) {
      console.error('File upload error:', error);
      const errMsg = getErrorMessage(error) || 'Failed to upload file. Please try again.';
      setUploadError(errMsg);
      toast.error('Upload Failed', { description: errMsg });
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  }, []);

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    setUploadError(null);
    toast('File Removed', { description: 'Attachment has been removed.' });
  }, []);

  const copyTicketId = useCallback(() => {
    if (ticketId) {
      navigator.clipboard.writeText(ticketId).then(() => {
        toast.success('Copied!', { description: 'Ticket ID copied to clipboard.' });
      });
    }
  }, [ticketId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check honeypot for bots
    if (formData.honeypot) {
      console.warn('Bot detected via honeypot');
      toast.error('Error', { description: 'Invalid form submission detected.' });
      return;
    }

    // Rate limiting
    if (lastSubmitTimeRef.current) {
      const timeSinceLastSubmit = Date.now() - lastSubmitTimeRef.current;
      const secondsRemaining = Math.ceil((RATE_LIMIT_DURATION - timeSinceLastSubmit) / 1000);
      if (secondsRemaining > 0) {
        toast.error('Please Wait', {
          description: `You can submit another message in ${secondsRemaining} seconds.`,
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

      const allTouched: Record<string, boolean> = {};
      Object.keys(formData).forEach((key) => {
        allTouched[key] = true;
      });
      setTouched(allTouched);

      toast.error('Validation Error', {
        description: validation.error.errors[0].message,
      });
      return;
    }

    setLoading(true);

    try {
      console.log('📧 Submitting support request...');

      const response = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: validation.data.name,
          email: validation.data.email,
          category: validation.data.category,
          subject: validation.data.subject,
          message: validation.data.message,
          file_url: uploadedFile?.url || null,
        },
      });

      if (response.error) {
        console.error('❌ Email function error:', response.error);
        throw response.error;
      }

      console.log('✅ Support request submitted', response.data);

      // Extract ticket ID from response
      const responseTicketId = response.data?.ticket_id || null;
      setTicketId(responseTicketId);

      // Update rate limit
      lastSubmitTimeRef.current = Date.now();
      setMessageSent(true);

      // Clear draft
      localStorage.removeItem('contact_form_draft');

      toast.success('Request Submitted Successfully! 🎉', {
        description: responseTicketId
          ? `Your Ticket ID: ${responseTicketId}`
          : "Thank you for contacting us. We'll get back to you within 24 hours.",
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
      setUploadedFile(null);
      setUploadError(null);

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

      toast.error('Error', { description: errorMessage });
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
    setUploadedFile(null);
    setUploadError(null);
    localStorage.removeItem('contact_form_draft');
    toast('Form Cleared', { description: 'All fields have been reset.' });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      name: 'Contact BuyASpot',
      description: 'Get in touch with BuyASpot support team',
      url: 'https://buyaspot.in/contact',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '',
        email: 'support@buyaspot.in',
        contactType: 'Customer Service',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    }),
    []
  );

  const breadcrumbSchema = useMemo(
    () => generateBreadcrumbSchema([
      { name: 'Home', url: 'https://buyaspot.in' },
      { name: 'Contact', url: 'https://buyaspot.in/contact' }
    ]),
    []
  );

  return (
    <>
      <SEO
        title="Contact BuyASpot - Get Support & Assistance"
        description="Contact BuyASpot Support: Reach our team via email or contact form. Get answers to pixel advertising questions and billing inquiries. We respond within 24 hours."
        canonical="https://buyaspot.in/contact"
        keywords={['contact BuyASpot', 'support', 'customer service', 'pixel help']}
        type="website"
        structuredData={[breadcrumbSchema, structuredData]}
      />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <Header />

        <main className="container mx-auto px-4 py-12">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Support Center</span>
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
              How Can We Help?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Submit a support request and we'll get back to you within 24 hours.
              Every request receives a unique Ticket ID for easy tracking.
            </p>
            {lastSaved && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Draft auto-saved at {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Success Message with Ticket ID */}
          {messageSent && (
            <div
              className={cn(
                'max-w-4xl mx-auto mb-8 transition-all duration-500',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 border-2">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle2
                      className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-green-900 dark:text-green-100 mb-1">
                        Request Submitted Successfully!
                      </h2>
                      <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                        Your support request has been received. We'll respond within 24 hours.
                        Check your email for confirmation.
                      </p>

                      {ticketId && (
                        <div className="bg-white dark:bg-green-900/40 rounded-lg p-4 border border-green-200 dark:border-green-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Ticket className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                              Your Ticket ID
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <code className="text-2xl font-bold text-green-900 dark:text-green-100 font-mono tracking-wider">
                              {ticketId}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={copyTicketId}
                              className="border-green-300 text-green-700 hover:bg-green-100"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                            Save this Ticket ID to track your request. Reference it in any follow-up communications.
                          </p>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        className="mt-4 border-green-300"
                        onClick={() => {
                          setMessageSent(false);
                          setTicketId(null);
                        }}
                      >
                        Submit Another Request
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Payment Help Section */}
          {!messageSent && (
            <div
              className={cn(
                'max-w-6xl mx-auto mb-10 transition-all duration-700 delay-75',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <Card className="border-2 border-amber-200/50 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-600" aria-hidden="true" />
                    Quick Payment Help
                  </CardTitle>
                  <CardDescription>
                    Common payment issues and solutions. Check here first before submitting a support request.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {PAYMENT_HELP_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <AccordionItem
                          key={item.id}
                          value={item.id}
                          className="bg-white/70 dark:bg-black/10 px-4 rounded-lg border border-amber-200/50 dark:border-amber-800/30"
                        >
                          <AccordionTrigger className="hover:no-underline py-3 text-sm">
                            <span className="flex items-center gap-2 font-medium text-left">
                              <Icon className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
                              {item.title}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground pb-4">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  <div className="mt-4 flex gap-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/payment-help">
                        View All Payment Help <ChevronRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/refund-policy">
                        <DollarSign className="w-3 h-3 mr-1" />
                        Refund Policy
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!messageSent && (
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
                          Submit a Support Request
                        </CardTitle>
                        <CardDescription>
                          Fill out the form below. You'll receive a unique Ticket ID for tracking.
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
                                disabled={loading}
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
                            <p id="name-error" className="text-xs text-destructive flex items-center gap-1 ml-11" role="alert">
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
                                disabled={loading}
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
                            <p id="email-error" className="text-xs text-destructive flex items-center gap-1 ml-11" role="alert">
                              <AlertCircle className="w-3 h-3" aria-hidden="true" />
                              {errors.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Category and Subject Row */}
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Category Field */}
                        <div className="space-y-1.5">
                          <Label htmlFor="category">
                            Issue Category <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex items-center gap-2">
                            <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                              <HelpCircle className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <Select
                              value={formData.category}
                              onValueChange={handleCategoryChange}
                              disabled={loading}
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
                            <p className="text-xs text-destructive flex items-center gap-1 ml-11" role="alert">
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
                                placeholder="Brief description of your issue"
                                value={formData.subject}
                                onChange={handleInputChange}
                                onBlur={() => handleBlur('subject')}
                                required
                                disabled={loading}
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
                            <p id="subject-error" className="text-xs text-destructive flex items-center gap-1 ml-11" role="alert">
                              <AlertCircle className="w-3 h-3" aria-hidden="true" />
                              {errors.subject}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Message Field */}
                      <div className="space-y-1.5">
                        <Label htmlFor="message">
                          Message <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="message"
                          name="message"
                          placeholder="Describe your issue in detail... (Ctrl+Enter to submit)"
                          value={formData.message}
                          onChange={handleInputChange}
                          onBlur={() => handleBlur('message')}
                          required
                          disabled={loading}
                          rows={5}
                          className={cn(
                            'resize-none',
                            touched.message && errors.message && 'border-destructive'
                          )}
                          maxLength={1000}
                          aria-invalid={touched.message && !!errors.message}
                          aria-describedby={touched.message && errors.message ? 'message-error' : 'message-hint'}
                        />
                        {touched.message && errors.message && (
                          <p id="message-error" className="text-xs text-destructive flex items-center gap-1" role="alert">
                            <AlertCircle className="w-3 h-3" aria-hidden="true" />
                            {errors.message}
                          </p>
                        )}
                        <p id="message-hint" className="text-xs text-muted-foreground text-right">
                          {formData.message.length}/1000 characters
                        </p>
                      </div>

                      {/* File Upload Section */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Upload className="w-4 h-4" />
                          Attach Files
                          <span className="text-muted-foreground font-normal">(Optional)</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Upload screenshots, payment proofs, or supporting documents if needed.
                        </p>

                        {!uploadedFile ? (
                          <div
                            className={cn(
                              'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-muted/30',
                              uploadError ? 'border-destructive' : 'border-muted-foreground/25'
                            )}
                            onClick={() => fileInputRef.current?.click()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                fileInputRef.current?.click();
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label="Upload file"
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="hidden"
                              accept={ALLOWED_FILE_TYPES.join(',')}
                              onChange={handleFileUpload}
                              disabled={uploading || loading}
                            />
                            {uploading ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                <p className="text-sm text-muted-foreground">Uploading...</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <Upload className="w-8 h-8 text-muted-foreground/50" />
                                <p className="text-sm font-medium">Click to upload</p>
                                <p className="text-xs text-muted-foreground">
                                  JPG, PNG, PDF, DOC, DOCX • Max {formatFileSize(MAX_FILE_SIZE)}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <FileText className="w-8 h-8 text-green-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {FILE_TYPE_LABELS[uploadedFile.type] || 'File'} • {formatFileSize(uploadedFile.size)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={removeFile}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {uploadError && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {uploadError}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          type="submit"
                          className="flex-1 h-11"
                          disabled={loading || uploading}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                              Submit Request
                            </>
                          )}
                        </Button>
                        {hasUnsavedChanges && !loading && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={clearForm}
                            disabled={loading}
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

                {/* Ticket Tracking Info */}
                <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-primary" aria-hidden="true" />
                      Ticket Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      'Every request gets a unique Ticket ID',
                      'Reference your Ticket ID in follow-ups',
                      'We respond within 24 hours',
                      'Check your email for updates',
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
                    {[
                      { label: 'Help Center', href: '/help' },
                      { label: 'Payment Help', href: '/payment-help' },
                      { label: 'Refund Policy', href: '/refund-policy' },
                      { label: 'Content Guidelines', href: '/content-guidelines' },
                      { label: 'Terms of Service', href: '/terms' },
                      { label: 'Privacy Policy', href: '/privacy' },
                    ].map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <span className="text-sm font-medium">{link.label}</span>
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Contact;
