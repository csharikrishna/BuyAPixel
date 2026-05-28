import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  MousePointerClick,
  CreditCard,
  Upload,
  Rocket,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { memo } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS_DATA = [
  {
    step: 1,
    title: "Select Pixels",
    description: "Click the grid to choose the pixels you want to buy.",
    icon: MousePointerClick,
    iconBg: "bg-blue-500",
    accentColor: "bg-blue-500",
  },
  {
    step: 2,
    title: "Make Payment",
    description: "Pay ₹100 per pixel securely via Razorpay — UPI, Cards, or Net Banking.",
    icon: CreditCard,
    iconBg: "bg-emerald-500",
    accentColor: "bg-emerald-500",
  },
  {
    step: 3,
    title: "Upload Content",
    description: "Upload your image, add a title, URL, and contact details.",
    icon: Upload,
    iconBg: "bg-violet-500",
    accentColor: "bg-violet-500",
  },
  {
    step: 4,
    title: "Go Live",
    description: "Your ad appears on the grid within 24 hours.",
    icon: Rocket,
    iconBg: "bg-orange-500",
    accentColor: "bg-orange-500",
  },
  {
    step: 5,
    title: "Resell Later",
    description: "List pixels in our marketplace and earn from resale.",
    icon: TrendingUp,
    iconBg: "bg-amber-500",
    accentColor: "bg-amber-500",
  },
] as const;

const BENEFITS_DATA = [
  "Permanent advertising space",
  "High-traffic visibility",
  "Resell pixels for profit",
  "Part of internet history",
] as const;

const PRICING_PLANS = [
  {
    name: "Starter",
    pixels: "1–10 pixels",
    price: "₹100–1K",
    badge: null,
    highlight: false,
  },
  {
    name: "Growth",
    pixels: "50+ pixels",
    price: "₹5K+",
    badge: "Most Popular",
    highlight: true,
  },
  {
    name: "Enterprise",
    pixels: "500+ pixels",
    price: "₹50K+",
    badge: null,
    highlight: false,
  },
] as const;

// ─── Step Connector (SVG dashed line with arrow, purely decorative) ───────────

const StepConnector = () => (
  <div
    className="hidden xl:flex items-center justify-center w-8 flex-shrink-0 self-center"
    aria-hidden="true"
  >
    <svg
      width="32"
      height="16"
      viewBox="0 0 32 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-muted-foreground/40"
    >
      <line
        x1="0"
        y1="8"
        x2="24"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <path
        d="M20 4L28 8L20 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

// ─── Step Card ────────────────────────────────────────────────────────────────

const StepCard = memo(
  ({
    step,
  }: {
    step: (typeof STEPS_DATA)[number];
  }) => {
    const Icon = step.icon;
    return (
      <Card
        className="relative flex flex-col items-center text-center p-6 group
          hover:shadow-xl hover:-translate-y-1 transition-all duration-300
          border border-border/60 bg-card rounded-2xl overflow-hidden"
        role="article"
        aria-label={`Step ${step.step}: ${step.title}`}
      >
        {/* Step number pill */}
        <span
          className={`absolute top-3 right-3 text-[11px] font-bold tracking-wide
            text-white px-2 py-0.5 rounded-full ${step.accentColor}`}
        >
          {step.step}
        </span>

        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-xl ${step.iconBg} text-white
            flex items-center justify-center mb-4
            group-hover:scale-110 transition-transform duration-300 shadow-md`}
          aria-hidden="true"
        >
          <Icon className="w-7 h-7" strokeWidth={1.8} />
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1.5">
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>

        {/* Bottom accent bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${step.accentColor} scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500`}
          aria-hidden="true"
        />
      </Card>
    );
  }
);
StepCard.displayName = "StepCard";

// ─── Benefits Card ────────────────────────────────────────────────────────────

const BenefitsCard = memo(() => (
  <Card className="border border-border/60 bg-card rounded-2xl h-full">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg font-semibold flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">🔥</span>
        Why Buy Pixels?
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2.5">
        {BENEFITS_DATA.map((benefit) => (
          <li
            key={benefit}
            className="flex items-center gap-3 py-2 px-3 rounded-lg
              hover:bg-muted/50 transition-colors duration-150 group"
          >
            <CheckCircle2
              className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0
                group-hover:scale-110 transition-transform"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-foreground">{benefit}</span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
));
BenefitsCard.displayName = "BenefitsCard";

// ─── Pricing Card ─────────────────────────────────────────────────────────────

const PricingCard = memo(() => (
  <Card className="border border-border/60 bg-card rounded-2xl h-full">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg font-semibold flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">💰</span>
        Pricing Plans
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {PRICING_PLANS.map((plan) => (
        <div
          key={plan.name}
          className={`flex items-center justify-between px-4 py-3.5 rounded-xl
            border transition-all duration-200 cursor-pointer group
            ${
              plan.highlight
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                : "border-border/50 hover:border-border"
            }`}
          role="listitem"
          aria-label={`${plan.name}: ${plan.pixels} for ${plan.price}`}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {plan.name}
              </span>
              {plan.badge && (
                <Badge
                  variant="default"
                  className="text-[10px] px-1.5 py-0 h-4 font-semibold"
                >
                  {plan.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{plan.pixels}</p>
          </div>
          <span
            className={`text-xl font-bold tabular-nums transition-transform duration-200
              group-hover:scale-105
              ${plan.highlight ? "text-primary" : "text-foreground"}`}
          >
            {plan.price}
          </span>
        </div>
      ))}
    </CardContent>
  </Card>
));
PricingCard.displayName = "PricingCard";

// ─── Main Section ─────────────────────────────────────────────────────────────

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="py-20 bg-background scroll-mt-20"
      aria-labelledby="how-it-works-heading"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="text-center mb-14 space-y-4">
          <Badge
            variant="outline"
            className="text-xs px-4 py-1 font-semibold border tracking-wide uppercase"
          >
            How It Works
          </Badge>
          <h2
            id="how-it-works-heading"
            className="text-4xl md:text-5xl font-bold tracking-tight"
          >
            From pixel to{" "}
            <span className="bg-gradient-to-r from-primary via-violet-500 to-secondary bg-clip-text text-transparent">
              live ad
            </span>
            {" "}in 5 steps
          </h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Select your space, pay securely, upload your creative, and go live — then resell whenever you want.
          </p>
        </header>

        {/* ── Process Steps ──────────────────────────────────────────────── */}
        <div
          className="flex flex-col xl:flex-row items-stretch gap-3 mb-14"
          role="region"
          aria-label="Process steps"
        >
          {STEPS_DATA.map((step, index) => (
            <div
              key={step.step}
              className="flex xl:flex-row items-center flex-1 min-w-0"
            >
              <div className="flex-1 min-w-0">
                <StepCard step={step} />
              </div>
              {index < STEPS_DATA.length - 1 && <StepConnector />}
            </div>
          ))}
        </div>

        {/* ── Benefits + Pricing ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-14">
          <BenefitsCard />
          <PricingCard />
        </div>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <Link to="/" aria-label="Go to buy pixels page">
            <Button
              size="lg"
              className="h-12 px-10 text-sm font-semibold rounded-xl
                shadow-md hover:shadow-lg hover:scale-105 active:scale-95
                transition-all duration-200 gap-2"
            >
              <Rocket className="w-4 h-4" aria-hidden="true" />
              Start Your Pixel Journey
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            Join <strong className="text-foreground font-semibold">1,000+</strong> advertisers already on the grid
          </p>
        </div>

      </div>
    </section>
  );
};

export default memo(HowItWorks);
