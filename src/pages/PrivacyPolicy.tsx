import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Search,
  X,
  ChevronRight,
  Shield,
  Eye,
  Lock,
  FileText,
  Mail,
  Calendar,
  Check,
  AlertCircle,
  ChevronUp,
  List,
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
  { id: 'introduction', title: '1. Introduction', icon: FileText },
  { id: 'information-collection', title: '2. Information We Collect', icon: Eye },
  { id: 'information-use', title: '3. How We Use Your Information', icon: Shield },
  { id: 'cookies', title: '4. Cookies and Tracking', icon: Lock },
  { id: 'legal-bases', title: '5. Legal Bases', icon: FileText },
  { id: 'sharing', title: '6. Information Sharing', icon: Shield },
  { id: 'transfers', title: '7. International Transfers', icon: Shield },
  { id: 'retention', title: '8. Data Retention', icon: Calendar },
  { id: 'rights', title: '9. Your Rights', icon: Check },
  { id: 'security', title: '10. Data Security', icon: Lock },
  { id: 'children', title: '11. Children\'s Privacy', icon: Shield },
  { id: 'changes', title: '12. Policy Changes', icon: FileText },
  { id: 'contact', title: '13. Contact Us', icon: Mail },
];

// ======================
// COMPONENT
// ======================

const PrivacyPolicy: React.FC = () => {
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
      name: 'Privacy Policy - BuyAPixel',
      description: 'Privacy Policy for BuyAPixel - How we collect, use, and protect your data',
      url: 'https://buyapixel.in/privacy',
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
        <title>Privacy Policy - BuyAPixel.in | Data Protection & Privacy</title>
        <meta
          name="description"
          content="Read BuyAPixel's Privacy Policy to understand how we collect, use, protect, and share your personal information. Last updated December 10, 2025."
        />
        <meta property="og:title" content="Privacy Policy - BuyAPixel.in" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Our commitment to protecting your privacy and data" />
        <link rel="canonical" href="https://buyapixel.in/privacy" />
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
            <span className="text-foreground font-medium">Privacy Policy</span>
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
                  <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                  Legal Document
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Privacy Policy
                </h1>
                <p className="text-muted-foreground mt-2">
                  How we collect, use, and protect your personal information
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
                  placeholder="Search privacy policy... (Ctrl+K for TOC)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                  aria-label="Search privacy policy"
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

              {/* 1. Introduction */}
              <section id="introduction" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  1. Introduction
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  This Privacy Policy explains how BuyAPixel ("we", "us", or "our") collects, uses,
                  discloses, and protects your personal information when you access or use our
                  website and services. By using BuyAPixel, you agree to the collection and use of
                  information in accordance with this Privacy Policy.
                </p>
              </section>

              {/* 2. Information We Collect */}
              <section id="information-collection" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  2. Information We Collect
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  We collect information that you provide directly to us, as well as data collected
                  automatically when you use our website.
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>Account and Contact Data:</strong> Name, email address, password, and
                    profile details you submit when creating an account or contacting us.
                  </li>
                  <li>
                    <strong>Payment Information:</strong> Billing details and transaction data
                    processed via our payment providers (card numbers are handled by third‑party
                    processors, not stored by us).
                  </li>
                  <li>
                    <strong>Usage Data:</strong> IP address, browser type, device information, pages
                    visited, time and date of visit, and other analytics data.
                  </li>
                  <li>
                    <strong>Advertising and Pixel Data:</strong> Information related to the pixel
                    blocks you purchase, linked URLs, images, and interaction data with your ads.
                  </li>
                </ul>
              </section>

              {/* 3. How We Use Your Information */}
              <section id="information-use" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  3. How We Use Your Information
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  We use the information we collect for specific, clearly defined purposes.
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>To create and manage your account and purchases.</li>
                  <li>To process payments and prevent fraud.</li>
                  <li>To operate, maintain, and improve our website and services.</li>
                  <li>To display your purchased pixel ads and related content.</li>
                  <li>To provide customer support and respond to your requests.</li>
                  <li>To send service‑related communications, updates, and important notices.</li>
                  <li>To perform analytics, monitor usage, and improve user experience.</li>
                </ul>
              </section>

              {/* 4. Cookies and Tracking */}
              <section id="cookies" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  4. Cookies and Tracking Technologies
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  We use cookies and similar technologies to recognize your browser, remember your
                  preferences, and analyze how you interact with our website.
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>Essential cookies:</strong> Required for core site functionality, such as
                    security and session management.
                  </li>
                  <li>
                    <strong>Analytics cookies:</strong> Help us understand how users navigate the
                    site so we can improve performance.
                  </li>
                  <li>
                    <strong>Advertising and tracking pixels:</strong> May be used to measure ad
                    performance and deliver relevant content, subject to your consent where required
                    by law.
                  </li>
                </ul>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-3">
                  Where required, we will obtain your consent before setting non‑essential cookies
                  and provide options to manage or withdraw consent at any time.
                </p>
              </section>

              {/* 5. Legal Bases */}
              <section id="legal-bases" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  5. Legal Bases for Processing
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Where applicable data protection laws require it, we process your personal data
                  based on one or more of the following legal bases:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>Your consent (for example, for certain cookies or marketing).</li>
                  <li>
                    Performance of a contract (to provide the services you requested, such as pixel
                    purchases).
                  </li>
                  <li>
                    Compliance with legal obligations (for example, accounting or tax requirements).
                  </li>
                  <li>
                    Our legitimate interests (such as site security, fraud prevention, and service
                    improvement), balanced against your rights.
                  </li>
                </ul>
              </section>

              {/* 6. Information Sharing */}
              <section id="sharing" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  6. How We Share Your Information
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  We do not sell your personal information, but we may share it with trusted third
                  parties in limited circumstances.
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>Service providers:</strong> Payment processors, hosting providers,
                    analytics services, and customer support tools that help us operate the website.
                  </li>
                  <li>
                    <strong>Advertising and analytics partners:</strong> To measure performance and,
                    where permitted, deliver relevant ads.
                  </li>
                  <li>
                    <strong>Legal and compliance:</strong> Where required by law, regulation, or
                    valid legal process, or to protect our rights, users, or the public.
                  </li>
                  <li>
                    <strong>Business transfers:</strong> In the event of a merger, acquisition, or
                    sale of assets, your information may be transferred as part of the transaction.
                  </li>
                </ul>
              </section>

              {/* 7. International Transfers */}
              <section id="transfers" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  7. International Data Transfers
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Depending on where you are located and where our service providers operate, your
                  information may be transferred to and processed in countries that may have different
                  data protection laws than your home jurisdiction.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Where required, we implement appropriate safeguards, such as contractual
                  protections, to help ensure your personal data remains protected.
                </p>
              </section>

              {/* 8. Data Retention */}
              <section id="retention" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  8. Data Retention
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  We retain your personal information only for as long as necessary to fulfill the
                  purposes described in this Privacy Policy, unless a longer retention period is
                  required or permitted by law.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Criteria used include the duration of your account, legal obligations, and the need
                  to resolve disputes or enforce our agreements.
                </p>
              </section>

              {/* 9. Your Rights */}
              <section id="rights" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  9. Your Rights and Choices
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Depending on your location and applicable law, you may have certain rights regarding
                  your personal information.
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>Access to the personal data we hold about you.</li>
                  <li>Correction of inaccurate or incomplete data.</li>
                  <li>Deletion of your personal data, subject to legal limits.</li>
                  <li>Restriction or objection to certain processing activities.</li>
                  <li>
                    Data portability, where applicable, to receive data in a structured, commonly used
                    format.
                  </li>
                  <li>
                    Withdrawal of consent where processing is based on your consent (for example, for
                    certain cookies or marketing).
                  </li>
                </ul>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-3">
                  To exercise these rights, please contact us using the details in the "Contact Us"
                  section below. We may need to verify your identity before responding to your
                  request.
                </p>
              </section>

              {/* 10. Security */}
              <section id="security" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  10. Data Security
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  We use appropriate technical and organizational measures to protect your personal
                  information from unauthorized access, loss, misuse, or alteration.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  However, no method of transmission over the internet or electronic storage is
                  completely secure, and we cannot guarantee absolute security.
                </p>
              </section>

              {/* 11. Children's Privacy */}
              <section id="children" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  11. Children's Privacy
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  BuyAPixel is not directed to children under the age of 13 (or a higher age as
                  required by applicable law), and we do not knowingly collect personal information
                  from children.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  If you believe a child has provided us with personal information, please contact us
                  so we can take appropriate steps to delete such data.
                </p>
              </section>

              {/* 12. Changes */}
              <section id="changes" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  12. Changes to This Privacy Policy
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  We may update this Privacy Policy from time to time to reflect changes in our
                  practices, legal requirements, or other operational reasons.
                </p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  When we make changes, we will revise the "Last Updated" date at the top of this
                  page. Your continued use of BuyAPixel after any changes takes effect means you
                  accept the updated policy.
                </p>
              </section>

              {/* 13. Contact */}
              <section id="contact" className="mb-6 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  13. Contact Us
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  If you have questions about this Privacy Policy or our data practices, please
                  contact us:
                </p>
                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <strong className="text-slate-800 dark:text-slate-100">BuyAPixel</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a
                        href="mailto:privacy@buyapixel.in"
                        className="text-primary hover:underline"
                      >
                        privacy@buyapixel.in
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
                      By using BuyAPixel, you acknowledge that you have read, understood, and agree
                      to this Privacy Policy.
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

export default PrivacyPolicy;
