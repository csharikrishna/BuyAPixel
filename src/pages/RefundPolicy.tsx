import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Search,
  X,
  ChevronRight,
  Shield,
  FileText,
  AlertCircle,
  DollarSign,
  Clock,
  Mail,
  Check,
  ChevronUp,
  List,
  RefreshCw,
  Ban,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// ======================
// TYPES & INTERFACES
// ======================

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ======================
// CONSTANTS
// ======================

const SCROLL_THRESHOLD = 100;
const LAST_UPDATED = 'May 27, 2026';

const SECTIONS: Section[] = [
  { id: 'overview', title: '1. Overview', icon: FileText },
  { id: 'eligibility', title: '2. Refund Eligibility', icon: CheckCircle2 },
  { id: 'non-refundable', title: '3. Non-Refundable Purchases', icon: Ban },
  { id: 'timeline', title: '4. Processing Timelines', icon: Clock },
  { id: 'cancellation', title: '5. Cancellation Rules', icon: RefreshCw },
  { id: 'how-to-request', title: '6. How to Request a Refund', icon: HelpCircle },
  { id: 'payment-disputes', title: '7. Payment Disputes', icon: AlertCircle },
  { id: 'marketplace', title: '8. Marketplace Refunds', icon: DollarSign },
  { id: 'contact', title: '9. Contact Information', icon: Mail },
];

// ======================
// COMPONENT
// ======================

const RefundPolicy: React.FC = () => {
  const navigate = useNavigate();

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    setIsVisible(true);
  }, []);

  // Track reading progress and active section
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercentage = (scrollTop / (documentHeight - windowHeight)) * 100;

      setReadingProgress(Math.min(100, Math.max(0, scrollPercentage)));
      setShowScrollTop(scrollTop > SCROLL_THRESHOLD);

      // Update active section
      const sections = contentRef.current.querySelectorAll('section[id]');
      let currentSection = '';

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 150) {
          currentSection = section.id;
        }
      });

      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter content based on search
  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const sections = contentRef.current?.querySelectorAll('section');
    const matches: string[] = [];

    sections?.forEach((section) => {
      const text = section.textContent?.toLowerCase() || '';
      if (text.includes(query)) {
        matches.push(section.id);
      }
    });

    return matches;
  }, [searchQuery]);

  // Handlers
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      setShowTOC(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowTOC((prev) => !prev);
      }
      if (e.key === 'Escape') {
        if (showTOC) {
          setShowTOC(false);
        } else if (searchQuery) {
          clearSearch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTOC, searchQuery, clearSearch]);

  // Schema.org structured data
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Refund Policy - BuyASpot',
      description: 'Refund policy for BuyASpot pixel advertising platform',
      url: 'https://buyaspot.in/refund-policy',
      dateModified: LAST_UPDATED,
      publisher: {
        '@type': 'Organization',
        name: 'BuyASpot',
        url: 'https://buyaspot.in',
      },
    }),
    []
  );

  return (
    <>
      <Helmet>
        <title>Refund Policy - buyaspot.in | Refund & Cancellation Rules</title>
        <meta
          name="description"
          content="Read BuyASpot's Refund Policy. Understand refund eligibility, processing timelines, cancellation rules, and how to request a refund for pixel purchases."
        />
        <meta property="og:title" content="Refund Policy - buyaspot.in" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Refund eligibility, timelines, and cancellation rules for BuyASpot" />
        <link rel="canonical" href="https://buyaspot.in/refund-policy" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Reading Progress Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${readingProgress}%` }}
            role="progressbar"
            aria-valuenow={readingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Reading progress"
          />
        </div>

        <Header />

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Breadcrumbs */}
          <nav
            className="flex items-center gap-2 text-sm text-muted-foreground mb-6"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Refund Policy</span>
          </nav>

          {/* Header Section */}
          <div
            className={cn(
              'mb-8 transition-all duration-700',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  <DollarSign className="w-3 h-3 mr-1" aria-hidden="true" />
                  Refund Policy
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Refund Policy
                </h1>
                <p className="text-muted-foreground mt-2">
                  Our commitment to fair and transparent refund practices
                </p>
              </div>
              <Button variant="outline" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search refund policy... (Ctrl+K for TOC)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                  aria-label="Search refund policy"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setShowTOC(!showTOC)}>
                <List className="w-4 h-4 mr-2" />
                Contents
              </Button>
            </div>

            {/* Search Results */}
            {searchQuery && highlightedContent && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium mb-2">
                  Found in {highlightedContent.length} section{highlightedContent.length !== 1 && 's'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {highlightedContent.map((sectionId) => {
                    const section = SECTIONS.find((s) => s.id === sectionId);
                    return section ? (
                      <Button
                        key={sectionId}
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToSection(sectionId)}
                      >
                        {section.title}
                      </Button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Table of Contents */}
          {showTOC && (
            <Card className="mb-8">
              <CardContent className="pt-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <List className="w-5 h-5" />
                  Table of Contents
                </h2>
                <nav aria-label="Table of contents">
                  <ul className="space-y-2">
                    {SECTIONS.map((section) => {
                      const Icon = section.icon;
                      return (
                        <li key={section.id}>
                          <button
                            onClick={() => scrollToSection(section.id)}
                            className={cn(
                              'flex items-center gap-2 text-left hover:text-primary transition-colors w-full p-2 rounded-lg hover:bg-muted',
                              activeSection === section.id && 'text-primary font-semibold bg-muted'
                            )}
                          >
                            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {section.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <Card
            className={cn(
              'transition-all duration-700 delay-200',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <CardContent className="p-6 md:p-10" ref={contentRef}>
              {/* Last Updated */}
              <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-slate-800 dark:text-blue-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <strong>Last Updated:</strong> <time dateTime="2026-05-27">{LAST_UPDATED}</time>
                </div>
              </div>

              {/* 1. Overview */}
              <section id="overview" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  1. Overview
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  At BuyASpot, we are committed to ensuring a fair and transparent experience for all
                  users. This Refund Policy outlines the conditions under which refunds may be issued,
                  processing timelines, and how to submit a refund request. By purchasing pixels on
                  our platform, you agree to the terms outlined in this policy.
                </p>
              </section>

              {/* 2. Refund Eligibility */}
              <section id="eligibility" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  2. Refund Eligibility
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Refunds may be issued under the following circumstances:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>Technical Errors:</strong> If a technical issue on our platform prevents
                    your content from being displayed correctly after purchase. You must report the
                    issue within <strong>24 hours</strong> of purchase with evidence (screenshots).
                  </li>
                  <li>
                    <strong>Duplicate Payments:</strong> If you are charged multiple times for the
                    same pixel block due to a system error. Refunds for duplicates are processed
                    within <strong>1 hour</strong> of notification.
                  </li>
                  <li>
                    <strong>Payment Deducted, Purchase Not Confirmed:</strong> If payment was
                    deducted from your account but the pixel purchase was not confirmed in our system.
                    Contact support within 24 hours with your transaction ID.
                  </li>
                  <li>
                    <strong>Accidental Purchases:</strong> If you accidentally purchased the wrong
                    pixels, we may issue a refund within <strong>1 hour</strong> of purchase,
                    provided the content has not been published.
                  </li>
                </ul>
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="text-green-800 dark:text-green-100">
                      <strong>Tip:</strong> Always save your transaction ID and payment confirmation
                      screenshot. This helps us process your refund faster.
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Non-Refundable Purchases */}
              <section id="non-refundable" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  3. Non-Refundable Purchases
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  The following types of purchases are <strong>not eligible</strong> for refunds:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    Pixel purchases where content has already been published and displayed on the
                    canvas for more than 1 hour.
                  </li>
                  <li>
                    Change of mind after content has gone live (pixels are permanent digital assets).
                  </li>
                  <li>
                    Content removed due to policy violations (hate speech, illegal content, etc.) —
                    no refund will be issued.
                  </li>
                  <li>
                    Marketplace transactions between users (buyer-seller disputes are handled
                    separately; see Section 8).
                  </li>
                </ul>
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-yellow-800 dark:text-yellow-100">
                      <strong>Important:</strong> Since pixel purchases are permanent placements
                      (similar to digital real estate), all sales are generally considered final once
                      content is live.
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Processing Timelines */}
              <section id="timeline" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  4. Processing Timelines
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                  Once a refund request is approved, here are the expected processing times:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-semibold border border-border">Refund Type</th>
                        <th className="text-left p-3 font-semibold border border-border">Processing Time</th>
                        <th className="text-left p-3 font-semibold border border-border">Refund Method</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-300">
                      <tr>
                        <td className="p-3 border border-border">Duplicate payment</td>
                        <td className="p-3 border border-border">1–3 business days</td>
                        <td className="p-3 border border-border">Original payment method</td>
                      </tr>
                      <tr className="bg-muted/20">
                        <td className="p-3 border border-border">Technical error</td>
                        <td className="p-3 border border-border">3–5 business days</td>
                        <td className="p-3 border border-border">Original payment method</td>
                      </tr>
                      <tr>
                        <td className="p-3 border border-border">Payment not confirmed</td>
                        <td className="p-3 border border-border">3–7 business days</td>
                        <td className="p-3 border border-border">Original payment method</td>
                      </tr>
                      <tr className="bg-muted/20">
                        <td className="p-3 border border-border">Accidental purchase</td>
                        <td className="p-3 border border-border">1–3 business days</td>
                        <td className="p-3 border border-border">Original payment method</td>
                      </tr>
                      <tr>
                        <td className="p-3 border border-border">UPI refunds</td>
                        <td className="p-3 border border-border">5–7 business days</td>
                        <td className="p-3 border border-border">Original UPI ID</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Note: Bank processing times may add additional 2–5 business days depending on your
                  bank or payment provider.
                </p>
              </section>

              {/* 5. Cancellation Rules */}
              <section id="cancellation" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  5. Cancellation Rules
                </h2>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    You may cancel a pixel purchase <strong>before</strong> completing the payment
                    checkout flow at no cost.
                  </li>
                  <li>
                    Once payment is completed and confirmed, the purchase is considered final.
                  </li>
                  <li>
                    You may remove your content from purchased pixels at any time from your profile
                    dashboard, but this does not constitute a cancellation or refund.
                  </li>
                  <li>
                    Marketplace listings can be cancelled (delisted) at any time before a buyer
                    completes the purchase.
                  </li>
                </ul>
              </section>

              {/* 6. How to Request a Refund */}
              <section id="how-to-request" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  6. How to Request a Refund
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                  To request a refund, follow these steps:
                </p>
                <ol className="list-decimal pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-3">
                  <li>
                    Go to our{' '}
                    <Link to="/contact" className="text-primary hover:underline font-medium">
                      Contact Support
                    </Link>{' '}
                    page and select <strong>"Refund Request"</strong> as the issue category.
                  </li>
                  <li>
                    Provide your <strong>email address</strong>, <strong>transaction ID</strong> or{' '}
                    <strong>payment receipt</strong>, and a brief description of why you're
                    requesting a refund.
                  </li>
                  <li>
                    Attach any supporting documents (screenshots, payment proof) using the file
                    upload feature.
                  </li>
                  <li>
                    Submit the request. You'll receive a <strong>Ticket ID</strong> for tracking.
                  </li>
                  <li>
                    Our support team will review your request within <strong>24 hours</strong> and
                    respond via email.
                  </li>
                </ol>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
                  You can also email us directly at{' '}
                  <a href="mailto:support@buyaspot.in" className="text-primary hover:underline">
                    support@buyaspot.in
                  </a>{' '}
                  with subject line <strong>"Refund Request - [Your Transaction ID]"</strong>.
                </p>
              </section>

              {/* 7. Payment Disputes */}
              <section id="payment-disputes" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  7. Payment Disputes
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  If you notice an unauthorized or incorrect charge:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    Contact our support team immediately at{' '}
                    <a href="mailto:support@buyaspot.in" className="text-primary hover:underline">
                      support@buyaspot.in
                    </a>
                    .
                  </li>
                  <li>
                    Provide your payment details, bank statement screenshot, and transaction ID.
                  </li>
                  <li>
                    We will investigate the dispute within 48 hours and work with our payment
                    processor (Razorpay) to resolve it.
                  </li>
                  <li>
                    If the dispute is valid, a full refund will be processed to the original payment
                    method.
                  </li>
                </ul>
              </section>

              {/* 8. Marketplace Refunds */}
              <section id="marketplace" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  8. Marketplace Refunds
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  For pixel purchases made through the Marketplace (user-to-user transactions):
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    Marketplace purchases are between individual users and are generally{' '}
                    <strong>non-refundable</strong>.
                  </li>
                  <li>
                    If you experience a technical issue with a marketplace purchase (e.g., ownership
                    not transferred), contact support immediately.
                  </li>
                  <li>
                    BuyASpot may mediate disputes between buyers and sellers at its discretion.
                  </li>
                  <li>
                    Platform fees (5%) charged on marketplace sales are non-refundable.
                  </li>
                </ul>
              </section>

              {/* 9. Contact Information */}
              <section id="contact" className="mb-6 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  9. Contact Information
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  For refund inquiries or payment-related issues, please contact us:
                </p>
                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <strong className="text-slate-800 dark:text-slate-100">BuyASpot Support</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href="mailto:support@buyaspot.in" className="text-primary hover:underline">
                        support@buyaspot.in
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Response time: Within 24 hours
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Acceptance */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-green-800 dark:text-green-100">
                    <strong>
                      By purchasing pixels on BuyASpot, you acknowledge that you have read, understood,
                      and agree to this Refund Policy.
                    </strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link to="/terms">
                <FileText className="w-4 h-4 mr-2" />
                Terms of Service
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/payment-help">
                <DollarSign className="w-4 h-4 mr-2" />
                Payment Help
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact">
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </Link>
            </Button>
          </div>
        </main>

        <Footer />

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            size="icon"
            className="fixed bottom-8 right-8 rounded-full shadow-lg z-40"
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
        )}
      </div>
    </>
  );
};

export default RefundPolicy;
