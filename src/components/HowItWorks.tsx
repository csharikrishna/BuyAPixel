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

const HowItWorks = () => {
  const steps = [
    {
      step: "1",
      title: "Select Pixels",
      description: "Click on the grid to select the pixels you want to buy",
      icon: MousePointerClick,
      color: "bg-blue-500",
      lightColor: "bg-blue-50 text-blue-700 border-blue-200"
    },
    {
      step: "2", 
      title: "Make Payment",
      description: "Pay ₹100 per pixel using Razorpay (UPI, Cards, Net Banking)",
      icon: CreditCard,
      color: "bg-green-500",
      lightColor: "bg-green-50 text-green-700 border-green-200"
    },
    {
      step: "3",
      title: "Upload Content",
      description: "Upload your image, add title, URL, and contact details",
      icon: Upload,
      color: "bg-purple-500",
      lightColor: "bg-purple-50 text-purple-700 border-purple-200"
    },
    {
      step: "4",
      title: "Go Live",
      description: "Your ad appears on the grid within 24 hours",
      icon: Rocket,
      color: "bg-orange-500",
      lightColor: "bg-orange-50 text-orange-700 border-orange-200"
    },
    {
      step: "5",
      title: "Resell Later",
      description: "List your pixels in our marketplace for resale",
      icon: TrendingUp,
      color: "bg-amber-500",
      lightColor: "bg-amber-50 text-amber-700 border-amber-200"
    }
  ];

  const benefits = [
    { text: "Permanent advertising space", icon: CheckCircle2 },
    { text: "High traffic visibility", icon: CheckCircle2 },
    { text: "Resell for profit later", icon: CheckCircle2 },
    { text: "Part of internet history", icon: CheckCircle2 }
  ];

  const pricingPlans = [
    { name: "Meme Pack", pixels: "1-10", price: "₹100-1K", best: false, gradient: "from-blue-500/10 to-cyan-500/10" },
    { name: "Startup", pixels: "50+", price: "₹5K+", best: true, gradient: "from-purple-500/10 to-pink-500/10" },
    { name: "Enterprise", pixels: "500+", price: "₹50K+", best: false, gradient: "from-orange-500/10 to-red-500/10" },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <Badge variant="outline" className="text-sm px-6 py-2 mb-4 font-semibold border-2">
            📖 Simple Process
          </Badge>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            How It{" "}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            From selection to going live in just 5 simple steps
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative mb-20">
          {/* Connection Line - Desktop */}
          <div className="hidden xl:block absolute top-24 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 opacity-20" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card 
                  key={step.step} 
                  className="relative overflow-hidden group hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border-2 hover:border-primary/50"
                >
                  {/* Step Badge */}
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="font-bold text-xs">
                      Step {step.step}
                    </Badge>
                  </div>

                  <CardHeader className="text-center pb-4 pt-6">
                    {/* Animated Icon Circle */}
                    <div className={`w-16 h-16 rounded-2xl ${step.color} text-white flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-lg font-bold">{step.title}</CardTitle>
                  </CardHeader>

                  <CardContent className="text-center pb-6">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>

                  {/* Progress Indicator */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                    <div 
                      className={`h-full ${step.color} transition-all duration-500 group-hover:w-full`}
                      style={{ width: '0%' }}
                    />
                  </div>

                  {/* Arrow for desktop */}
                  {index < steps.length - 1 && (
                    <div className="hidden xl:flex absolute top-1/2 -right-5 transform -translate-y-1/2 z-10">
                      <div className="w-10 h-10 rounded-full bg-background border-2 border-muted flex items-center justify-center shadow-md">
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Benefits and Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {/* Benefits Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2 hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="text-2xl">🔥</span>
                <span>Why Buy Pixels?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <li 
                      key={index} 
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors duration-200"
                    >
                      <Icon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground font-medium">{benefit.text}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Pricing Card */}
          <Card className="bg-gradient-to-br from-accent/5 to-purple-500/5 border-2 hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="text-2xl">💰</span>
                <span>Pricing Plans</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pricingPlans.map((plan) => (
                  <div 
                    key={plan.name} 
                    className={`relative flex items-center justify-between p-4 rounded-xl bg-gradient-to-r ${plan.gradient} border-2 ${plan.best ? 'border-primary shadow-md scale-105' : 'border-transparent'} hover:scale-105 transition-all duration-200 group`}
                  >
                    <div className="flex-1">
                      <div className="font-bold text-base flex items-center gap-2 mb-1">
                        <span>{plan.name}</span>
                        {plan.best && (
                          <Badge variant="default" className="text-xs animate-pulse">
                            🔥 Popular
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        {plan.pixels} pixels
                      </div>
                    </div>
                    <div className="font-bold text-xl text-primary group-hover:scale-110 transition-transform">
                      {plan.price}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <Link to="/buy-pixels">
            <Button 
              size="lg" 
              className="text-lg px-10 py-6 h-auto font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-secondary group"
            >
              <Rocket className="w-5 h-5 mr-2 group-hover:translate-x-1 transition-transform" />
              Start Your Pixel Journey
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            Join 1000+ advertisers already on the grid
          </p>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
