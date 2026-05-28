import { memo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import HowItWorks from "@/components/HowItWorks";
import { supabase } from "@/integrations/supabase/client";
import { parseGridStats } from "@/utils/platformStats";
import {
  ArrowRight,
  Shield,
  Globe,
  Users,
  Zap,
  Target,
  TrendingUp,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Heart,
  Rocket,
} from "lucide-react";

interface PlatformStats {
  pixelsSold: number;
  uniqueOwners: number;
  totalPixels: number;
}

const AboutUs = memo(() => {
  const [stats, setStats] = useState<PlatformStats>({
    pixelsSold: 0,
    uniqueOwners: 0,
    totalPixels: 10000,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: gridStats } = await supabase.rpc("get_grid_stats");
        const parsedStats = parseGridStats(gridStats);
        if (parsedStats) {
          setStats({
            pixelsSold: parsedStats.pixelsSold,
            uniqueOwners: parsedStats.uniqueOwners,
            totalPixels: parsedStats.totalPixels,
          });
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    };
    fetchStats();
  }, []);

  const milestones = [
    { date: "2025", title: "Idea Born", description: "Inspired by the original Million Dollar Homepage, reimagined for India's digital generation." },
    { date: "2025", title: "Development", description: "Built the platform from scratch — real-time canvas, Razorpay payments, pixel marketplace." },
    { date: "2026", title: "Launch", description: "Opened to the public. First pixels sold, first advertisers onboarded." },
    { date: "2026+", title: "Growth", description: "Analytics dashboard, categories, referral system, and more on the roadmap." },
  ];

  const values = [
    { icon: Shield, title: "Transparency", description: "Real stats, real transactions. No fake traffic or inflated numbers. What you see is what you get." },
    { icon: Users, title: "Community", description: "Built for creators, students, startups, and indie builders. Every pixel tells someone's story." },
    { icon: Zap, title: "Simplicity", description: "Buy pixels in under 2 minutes. No complex ad platforms, no monthly subscriptions, no hidden fees." },
    { icon: Heart, title: "Made in India", description: "Built by an Indian developer, for the Indian startup ecosystem. Payments via Razorpay." },
  ];

  const trustPoints = [
    "Payments processed securely via Razorpay (PCI DSS compliant)",
    "256-bit SSL encryption on all pages",
    "7-day refund policy for all purchases",
    "Real-time canvas — your pixel goes live within minutes",
    "No hidden charges — the price you see is the price you pay",
    "24/7 email support at support@buyaspot.in",
  ];

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <SEO
        title="About BuyASpot — Our Story & Mission"
        description="Learn about BuyASpot — India's pixel marketplace where creators, startups, and businesses buy permanent digital advertising space starting at ₹99."
        canonical="https://buyaspot.in/about"
        keywords={["about buyaspot", "pixel marketplace", "india startup", "digital advertising", "buy pixels"]}
      />
      <Header />

      {/* Hero */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-primary/5 via-background to-background overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-float delay-1000" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10">
          <div className="text-center space-y-6">
            <Badge className="bg-gradient-primary text-white px-6 py-2 text-sm font-semibold border-0 shadow-glow">
              <Sparkles className="w-4 h-4 mr-1" />
              About Us
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              The Modern{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Million Dollar Homepage
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              BuyASpot is India's pixel marketplace — a 100×100 canvas where anyone can buy permanent
              digital space to advertise their brand, project, or idea. Starting at just ₹99 per pixel.
            </p>
          </div>
        </div>
      </section>

      {/* Live Platform Stats */}
      <section className="py-12 border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            <div className="text-center p-4 md:p-6 rounded-xl bg-primary/5 border border-primary/10">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                {stats.pixelsSold.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Pixels Sold</div>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-green-500/5 border border-green-500/10">
              <div className="text-3xl md:text-4xl font-bold text-green-600 mb-1">
                {stats.uniqueOwners.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Unique Owners</div>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-1">
                {(stats.totalPixels - stats.pixelsSold).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Available</div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Live data from our platform — updated in real-time
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-sm px-4 py-1.5 mb-4 font-semibold border-2">
              Our Story
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Why We Built This
            </h2>
          </div>

          <div className="prose prose-lg dark:prose-invert mx-auto space-y-6">
            <Card className="border-2 border-primary/10 bg-primary/5">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <Globe className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                  <div className="space-y-4">
                    <p className="text-base md:text-lg text-foreground leading-relaxed m-0">
                      In 2005, Alex Tew created the Million Dollar Homepage — a simple website where anyone could buy
                      pixel space for $1 per pixel. It became one of the internet's most iconic experiments.
                    </p>
                    <p className="text-base md:text-lg text-foreground leading-relaxed m-0">
                      <strong>BuyASpot brings that concept to India, rebuilt for 2025.</strong> Instead of a static page,
                      we've built a live, real-time canvas with modern payments (UPI, cards, wallets via Razorpay),
                      a pixel marketplace for reselling, and proper analytics — all at price points that make sense
                      for Indian creators and startups.
                    </p>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed m-0">
                      Whether you're a college student promoting a project, a startup looking for visibility,
                      or a creator marking your spot on the internet — BuyASpot gives you permanent, affordable
                      digital real estate.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works & What It Is (Merged from previous About content) */}
      <section className="py-16 bg-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="prose prose-lg dark:prose-invert mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              What is BuyASpot?
            </h2>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              BuyASpot sells pixel-based advertising tiles on a shared global canvas. Buyers select pixels, upload creatives, and attach a URL. Each ad is addressable, shareable, and discoverable by search engines and modern AI crawlers.
            </p>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              It is a simple, transparent marketplace that lets you buy small units of advertising space on an interactive public canvas. Each purchase gives you permanent visibility on the web: an image, a headline, and a link you control. Our platform makes it easy for startups, creators, and businesses to get noticed without recurring fees or complex ad systems.
            </p>

            <h3 className="text-2xl font-bold tracking-tight mt-10 mb-4">
              How BuyASpot Works
            </h3>
            <ol className="space-y-2 text-base md:text-lg text-foreground">
              <li><strong>Select:</strong> Choose pixels on the canvas using our visual grid and preview tools.</li>
              <li><strong>Create:</strong> Upload your image or create a simple creative with our tools.</li>
              <li><strong>Publish:</strong> Set a destination URL and optional alt text, then checkout.</li>
            </ol>

            <h3 className="text-2xl font-bold tracking-tight mt-10 mb-4">
              Benefits & Use Cases
            </h3>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              Use BuyASpot to promote product launches, portfolio links, event pages, and other high-value landing pages. Pixel advertising is affordable and permanent — ideal for long-term discoverability. We include semantic HTML, structured data (JSON-LD), and an open sitemap so search engines and modern AI crawlers can index and surface ads.
            </p>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-sm px-4 py-1.5 mb-4 font-semibold border-2">
              <Clock className="w-3.5 h-3.5 mr-1" />
              Timeline
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Our Journey
            </h2>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 bg-border md:-translate-x-0.5" />

            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className={`relative flex items-start gap-4 md:gap-8 ${
                    index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  {/* Dot */}
                  <div className="absolute left-6 md:left-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background -translate-x-1.5 mt-2 z-10" />

                  {/* Content */}
                  <div className={`ml-12 md:ml-0 md:w-1/2 ${index % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-5">
                        <Badge variant="secondary" className="mb-2 text-xs font-bold">
                          {milestone.date}
                        </Badge>
                        <h3 className="text-lg font-bold mb-1">{milestone.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {milestone.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-sm px-4 py-1.5 mb-4 font-semibold border-2">
              <Target className="w-3.5 h-3.5 mr-1" />
              Our Values
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              What We Stand For
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <Card key={value.title} className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-2 hover:border-primary/30">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-2">{value.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {value.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-sm px-4 py-1.5 mb-4 font-semibold border-2">
              <Shield className="w-3.5 h-3.5 mr-1" />
              Trust & Security
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Your Safety Matters
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              We take every measure to ensure your payment data and account are secure.
            </p>
          </div>

          <Card className="border-2 border-green-500/20 bg-green-500/5">
            <CardContent className="p-6 md:p-8">
              <ul className="space-y-4">
                {trustPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm md:text-base text-foreground leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What's Next — Roadmap */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-sm px-4 py-1.5 mb-4 font-semibold border-2">
              <Rocket className="w-3.5 h-3.5 mr-1" />
              Roadmap
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              What's Coming Next
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              We're building in public. Here's what's on our roadmap.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: BarChart3, title: "Analytics Dashboard", description: "Track impressions, clicks, and CTR for your pixel ads", status: "In Progress" },
              { icon: Target, title: "Pixel Categories", description: "Browse by AI, Startups, Student Projects, Gaming, and more", status: "Planned" },
              { icon: Users, title: "Referral System", description: "Invite friends and earn bonus rewards", status: "Planned" },
              { icon: TrendingUp, title: "SEO Landing Pages", description: "Targeted pages for specific audiences and use cases", status: "Planned" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-sm">{item.title}</h3>
                          <Badge
                            variant={item.status === "In Progress" ? "default" : "secondary"}
                            className="text-[10px] px-2 py-0"
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works & Pricing */}
      <HowItWorks />

      {/* Contact / CTA */}
      <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Have Questions?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            We'd love to hear from you. Whether you need help, have feedback, or want to partner — reach out anytime.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link to="/contact">
              <Button size="lg" className="bg-gradient-primary text-white border-0 px-8 h-12 text-base font-semibold">
                <Mail className="w-5 h-5 mr-2" />
                Contact Us
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base font-semibold border-2">
                Start Buying Pixels
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
            <a
              href="mailto:support@buyaspot.in"
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <Mail className="w-4 h-4" />
              support@buyaspot.in
            </a>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Mumbai, Maharashtra, India
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
});

AboutUs.displayName = "AboutUs";

export default AboutUs;
