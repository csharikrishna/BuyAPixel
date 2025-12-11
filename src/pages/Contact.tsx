import React, { useState } from 'react';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Validation schema
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
});

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSubmitTime, setLastSubmitTime] = useState<number | null>(null);
  const { toast } = useToast();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side rate limiting (60 seconds between submissions)
    if (lastSubmitTime) {
      const timeSinceLastSubmit = Date.now() - lastSubmitTime;
      const secondsRemaining = Math.ceil((60000 - timeSinceLastSubmit) / 1000);

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
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);

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
        subject: validation.data.subject,
      });

      // OPTION 1: Use Supabase Edge Function (recommended)
      // Uncomment this when you have the Edge Function deployed
      /*
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: validation.data.name,
          email: validation.data.email,
          subject: validation.data.subject,
          message: validation.data.message,
        },
      });

      if (error) {
        console.error('❌ Edge Function error:', error);
        throw error;
      }

      console.log('✅ Email sent via Edge Function:', data);
      */

      // OPTION 2: Store in database table (current implementation)
      // Create a "contact_messages" table in Supabase
      const { error: insertError } = await supabase
        .from('contact_messages')
        .insert({
          name: validation.data.name,
          email: validation.data.email,
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
      setLastSubmitTime(Date.now());
      setMessageSent(true);

      toast({
        title: 'Message Sent Successfully! 🎉',
        description:
          "Thank you for contacting us. We'll get back to you within 24 hours.",
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
      });
      setErrors({});
    } catch (error: any) {
      console.error('❌ Contact form error:', error);

      let errorMessage = 'Failed to send message. Please try again.';

      if (error?.message?.includes('Failed to fetch')) {
        errorMessage =
          'Network error. Please check your connection and try again.';
      } else if (error?.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <Link
            to="/"
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Get In Touch
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have questions about BuyAPixel.in? Need support? We&apos;d love to
            hear from you.
          </p>
        </div>

        {messageSent && (
          <div className="max-w-4xl mx-auto mb-8">
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Message Sent Successfully!
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Thank you for contacting us. We&apos;ll respond within 24
                      hours.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-primary" />
                  Send us a message
                </CardTitle>
                <CardDescription>
                  Fill out the form below and we&apos;ll respond as soon as
                  possible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name and Email Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Name Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="name">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="relative flex-1">
                          <Input
                            id="name"
                            name="name"
                            type="text"
                            placeholder="Your full name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            disabled={loading}
                            className={`h-11 ${
                              errors.name ? 'border-destructive' : ''
                            }`}
                            maxLength={100}
                          />
                        </div>
                      </div>
                      {errors.name && (
                        <p className="text-xs text-destructive flex items-center gap-1 ml-11">
                          <AlertCircle className="w-3 h-3" />
                          {errors.name}
                        </p>
                      )}
                    </div>

                    {/* Email Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        Email Address{' '}
                        <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
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
                            required
                            disabled={loading}
                            className={`h-11 ${
                              errors.email ? 'border-destructive' : ''
                            }`}
                            maxLength={100}
                          />
                        </div>
                      </div>
                      {errors.email && (
                        <p className="text-xs text-destructive flex items-center gap-1 ml-11">
                          <AlertCircle className="w-3 h-3" />
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subject Field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="subject">
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="flex h-11 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="relative flex-1">
                        <Input
                          id="subject"
                          name="subject"
                          type="text"
                          placeholder="What is this regarding?"
                          value={formData.subject}
                          onChange={handleInputChange}
                          required
                          disabled={loading}
                          className={`h-11 ${
                            errors.subject ? 'border-destructive' : ''
                          }`}
                          maxLength={150}
                        />
                      </div>
                    </div>
                    {errors.subject && (
                      <p className="text-xs text-destructive flex items-center gap-1 ml-11">
                        <AlertCircle className="w-3 h-3" />
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
                      placeholder="Tell us more about your inquiry..."
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      rows={6}
                      className={`resize-none ${
                        errors.message ? 'border-destructive' : ''
                      }`}
                      maxLength={1000}
                    />
                    {errors.message && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.message.length}/1000 characters
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 btn-premium"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info Sidebar */}
          <div className="space-y-6">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-xl">
                  Contact Information
                </CardTitle>
                <CardDescription>Other ways to reach us</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email</h3>
                    <a
                      href="mailto:support@buyapixel.in"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      support@buyapixel.in
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      We respond within 24 hours
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Phone</h3>
                    <p className="text-sm text-muted-foreground">
                      +91 XXX XXX XXXX
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mon-Fri, 9 AM - 6 PM IST
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Location</h3>
                    <p className="text-sm text-muted-foreground">
                      Mumbai, India
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Serving India & beyond
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Response Time</h3>
                    <p className="text-sm text-muted-foreground">
                      Within 24 hours
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Usually much faster!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-premium bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Why Contact Us?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">Fast response times</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">Knowledgeable support team</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">Solutions tailored to your needs</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-lg">
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    How do pixel purchases work?
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Select pixels, upload your content, pay securely, and your
                    pixels go live instantly.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    Can I edit my pixels after purchase?
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Yes! You can modify your pixel content anytime from your
                    profile.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    What payment methods do you accept?
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    We accept UPI, credit cards, debit cards, and net banking.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
