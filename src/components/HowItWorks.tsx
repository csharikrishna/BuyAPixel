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
  ArrowRight
} from "lucide-react";
import { memo } from "react";

// Extracted constants for better maintainability
const STEPS_DATA = [
  {
    step: 1,
    title: "Select Pixels",
    description: "Click on the grid to select the pixels you want to buy",
    icon: MousePointerClick,
    color: "bg-blue-500",
    ariaLabel: "Step 1: Select your desired pixels from the grid"
  },
  {
    step: 2,
    title: "Make Payment",
    description: "Pay ₹100 per pixel using Razorpay (UPI, Cards, Net Banking)",
    icon: CreditCard,
    color: "bg-green-500",
    ariaLabel: "Step 2: Complete payment securely via Razorpay"
  },
  {
    step: 3,
    title: "Upload Content",
    description: "Upload your image, add title, URL, and contact details",
    icon: Upload,
    color: "bg-purple-500",
    ariaLabel: "Step 3: Upload your advertisement content"
  },
  {
    step: 4,
    title: "Go Live",
    description: "Your ad appears on the grid within 24 hours",
    icon: Rocket,
    color: "bg-orange-500",
    ariaLabel: "Step 4: Your advertisement goes live on the grid"
  },
  {
    step: 5,
    title: "Resell Later",
    description: "List your pixels in our marketplace for resale",
    icon: TrendingUp,
    color: "bg-amber-500",
    ariaLabel: "Step 5: Resell your pixels for potential profit"
  }
] as const;

const BENEFITS_DATA = [
  "Permanent advertising space",
  "High traffic visibility",
  "Resell for profit later",
  "Part of internet history"
] as const;

const PRICING_PLANS = [
  { 
    name: "Starter Pack", 
    pixels: "1-10", 
    price: "₹100-1K", 
    highlight: false, 
    gradient: "from-blue-500/10 to-cyan-500/10",
    description: "Perfect for testing the waters"
  },
  { 
    name: "Growth Plan", 
    pixels: "50+", 
    price: "₹5K+", 
    highlight: true, 
    gradient: "from-purple-500/10 to-pink-500/10",
    description: "Most popular choice"
  },
  { 
    name: "Enterprise", 
    pixels: "500+", 
    price: "₹50K+", 
    highlight: false, 
    gradient: "from-orange-500/10 to-red-500/10",
    description: "Maximum visibility"
  }
] as const;

// Memoized sub-components for better performance
const StepCard = memo(({ step, index, totalSteps }: { 
  step: typeof STEPS_DATA[number]; 
  index: number; 
  totalSteps: number;
}) => {
  const Icon = step.icon;
  const isLastStep = index === totalSteps - 1;

  return (
    <Card 
      className="relative overflow-hidden group hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 hover:border-primary/50 bg-card"
      role="article"
      aria-label={step.ariaLabel}
    >
      {/* Step Number Badge */}
      <div className="absolute top-4 right-4 z-10">
        <Badge variant="secondary" className="font-bold text-xs">
          Step {step.step}
        </Badge>
      </div>

      <CardHeader className="text-center pb-4 pt-8">
        {/* Animated Icon */}
        <div 
          className={`w-20 h-20 rounded-2xl ${step.color} text-white flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg`}
          aria-hidden="true"
        >
          <Icon className="w-10 h-10" strokeWidth={2} />
        </div>
        <CardTitle className="text-xl font-bold">{step.title}</CardTitle>
      </CardHeader>

      <CardContent className="text-center pb-8 px-6">
        <p className="text-muted-foreground leading-relaxed">
          {step.description}
        </p>
      </CardContent>

      {/* Animated Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted overflow-hidden">
        <div 
          className={`h-full ${step.color} transition-all duration-700 ease-out group-hover:w-full`}
          style={{ width: '0%' }}
          role="progressbar"
          aria-valuenow={0}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Connector Arrow */}
      {!isLastStep && (
        <div 
          className="hidden xl:flex absolute top-1/2 -right-6 transform -translate-y-1/2 z-20"
          aria-hidden="true"
        >
          <div className="w-12 h-12 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center shadow-lg group-hover:border-primary/50 transition-colors">
            <ArrowRight className="w-6 h-6 text-primary animate-pulse" />
          </div>
        </div>
      )}
    </Card>
  );
});

StepCard.displayName = "StepCard";

const BenefitsCard = memo(() => (
  <Card 
    className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 border-2 hover:shadow-xl transition-all duration-300 h-full"
    role="region"
    aria-labelledby="benefits-heading"
  >
    <CardHeader>
      <CardTitle id="benefits-heading" className="flex items-center gap-3 text-2xl">
        <span className="text-3xl" role="img" aria-label="Fire emoji">🔥</span>
        <span>Why Buy Pixels?</span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-4" role="list">
        {BENEFITS_DATA.map((benefit, index) => (
          <li 
            key={index}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-background/60 transition-all duration-200 group"
          >
            <CheckCircle2 
              className="w-6 h-6 text-green-500 flex-shrink-0 group-hover:scale-110 transition-transform" 
              aria-hidden="true"
            />
            <span className="text-foreground font-medium text-base">{benefit}</span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
));

BenefitsCard.displayName = "BenefitsCard";

const PricingCard = memo(() => (
  <Card 
    className="bg-gradient-to-br from-accent/5 via-purple-500/5 to-pink-500/5 border-2 hover:shadow-xl transition-all duration-300 h-full"
    role="region"
    aria-labelledby="pricing-heading"
  >
    <CardHeader>
      <CardTitle id="pricing-heading" className="flex items-center gap-3 text-2xl">
        <span className="text-3xl" role="img" aria-label="Money emoji">💰</span>
        <span>Pricing Plans</span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4" role="list">
        {PRICING_PLANS.map((plan) => (
          <div 
            key={plan.name}
            className={`relative flex items-center justify-between p-5 rounded-xl bg-gradient-to-r ${plan.gradient} border-2 ${
              plan.highlight 
                ? 'border-primary shadow-lg scale-[1.02] ring-2 ring-primary/20' 
                : 'border-transparent hover:border-primary/30'
            } hover:scale-105 transition-all duration-300 group cursor-pointer`}
            role="listitem"
            aria-label={`${plan.name} plan: ${plan.pixels} pixels for ${plan.price}`}
          >
            <div className="flex-1 space-y-1">
              <div className="font-bold text-lg flex items-center gap-2 flex-wrap">
                <span>{plan.name}</span>
                {plan.highlight && (
                  <Badge 
                    variant="default" 
                    className="text-xs font-semibold animate-pulse shadow-md"
                  >
                    🔥 Most Popular
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                {plan.pixels} pixels • {plan.description}
              </div>
            </div>
            <div className="font-bold text-2xl text-primary group-hover:scale-110 transition-transform ml-4">
              {plan.price}
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
));

PricingCard.displayName = "PricingCard";

const HowItWorks = () => {
  return (
    <section 
      id="how-it-works" 
      className="py-24 bg-gradient-to-b from-background via-muted/20 to-background scroll-mt-20"
      aria-labelledby="how-it-works-heading"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Header Section */}
        <header className="text-center mb-20 space-y-6">
          <Badge 
            variant="outline" 
            className="text-sm px-6 py-2.5 mb-4 font-semibold border-2 hover:bg-primary/5 transition-colors"
          >
            <span role="img" aria-label="Open book">📖</span> Simple Process
          </Badge>
          <h2 
            id="how-it-works-heading"
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
          >
            How It{" "}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            From pixel selection to going live — complete your journey in 5 straightforward steps
          </p>
        </header>

        {/* Process Steps */}
        <div className="relative mb-24" role="region" aria-label="Process steps">
          {/* Decorative Connection Line */}
          <div 
            className="hidden xl:block absolute top-28 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 opacity-30"
            aria-hidden="true"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
            {STEPS_DATA.map((step, index) => (
              <StepCard 
                key={step.step} 
                step={step} 
                index={index} 
                totalSteps={STEPS_DATA.length}
              />
            ))}
          </div>
        </div>

        {/* Benefits and Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-20">
          <BenefitsCard />
          <PricingCard />
        </div>

        {/* Call-to-Action */}
        <div className="text-center space-y-6">
          <Link to="/" aria-label="Navigate to buy pixels page">
            <Button 
              size="lg" 
              className="text-lg px-12 py-7 h-auto font-bold rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 bg-gradient-to-r from-primary via-purple-500 to-secondary group"
            >
              <Rocket 
                className="w-6 h-6 mr-3 group-hover:rotate-12 group-hover:-translate-y-1 transition-transform" 
                aria-hidden="true"
              />
              Start Your Pixel Journey
              <ArrowRight 
                className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform" 
                aria-hidden="true"
              />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground font-medium">
            Join <strong className="text-foreground">1,000+</strong> advertisers already on the grid
          </p>
        </div>
      </div>
    </section>
  );
};

export default memo(HowItWorks);
