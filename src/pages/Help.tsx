import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  Map,
  ShoppingCart,
  Image as ImageIcon,
  ShieldCheck,
  Coins,
  ArrowRight,
  Search,
  X,
  CheckCircle2,
  Clock,
  MessageCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ======================
// TYPES & INTERFACES
// ======================

interface GuideStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
  iconColor: string;
}

interface PricingTier {
  id: string;
  name: string;
  price: number;
  description: string;
  color: string;
  borderColor: string;
  textColor: string;
  popular?: boolean;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

// ======================
// CONSTANTS
// ======================

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'select',
    title: '1. Select Pixels',
    description: 'Navigate the 100x100 grid. Zoom in to find your perfect spot. Click individual pixels or drag to select a block.',
    icon: Map,
    iconBgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 'purchase',
    title: '2. Purchase',
    description: 'Secure your spot forever. Pay via UPI or Card. Once purchased, you own those pixels on the global canvas.',
    icon: ShoppingCart,
    iconBgColor: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    id: 'customize',
    title: '3. Customize',
    description: 'Upload your logo, art, or message. Add a link to your website. You can update your content anytime!',
    icon: ImageIcon,
    iconBgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
];

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'gold',
    name: 'Gold Zone',
    price: 299,
    description: 'The center 60x60 block. Highest visibility, right in the middle of the action.',
    color: 'yellow',
    borderColor: 'border-yellow-400',
    textColor: 'text-yellow-600',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium Zone',
    price: 199,
    description: 'Surrounding the center (120x120). Great visibility at a balanced price.',
    color: 'blue',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-600',
  },
  {
    id: 'standard',
    name: 'Standard Zone',
    price: 99,
    description: 'The outer edges. Perfect for large logos and affordable expansion.',
    color: 'gray',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-600',
  },
];

const FAQS: FAQ[] = [
  {
    id: 'payment',
    question: 'Is this a one-time payment?',
    answer: 'Yes! When you buy pixels on BuyAPixel, you pay once and own them forever. There are no monthly fees or renewal costs.',
    category: 'billing',
  },
  {
    id: 'change-image',
    question: 'Can I change my image later?',
    answer: 'Absolutely. As the owner, you can log in to your dashboard at any time to upload a new image, change the link URL, or edit the hover text for your pixels.',
    category: 'customization',
  },
  {
    id: 'marketplace',
    question: 'What is the "Marketplace"?',
    answer: 'The Marketplace allows you to resell pixels you own. Since prime locations are limited, you can list your high-traffic pixels for sale at a price you choose. If someone buys them, the ownership transfers to them and you get paid.',
    category: 'marketplace',
  },
  {
    id: 'restrictions',
    question: 'Are there content restrictions?',
    answer: 'Yes. We want to keep BuyAPixel fun and safe for everyone. Using pixels for hate speech, illegal content, or explicit material will result in a ban and removal of content without refund.',
    category: 'policy',
  },
  {
    id: 'grid-size',
    question: 'How big is the grid?',
    answer: 'The grid is 100x100 pixels, meaning there are 10,000 pixels in total. It\'s a limited supply of digital real estate!',
    category: 'general',
  },
  {
    id: 'refund',
    question: 'What is your refund policy?',
    answer: 'Due to the permanent and digital nature of pixel ownership, all sales are final. However, if there\'s a technical issue preventing you from accessing your pixels, please contact our support team.',
    category: 'billing',
  },
  {
    id: 'payment-methods',
    question: 'What payment methods do you accept?',
    answer: 'We accept UPI, Credit Cards, Debit Cards, and Net Banking through our secure payment gateway. All transactions are encrypted and protected.',
    category: 'billing',
  },
  {
    id: 'ownership-transfer',
    question: 'Can I transfer ownership to someone else?',
    answer: 'Yes! You can transfer pixel ownership through our Marketplace by listing them for sale, or you can contact support for a direct transfer to a specific user.',
    category: 'marketplace',
  },
];

// ======================
// COMPONENT
// ======================

const Help = () => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  // Refs
  const faqSectionRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter FAQs based on search
  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS;

    const query = searchQuery.toLowerCase();
    return FAQS.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Trigger entrance animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // ESC to clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  const scrollToFAQ = useCallback(() => {
    faqSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Schema.org structured data
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    }),
    []
  );

  return (
    <>
      <Helmet>
        <title>Help Center - BuyAPixel.in | FAQs & Support</title>
        <meta
          name="description"
          content="Everything you need to know about buying pixels, managing your space, and joining the BuyAPixel community. Get answers to frequently asked questions."
        />
        <meta property="og:title" content="Help Center - BuyAPixel.in" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="FAQs and support for BuyAPixel" />
        <link rel="canonical" href="https://buyapixel.in/help" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header />

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Help Center</span>
          </nav>

          {/* Page Header */}
          <div
            className={cn(
              'text-center mb-12 space-y-4 transition-all duration-700',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <Badge variant="secondary" className="mb-2">
              <HelpCircle className="w-3 h-3 mr-1" aria-hidden="true" />
              Support Center
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900">
              How Can We <span className="text-primary">Help You?</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about buying pixels, managing your space, and joining the
              BuyAPixel community.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <Button variant="default" asChild>
                <Link to="/">
                  <Map className="w-4 h-4 mr-2" />
                  View Grid
                </Link>
              </Button>
              <Button variant="outline" onClick={scrollToFAQ}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Browse FAQs
              </Button>
              <Button variant="outline" asChild>
                <Link to="/contact">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Contact Support
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Guide Grid */}
          <div
            className={cn(
              'grid md:grid-cols-3 gap-6 mb-16 transition-all duration-700 delay-150',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            {GUIDE_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.id}
                  className="hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20 hover:-translate-y-1"
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <CardHeader>
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center mb-4',
                        step.iconBgColor,
                        step.iconColor
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle>{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pricing Zones */}
          <section
            className={cn(
              'mb-16 transition-all duration-700 delay-300',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            aria-labelledby="pricing-heading"
          >
            <h2 id="pricing-heading" className="text-3xl font-bold mb-8 text-center">
              Pricing Zones
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {PRICING_TIERS.map((tier, index) => (
                <div
                  key={tier.id}
                  className="relative group"
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div
                    className={cn(
                      'absolute inset-0 blur-xl opacity-20 group-hover:opacity-30 transition-opacity',
                      `bg-${tier.color}-500`
                    )}
                    aria-hidden="true"
                  />
                  <div
                    className={cn(
                      'relative bg-white border-2 rounded-xl p-6 text-center transform hover:-translate-y-1 transition-all duration-300',
                      tier.borderColor,
                      tier.popular && 'ring-2 ring-primary/20'
                    )}
                  >
                    {tier.popular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                        Most Popular
                      </Badge>
                    )}
                    <div
                      className={cn(
                        'font-bold tracking-wider text-sm uppercase mb-2',
                        tier.textColor
                      )}
                    >
                      {tier.name}
                    </div>
                    <div className="text-4xl font-extrabold text-gray-900 mb-2">
                      ₹{tier.price}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">per pixel</p>
                    <p className="text-gray-600 text-sm">{tier.description}</p>
                    <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                      <Link to="/">Buy Now</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ Section */}
          <section
            ref={faqSectionRef}
            className={cn(
              'mb-16 transition-all duration-700 delay-500',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            aria-labelledby="faq-heading"
          >
            <div className="grid lg:grid-cols-12 gap-12">
              {/* Sidebar */}
              <aside className="lg:col-span-4 space-y-6">
                <div>
                  <h2 id="faq-heading" className="text-3xl font-bold flex items-center gap-2 mb-2">
                    <HelpCircle className="w-8 h-8 text-primary" aria-hidden="true" />
                    FAQs
                  </h2>
                  <p className="text-muted-foreground text-lg">
                    Frequently asked questions about owning a piece of the internet.
                  </p>
                </div>

                {/* Search FAQs */}
                <div className="space-y-2">
                  <label htmlFor="faq-search" className="text-sm font-medium">
                    Search FAQs
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="faq-search"
                      ref={searchInputRef}
                      type="search"
                      placeholder="Search questions... (Ctrl+K)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10"
                      aria-label="Search FAQs"
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
                  {searchQuery && (
                    <p className="text-xs text-muted-foreground">
                      Found {filteredFAQs.length} result{filteredFAQs.length !== 1 && 's'}
                    </p>
                  )}
                </div>

                {/* Contact Card */}
                <Card className="border-primary/10 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Still have questions?</CardTitle>
                    <CardDescription>
                      Can't find the answer you're looking for? Our support team is here to help.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full gap-2" asChild>
                      <Link to="/contact">
                        Contact Support <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium">10,000+ Pixels</p>
                        <p className="text-xs text-muted-foreground">Available to own</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium">24/7 Support</p>
                        <p className="text-xs text-muted-foreground">We're here for you</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium">Secure Payments</p>
                        <p className="text-xs text-muted-foreground">Encrypted & protected</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </aside>

              {/* FAQ List */}
              <div className="lg:col-span-8">
                {filteredFAQs.length === 0 ? (
                  <Card className="p-12 text-center">
                    <HelpCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-semibold mb-2">No results found</h3>
                    <p className="text-muted-foreground mb-6">
                      Try adjusting your search or{' '}
                      <button onClick={clearSearch} className="text-primary hover:underline">
                        clear the filter
                      </button>
                    </p>
                    <Button variant="outline" asChild>
                      <Link to="/contact">Ask a Question</Link>
                    </Button>
                  </Card>
                ) : (
                  <Accordion
                    type="single"
                    collapsible
                    className="w-full space-y-4"
                    value={expandedFAQ}
                    onValueChange={setExpandedFAQ}
                  >
                    {filteredFAQs.map((faq) => (
                      <AccordionItem
                        key={faq.id}
                        value={faq.id}
                        className="bg-white px-6 rounded-lg border-2 hover:border-primary/20 transition-colors"
                      >
                        <AccordionTrigger className="text-lg font-medium hover:text-primary transition-colors text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                          {faq.answer}
                          {faq.id === 'restrictions' && (
                            <>
                              {' '}
                              Check our{' '}
                              <Link to="/terms" className="text-primary hover:underline">
                                Terms of Service
                              </Link>{' '}
                              for details.
                            </>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section
            className={cn(
              'text-center py-16 px-6 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 rounded-2xl border-2 border-primary/20 transition-all duration-700 delay-700',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join hundreds of brands and individuals who have already claimed their spot on the
              digital canvas.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/">
                  <Map className="w-5 h-5 mr-2" />
                  Buy Pixels Now
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/about">
                  Learn More
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

export default Help;
