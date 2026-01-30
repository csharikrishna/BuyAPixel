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
  Lock,
  Calendar,
  Mail,
  Check,
  ChevronUp,
  List,
  Scale,
  Users,
  Ban,
  RefreshCw,
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
const LAST_UPDATED = 'December 10, 2025';

const SECTIONS: Section[] = [
  { id: 'agreement', title: '1. Agreement to Terms', icon: FileText },
  { id: 'service', title: '2. Service Description', icon: Shield },
  { id: 'obligations', title: '3. User Obligations', icon: Users },
  { id: 'payment', title: '4. Payment and Pricing', icon: DollarSign },
  { id: 'ip-rights', title: '5. Intellectual Property', icon: Lock },
  { id: 'content', title: '6. Content Review', icon: Ban },
  { id: 'liability', title: '7. Limitation of Liability', icon: AlertCircle },
  { id: 'privacy', title: '8. Privacy and Data', icon: Shield },
  { id: 'termination', title: '9. Termination', icon: RefreshCw },
  { id: 'disputes', title: '10. Dispute Resolution', icon: Scale },
  { id: 'changes', title: '11. Changes to Terms', icon: FileText },
  { id: 'contact', title: '12. Contact Information', icon: Mail },
];

// ======================
// COMPONENT
// ======================

const TermsOfService: React.FC = () => {
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
    handleScroll(); // Initial check

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
      // Ctrl/Cmd + K to toggle TOC
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowTOC((prev) => !prev);
      }

      // ESC to close TOC or clear search
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
      name: 'Terms of Service - BuyAPixel',
      description: 'Terms and conditions for using BuyAPixel pixel advertising platform',
      url: 'https://buyapixel.in/terms',
      dateModified: LAST_UPDATED,
      publisher: {
        '@type': 'Organization',
        name: 'BuyAPixel',
        url: 'https://buyapixel.in',
      },
    }),
    []
  );

  return (
    <>
      <Helmet>
        <title>Terms of Service - BuyAPixel.in | Legal Terms & Conditions</title>
        <meta
          name="description"
          content="Read BuyAPixel's Terms of Service. Understand the rules, obligations, and agreements for using our pixel advertising platform. Last updated December 10, 2025."
        />
        <meta property="og:title" content="Terms of Service - BuyAPixel.in" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Legal terms and conditions for BuyAPixel" />
        <link rel="canonical" href="https://buyapixel.in/terms" />
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
            <span className="text-foreground font-medium">Terms of Service</span>
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
                  <Scale className="w-3 h-3 mr-1" aria-hidden="true" />
                  Legal Agreement
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Terms of Service
                </h1>
                <p className="text-muted-foreground mt-2">
                  Legal terms and conditions for using BuyAPixel
                </p>
              </div>
              <Button variant="outline" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search terms... (Ctrl+K for TOC)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                  aria-label="Search terms of service"
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

              {/* TOC Toggle */}
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
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <strong>Last Updated:</strong> <time dateTime="2025-12-10">{LAST_UPDATED}</time>
                </div>
              </div>

              {/* 1. Agreement to Terms */}
              <section id="agreement" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  1. Agreement to Terms
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  By accessing and using BuyAPixel ("the Website"), you agree to be bound by these
                  Terms of Service. BuyAPixel is a pixel advertising platform where users can
                  purchase pixel blocks to display their advertisements permanently on our homepage.
                  If you do not agree to these terms, please do not use our service.
                </p>
              </section>

              {/* 2. Service Description */}
              <section id="service" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  2. Service Description
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  BuyAPixel operates as a digital advertising platform offering a pixel grid for
                  purchase. Users can buy pixel blocks (minimum 10×10 pixels) at the rate of ₹99 per
                  pixel to display their logos, images, or advertisements with clickable links to
                  their websites.
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>Each pixel block purchase is a one-time fee.</li>
                  <li>Purchased pixels remain visible for the lifetime of the website.</li>
                  <li>Minimum purchase is 100 pixels (10×10 block).</li>
                  <li>All purchases are final and non-refundable.</li>
                </ul>
              </section>

              {/* 3. User Obligations */}
              <section id="obligations" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  3. User Obligations and Acceptable Use
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  When using BuyAPixel, you agree to:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>Provide accurate and complete information during purchase.</li>
                  <li>Submit only legal, appropriate, and non-offensive content.</li>
                  <li>Ensure your advertisement complies with all applicable laws.</li>
                  <li>Respect intellectual property rights of others.</li>
                </ul>
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-yellow-800 dark:text-yellow-100">
                      <strong>Prohibited Content:</strong> We do not accept advertisements containing
                      or promoting illegal activities, adult content, hate speech, violence, malware,
                      scams, or any content that violates applicable laws.
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Payment Terms */}
              <section id="payment" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  4. Payment and Pricing
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Pixel blocks are sold at ₹99 INR per pixel with a minimum purchase of 100 pixels.
                  All payments must be made in full before your advertisement is displayed. We accept
                  UPI, major credit cards, debit cards, and other payment methods as specified on our
                  payment page.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>Refund Policy:</strong> All sales are final. Due to the permanent nature of
                  pixel placement, we do not offer refunds once your advertisement has been published
                  on the Website.
                </p>
              </section>

              {/* 5. Intellectual Property */}
              <section id="ip-rights" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  5. Intellectual Property Rights
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  You retain all rights to the content you submit. By uploading your advertisement,
                  you grant BuyAPixel a non-exclusive, worldwide, royalty-free license to display your
                  content on our platform. You represent and warrant that you own or have the
                  necessary rights to all content you submit.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  The BuyAPixel website design, layout, and branding are protected by copyright and
                  trademark laws. Unauthorized use is prohibited.
                </p>
              </section>

              {/* 6. Content Moderation */}
              <section id="content" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  6. Content Review and Removal
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  BuyAPixel reserves the right to review all submitted content before publication. We
                  may reject or remove any advertisement that violates these Terms of Service,
                  contains prohibited content, or is deemed inappropriate at our sole discretion. In
                  cases of content removal for policy violations, no refund will be issued.
                </p>
              </section>

              {/* 7. Limitation of Liability */}
              <section id="liability" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  7. Limitation of Liability
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  BuyAPixel is provided "as is" without warranties of any kind. We are not liable for
                  any damages arising from your use of the Website, including but not limited to
                  direct, indirect, incidental, or consequential damages. This includes loss of
                  profits, data, or business opportunities.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  While we strive to maintain continuous service, we do not guarantee uninterrupted
                  access to the Website. We are not responsible for the content or practices of
                  third-party websites linked through user advertisements.
                </p>
              </section>

              {/* 8. Privacy and Data */}
              <section id="privacy" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  8. Privacy and Data Collection
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Your use of BuyAPixel is also governed by our{' '}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  . We collect and process personal information necessary to provide our services,
                  including payment information and contact details. By using our service, you consent
                  to our data practices as described in our Privacy Policy.
                </p>
              </section>

              {/* 9. Termination */}
              <section id="termination" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  9. Termination and Account Suspension
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  BuyAPixel reserves the right to suspend or terminate access to our services for any
                  user who violates these Terms of Service. We may also terminate or modify our
                  services at any time with reasonable notice. Upon termination, your right to use the
                  Website ceases immediately.
                </p>
              </section>

              {/* 10. Dispute Resolution */}
              <section id="disputes" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  10. Dispute Resolution and Governing Law
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Any disputes arising from these Terms of Service or your use of BuyAPixel shall be
                  resolved through arbitration in accordance with Indian law. These terms are governed
                  by the laws of India, without regard to conflict of law principles.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  You agree that any legal action must be commenced within one year after the claim
                  arose.
                </p>
              </section>

              {/* 11. Changes to Terms */}
              <section id="changes" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  11. Changes to Terms of Service
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  We reserve the right to modify these Terms of Service at any time. Changes will be
                  effective immediately upon posting to the Website. Your continued use of BuyAPixel
                  after changes constitutes acceptance of the modified terms. We encourage you to
                  review these terms periodically.
                </p>
              </section>

              {/* 12. Contact Information */}
              <section id="contact" className="mb-6 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  12. Contact Information
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  If you have questions about these Terms of Service, please contact us at:
                </p>
                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <strong className="text-slate-800 dark:text-slate-100">BuyAPixel</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href="mailto:legal@buyapixel.in" className="text-primary hover:underline">
                        legal@buyapixel.in
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a
                        href="mailto:support@buyapixel.in"
                        className="text-primary hover:underline"
                      >
                        support@buyapixel.in
                      </a>
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
                      By using BuyAPixel, you acknowledge that you have read, understood, and agree to
                      be bound by these Terms of Service.
                    </strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link to="/privacy">
                <Shield className="w-4 h-4 mr-2" />
                Privacy Policy
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact">
                <Mail className="w-4 h-4 mr-2" />
                Contact Us
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/help">
                <AlertCircle className="w-4 h-4 mr-2" />
                Help Center
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

export default TermsOfService;
