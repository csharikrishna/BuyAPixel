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
  Mail,
  Check,
  ChevronUp,
  List,
  Ban,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  MessageSquare,
  Flag,
  Clock,
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
  { id: 'allowed-content', title: '2. Allowed Content', icon: CheckCircle2 },
  { id: 'restricted-content', title: '3. Restricted Content', icon: Ban },
  { id: 'image-guidelines', title: '4. Image Guidelines', icon: ImageIcon },
  { id: 'link-guidelines', title: '5. Link Guidelines', icon: Eye },
  { id: 'community-standards', title: '6. Community Standards', icon: MessageSquare },
  { id: 'enforcement', title: '7. Enforcement Actions', icon: AlertCircle },
  { id: 'reporting', title: '8. Reporting Violations', icon: Flag },
  { id: 'contact', title: '9. Contact Information', icon: Mail },
];

// ======================
// COMPONENT
// ======================

const ContentGuidelines: React.FC = () => {
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
        if (showTOC) setShowTOC(false);
        else if (searchQuery) clearSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTOC, searchQuery, clearSearch]);

  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Content Guidelines - BuyASpot',
      description: 'Content guidelines and community standards for the BuyASpot pixel platform',
      url: 'https://buyaspot.in/content-guidelines',
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
        <title>Content Guidelines - buyaspot.in | Community Standards</title>
        <meta
          name="description"
          content="BuyASpot Content Guidelines: Understand what content is allowed, restricted, and prohibited on our pixel advertising platform. Keep our community safe."
        />
        <meta property="og:title" content="Content Guidelines - buyaspot.in" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Community standards and content guidelines for BuyASpot" />
        <link rel="canonical" href="https://buyaspot.in/content-guidelines" />
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
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Content Guidelines</span>
          </nav>

          {/* Header Section */}
          <div className={cn('mb-8 transition-all duration-700', isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8')}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <Badge variant="secondary" className="mb-3">
                  <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                  Community Standards
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Content Guidelines</h1>
                <p className="text-muted-foreground mt-2">
                  Standards for content displayed on the BuyASpot pixel canvas
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Search guidelines... (Ctrl+K for TOC)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                  aria-label="Search content guidelines"
                />
                {searchQuery && (
                  <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear search">
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
                      <Button key={sectionId} variant="outline" size="sm" onClick={() => scrollToSection(sectionId)}>
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
          <Card className={cn('transition-all duration-700 delay-200', isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8')}>
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
                  BuyASpot is a public pixel advertising platform where users can display their brands,
                  art, and messages. To maintain a safe, inclusive, and professional environment for all
                  users and visitors, we've established these Content Guidelines. All content uploaded to
                  the canvas must comply with these standards. Violations may result in content removal,
                  account suspension, or permanent bans without refund.
                </p>
              </section>

              {/* 2. Allowed Content */}
              <section id="allowed-content" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  2. Allowed Content
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  The following types of content are welcome on BuyASpot:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>Brand Logos & Business Advertisements:</strong> Company logos, product images,
                    and promotional content for legitimate businesses.
                  </li>
                  <li>
                    <strong>Personal Artwork & Creative Designs:</strong> Original art, illustrations,
                    digital designs, and creative expressions.
                  </li>
                  <li>
                    <strong>Community & Social Messages:</strong> Positive community messages, greetings,
                    celebrations, and social expressions.
                  </li>
                  <li>
                    <strong>Website & App Promotions:</strong> Links to legitimate websites, apps, portfolios,
                    and online businesses.
                  </li>
                  <li>
                    <strong>Event Promotions:</strong> Advertisements for legal events, meetups, conferences,
                    and community gatherings.
                  </li>
                  <li>
                    <strong>Educational Content:</strong> Educational resources, courses, tutorials, and
                    informational content.
                  </li>
                </ul>
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="text-green-800 dark:text-green-100">
                      <strong>Tip:</strong> High-quality, clear images perform best on the pixel canvas.
                      Upload images that are visually appealing and represent your brand well.
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Restricted Content */}
              <section id="restricted-content" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  3. Restricted & Prohibited Content
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  The following content is <strong>strictly prohibited</strong> on BuyASpot:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>Adult/NSFW Content:</strong> Pornography, sexually explicit material, or nudity.
                  </li>
                  <li>
                    <strong>Hate Speech & Discrimination:</strong> Content promoting hatred, violence, or
                    discrimination based on race, ethnicity, religion, gender, sexual orientation,
                    disability, or nationality.
                  </li>
                  <li>
                    <strong>Violence & Gore:</strong> Graphic violence, gore, torture, or content promoting
                    self-harm.
                  </li>
                  <li>
                    <strong>Illegal Activities:</strong> Content promoting or facilitating illegal activities
                    including drug trafficking, weapons sales, fraud, or piracy.
                  </li>
                  <li>
                    <strong>Scams & Phishing:</strong> Fraudulent schemes, phishing attempts, pyramid
                    schemes, or deceptive content designed to mislead users.
                  </li>
                  <li>
                    <strong>Malware & Harmful Links:</strong> Links to malware, viruses, phishing sites,
                    or any harmful downloads.
                  </li>
                  <li>
                    <strong>Harassment & Bullying:</strong> Targeted harassment, doxxing, threats, or
                    personal attacks against individuals.
                  </li>
                  <li>
                    <strong>Misinformation:</strong> Deliberately false or misleading content that could
                    cause harm to public health or safety.
                  </li>
                  <li>
                    <strong>Intellectual Property Violations:</strong> Unauthorized use of copyrighted
                    material, trademarks, or content that infringes on others' rights.
                  </li>
                  <li>
                    <strong>Gambling & Betting:</strong> Unauthorized gambling, betting services, or
                    casino advertisements (unless legally permitted and properly licensed).
                  </li>
                </ul>
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400">
                  <div className="flex items-start gap-3">
                    <Ban className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-red-800 dark:text-red-100">
                      <strong>Warning:</strong> Violation of these content rules will result in
                      immediate content removal and may lead to permanent account suspension without
                      refund.
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Image Guidelines */}
              <section id="image-guidelines" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  4. Image Guidelines
                </h2>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>File Formats:</strong> JPG, PNG, and GIF formats are supported.
                  </li>
                  <li>
                    <strong>File Size:</strong> Maximum 5MB per image upload.
                  </li>
                  <li>
                    <strong>Resolution:</strong> For best results, match your image dimensions to your
                    pixel block size. Images are automatically scaled to fit.
                  </li>
                  <li>
                    <strong>Quality:</strong> Use clear, high-contrast images for best visibility on
                    the canvas. Avoid blurry or pixelated images.
                  </li>
                  <li>
                    <strong>Text in Images:</strong> If your image contains text, ensure it is legible
                    at the pixel block size you've purchased.
                  </li>
                  <li>
                    <strong>Animated GIFs:</strong> Animated content is allowed but should not be
                    excessively flashy or cause accessibility issues (e.g., no rapid strobing).
                  </li>
                </ul>
              </section>

              {/* 5. Link Guidelines */}
              <section id="link-guidelines" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  5. Link Guidelines
                </h2>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    Links must point to legitimate, safe websites. No malware, phishing, or spam sites.
                  </li>
                  <li>
                    Redirect links (URL shorteners) are allowed but the final destination must comply
                    with these guidelines.
                  </li>
                  <li>
                    Links to age-restricted content must be clearly labeled.
                  </li>
                  <li>
                    BuyASpot reserves the right to disable links that violate these guidelines or
                    pose security risks to visitors.
                  </li>
                  <li>
                    Broken links should be updated promptly. Pixels with persistently broken links may
                    have their link removed.
                  </li>
                </ul>
              </section>

              {/* 6. Community Standards */}
              <section id="community-standards" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  6. Community Standards
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  BuyASpot is a shared public space. We expect all users to:
                </p>
                <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    <strong>Be Respectful:</strong> Treat other users and their content with respect.
                    The canvas is a shared community.
                  </li>
                  <li>
                    <strong>Be Honest:</strong> Don't misrepresent your identity, brand, or content.
                    Impersonation is not allowed.
                  </li>
                  <li>
                    <strong>Be Responsible:</strong> You are responsible for the content you upload and
                    the links you associate with your pixels.
                  </li>
                  <li>
                    <strong>Respect Privacy:</strong> Don't share personal information of others without
                    their consent.
                  </li>
                  <li>
                    <strong>Support the Community:</strong> Help keep the platform safe by reporting
                    content that violates these guidelines.
                  </li>
                </ul>
              </section>

              {/* 7. Enforcement Actions */}
              <section id="enforcement" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  7. Enforcement Actions
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Depending on the severity and frequency of violations, BuyASpot may take the following
                  actions:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-semibold border border-border">Severity</th>
                        <th className="text-left p-3 font-semibold border border-border">Action</th>
                        <th className="text-left p-3 font-semibold border border-border">Refund</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-300">
                      <tr>
                        <td className="p-3 border border-border">Minor (first offense)</td>
                        <td className="p-3 border border-border">Warning + content review request</td>
                        <td className="p-3 border border-border">N/A</td>
                      </tr>
                      <tr className="bg-muted/20">
                        <td className="p-3 border border-border">Moderate</td>
                        <td className="p-3 border border-border">Content removal + warning</td>
                        <td className="p-3 border border-border">No refund</td>
                      </tr>
                      <tr>
                        <td className="p-3 border border-border">Severe</td>
                        <td className="p-3 border border-border">Content removal + account suspension</td>
                        <td className="p-3 border border-border">No refund</td>
                      </tr>
                      <tr className="bg-muted/20">
                        <td className="p-3 border border-border">Critical / Illegal</td>
                        <td className="p-3 border border-border">Permanent ban + reported to authorities</td>
                        <td className="p-3 border border-border">No refund</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 8. Reporting Violations */}
              <section id="reporting" className="mb-8 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  8. Reporting Violations
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  If you encounter content on BuyASpot that you believe violates these guidelines:
                </p>
                <ol className="list-decimal pl-6 text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                  <li>
                    Go to our{' '}
                    <Link to="/contact" className="text-primary hover:underline font-medium">
                      Contact Support
                    </Link>{' '}
                    page.
                  </li>
                  <li>
                    Select <strong>"General Inquiry"</strong> or <strong>"Technical Problem"</strong> as the category.
                  </li>
                  <li>
                    Include the location (coordinates) of the offending content on the canvas, or a screenshot.
                  </li>
                  <li>
                    Describe the violation clearly.
                  </li>
                  <li>
                    Our moderation team will review reports within <strong>24 hours</strong>.
                  </li>
                </ol>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
                  You can also report content directly via email at{' '}
                  <a href="mailto:support@buyaspot.in" className="text-primary hover:underline">
                    support@buyaspot.in
                  </a>
                  .
                </p>
              </section>

              {/* 9. Contact Information */}
              <section id="contact" className="mb-6 scroll-mt-24">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 pb-2 mb-4 border-b-2 border-blue-500">
                  9. Contact Information
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                  Questions about these guidelines? Contact us:
                </p>
                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <strong className="text-slate-800 dark:text-slate-100">BuyASpot Content Team</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href="mailto:support@buyaspot.in" className="text-primary hover:underline">
                        support@buyaspot.in
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
                      By using BuyASpot, you agree to comply with these Content Guidelines. We reserve
                      the right to update these guidelines at any time.
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
              <Link to="/privacy">
                <Shield className="w-4 h-4 mr-2" />
                Privacy Policy
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

        {/* Scroll to Top */}
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

export default ContentGuidelines;
