import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  RefreshCw,
  Smartphone,
  XCircle,
  Search,
  Mail,
  DollarSign,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ======================
// TYPES & INTERFACES
// ======================

interface PaymentScenario {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  description: string;
  steps: string[];
  urgency: 'normal' | 'high' | 'critical';
}

// ======================
// CONSTANTS
// ======================

const PAYMENT_SCENARIOS: PaymentScenario[] = [
  {
    id: 'upi-failed',
    title: 'UPI Payment Failed',
    icon: Smartphone,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    description: 'Your UPI payment was not processed or showed an error during transaction.',
    steps: [
      'Check your UPI app (Google Pay, PhonePe, Paytm) for the transaction status.',
      'If the payment shows "Failed" in your UPI app, no money was deducted. Try again.',
      'If the payment shows "Pending", wait 15-30 minutes for it to auto-resolve.',
      'Ensure your UPI app is updated to the latest version.',
      'Try switching to a different UPI app or payment method (Card, Net Banking).',
      'If the issue persists, contact your bank or UPI app support.',
      'Contact BuyASpot support with your UPI transaction reference number if needed.',
    ],
    urgency: 'normal',
  },
  {
    id: 'payment-deducted',
    title: 'Payment Deducted but Order Not Confirmed',
    icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    description: 'Money was deducted from your account but the pixel purchase was not confirmed.',
    steps: [
      'Don\'t panic! This can happen due to network issues during payment verification.',
      'Wait 5-10 minutes and refresh the page — many payments auto-reconcile.',
      'Check your email for a purchase confirmation from BuyASpot.',
      'Check your profile page to see if the pixels appear under "My Pixels".',
      'If not resolved in 30 minutes, take a screenshot of your bank/UPI transaction.',
      'Contact BuyASpot support with: your transaction ID, amount, date & time, and screenshot.',
      'Our team will verify and resolve within 2-4 hours (usually faster).',
    ],
    urgency: 'critical',
  },
  {
    id: 'refund-timeline',
    title: 'Refund Processing Timeline',
    icon: Clock,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    description: 'Understanding how long refunds take to process and when to expect your money back.',
    steps: [
      'Refund requests are reviewed within 24 hours of submission.',
      'Once approved, refunds are initiated immediately via Razorpay.',
      'UPI refunds: 5-7 business days to reflect in your account.',
      'Card refunds: 5-10 business days depending on your bank.',
      'Net Banking refunds: 3-7 business days.',
      'You\'ll receive an email confirmation when the refund is initiated.',
      'If the refund hasn\'t arrived after the expected timeline, contact your bank first, then BuyASpot support.',
    ],
    urgency: 'normal',
  },
  {
    id: 'pending-verification',
    title: 'Pending Payment Verification',
    icon: Search,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    description: 'Your payment is in a pending state and hasn\'t been verified yet.',
    steps: [
      'Payments may enter "Pending" status due to bank processing delays.',
      'Most pending payments are verified automatically within 15-30 minutes.',
      'Do NOT attempt to make a duplicate payment while the first one is pending.',
      'Check your bank statement — if the amount was deducted, the payment is likely being processed.',
      'If the payment is still pending after 1 hour, contact support with your payment details.',
      'Our system automatically reconciles pending payments via Razorpay webhooks.',
      'In rare cases, pending payments that fail will be auto-refunded within 5-7 business days.',
    ],
    urgency: 'high',
  },
  {
    id: 'payment-status',
    title: 'Payment Verification Status',
    icon: CheckCircle2,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    description: 'How to check the current status of your payment and what each status means.',
    steps: [
      '"Processing" — Payment is being verified by our payment gateway. Wait 2-5 minutes.',
      '"Confirmed" / "Success" — Payment verified, your pixels are live on the canvas.',
      '"Pending Verification" — Payment received but awaiting final confirmation. Usually resolves within 30 minutes.',
      '"Failed" — Payment was not successful. No money was deducted (or will be auto-refunded).',
      '"Refund Initiated" — Your refund has been processed and is on its way back.',
      'Check your profile page for real-time purchase status updates.',
      'Check your email for payment confirmation or contact support if status is unclear.',
    ],
    urgency: 'normal',
  },
  {
    id: 'double-charge',
    title: 'Charged Twice for Same Purchase',
    icon: XCircle,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    description: 'You were charged multiple times for the same pixel block purchase.',
    steps: [
      'Check your bank statement carefully — sometimes temporary "holds" appear as charges but are released.',
      'Wait 24 hours for temporary holds to clear automatically.',
      'If you see two confirmed charges after 24 hours, this is a duplicate payment.',
      'Contact BuyASpot support immediately with both transaction IDs.',
      'Attach screenshots of your bank statement showing both charges.',
      'Duplicate payments are refunded within 1-3 business days after verification.',
      'We have systems in place (idempotency keys) to prevent duplicates, but edge cases can occur.',
    ],
    urgency: 'critical',
  },
];

// ======================
// COMPONENT
// ======================

const PaymentHelp = () => {
  const [expandedScenario, setExpandedScenario] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    setIsVisible(true);
  }, []);

  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: PAYMENT_SCENARIOS.map((scenario) => ({
        '@type': 'Question',
        name: scenario.title,
        acceptedAnswer: {
          '@type': 'Answer',
          text: scenario.steps.join(' '),
        },
      })),
    }),
    []
  );

  const breadcrumbSchema = useMemo(
    () => generateBreadcrumbSchema([
      { name: 'Home', url: 'https://buyaspot.in' },
      { name: 'Payment Help', url: 'https://buyaspot.in/payment-help' }
    ]),
    []
  );

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-amber-500 text-xs">Important</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <SEO
        title="Payment Help - Resolve Payment Issues | BuyASpot"
        description="Having payment problems on BuyASpot? Find solutions for UPI failures, pending payments, refund timelines, and payment verification issues. Get help quickly."
        canonical="https://buyaspot.in/payment-help"
        keywords={['payment help', 'UPI failed', 'refund', 'payment issues', 'BuyASpot support']}
        type="website"
        structuredData={[breadcrumbSchema, structuredData]}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header />

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Payment Help</span>
          </nav>

          {/* Hero Section */}
          <div
            className={cn(
              'text-center mb-12 space-y-4 transition-all duration-700',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <Badge variant="secondary" className="mb-2">
              <CreditCard className="w-3 h-3 mr-1" aria-hidden="true" />
              Payment Support
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900">
              Payment <span className="text-primary">Issues</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Having trouble with a payment? Find solutions to common payment problems below.
              If you can't find what you're looking for, contact our support team.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <Button variant="default" asChild>
                <Link to="/contact">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Support
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/refund-policy">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Refund Policy
                </Link>
              </Button>
            </div>
          </div>

          {/* Trust Badges */}
          <div
            className={cn(
              'grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 transition-all duration-700 delay-100',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            {[
              { icon: Shield, label: 'Razorpay Secured', sublabel: 'PCI-DSS Compliant', color: 'text-green-600' },
              { icon: Zap, label: 'Fast Resolution', sublabel: 'Within 2-4 hours', color: 'text-blue-600' },
              { icon: RefreshCw, label: 'Easy Refunds', sublabel: '3-7 business days', color: 'text-purple-600' },
              { icon: Clock, label: '24/7 Support', sublabel: 'We\'re always here', color: 'text-amber-600' },
            ].map((badge) => {
              const Icon = badge.icon;
              return (
                <Card key={badge.label} className="text-center p-4 hover:shadow-md transition-shadow">
                  <Icon className={cn('w-8 h-8 mx-auto mb-2', badge.color)} aria-hidden="true" />
                  <p className="font-semibold text-sm">{badge.label}</p>
                  <p className="text-xs text-muted-foreground">{badge.sublabel}</p>
                </Card>
              );
            })}
          </div>

          {/* Payment Scenarios */}
          <div
            className={cn(
              'grid lg:grid-cols-12 gap-8 mb-16 transition-all duration-700 delay-200',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            {/* Main Content */}
            <div className="lg:col-span-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-primary" aria-hidden="true" />
                Common Payment Scenarios
              </h2>

              <Accordion
                type="single"
                collapsible
                className="w-full space-y-4"
                value={expandedScenario}
                onValueChange={setExpandedScenario}
              >
                {PAYMENT_SCENARIOS.map((scenario) => {
                  const Icon = scenario.icon;
                  return (
                    <AccordionItem
                      key={scenario.id}
                      value={scenario.id}
                      className="bg-white px-6 rounded-lg border-2 hover:border-primary/20 transition-colors"
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3 text-left">
                          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', scenario.iconBg)}>
                            <Icon className={cn('w-5 h-5', scenario.iconColor)} aria-hidden="true" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{scenario.title}</span>
                              {getUrgencyBadge(scenario.urgency)}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{scenario.description}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-6">
                        <div className="pl-13 space-y-3 ml-13">
                          <p className="text-sm font-medium text-muted-foreground mb-3">
                            Follow these steps to resolve this issue:
                          </p>
                          <ol className="space-y-2">
                            {scenario.steps.map((step, index) => (
                              <li key={index} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                                  {index + 1}
                                </span>
                                <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                  {step}
                                </span>
                              </li>
                            ))}
                          </ol>
                          <div className="mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" asChild>
                              <Link to="/contact">
                                Still need help? Contact Support <ArrowRight className="w-3 h-3 ml-1" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Emergency Contact */}
              <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-5 h-5" />
                    Payment Emergency?
                  </CardTitle>
                  <CardDescription className="text-red-600/70 dark:text-red-300/70">
                    If money was deducted but your purchase wasn't confirmed, contact us immediately.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-red-600 hover:bg-red-700" asChild>
                    <a href="mailto:support@buyaspot.in?subject=URGENT: Payment Issue">
                      <Mail className="w-4 h-4 mr-2" />
                      Email Support (Urgent)
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Security Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    Payment Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Powered by Razorpay (trusted by 500K+ businesses)',
                    '256-bit SSL encryption on all transactions',
                    'PCI-DSS Level 1 certified security',
                    'HMAC signature verification on every payment',
                    'Your card/UPI details are never stored',
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Related Pages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: 'Refund Policy', href: '/refund-policy', icon: DollarSign },
                    { label: 'Help Center', href: '/help', icon: HelpCircle },
                    { label: 'Contact Support', href: '/contact', icon: Mail },
                    { label: 'Terms of Service', href: '/terms', icon: Shield },
                  ].map((link) => {
                    const LinkIcon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        to={link.href}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <LinkIcon className="w-4 h-4 text-muted-foreground" />
                          {link.label}
                        </span>
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            </aside>
          </div>

          {/* CTA Section */}
          <section
            className={cn(
              'text-center py-16 px-6 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 rounded-2xl border-2 border-primary/20 transition-all duration-700 delay-300',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <h2 className="text-3xl font-bold mb-4">Still Need Help?</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Our support team is available 24/7 via email. We typically respond within 2-4 hours
              for payment-related issues.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/contact">
                  <Mail className="w-5 h-5 mr-2" />
                  Contact Support
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/help">
                  <HelpCircle className="w-5 h-5 mr-2" />
                  Help Center
                </Link>
              </Button>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default PaymentHelp;
