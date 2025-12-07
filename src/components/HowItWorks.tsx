import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const HowItWorks = () => {
  const steps = [
    {
      step: "1",
      title: "Select Pixels",
      description: "Click on the grid to select the pixels you want to buy",
      icon: "🔲",
      color: "bg-primary"
    },
    {
      step: "2", 
      title: "Make Payment",
      description: "Pay ₹100 per pixel using Razorpay (UPI, Cards, Net Banking)",
      icon: "💳",
      color: "bg-secondary"
    },
    {
      step: "3",
      title: "Upload Content",
      description: "Upload your image, add title, URL, and contact details",
      icon: "🖼️",
      color: "bg-accent"
    },
    {
      step: "4",
      title: "Go Live",
      description: "Your ad appears on the grid within 24 hours",
      icon: "🚀",
      color: "bg-success"
    },
    {
      step: "5",
      title: "Resell Later",
      description: "List your pixels in our marketplace for resale",
      icon: "💸",
      color: "bg-warning"
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-16">
          <Badge variant="outline" className="text-base px-6 py-2.5 mb-6 font-semibold">
            📖 Simple Process
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            How It <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Works</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            From selection to going live, our process is designed to be simple and fast
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-16">
          {steps.map((step, index) => (
            <Card key={step.step} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className={`w-16 h-16 rounded-full ${step.color} text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4`}>
                  {step.step}
                </div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl mb-4">{step.icon}</div>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </CardContent>
              
              {/* Arrow for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden xl:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-2xl text-muted-foreground">
                  ➡️
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/10 to-secondary/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>🔥</span>
                <span>Why Buy Pixels?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Permanent advertising space</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>High traffic visibility</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Resell for profit later</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Part of internet history</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-success/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>💰</span>
                <span>Pricing Plans</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "Meme Pack", pixels: "1-10", price: "₹100-1K", best: false },
                  { name: "Startup", pixels: "50+", price: "₹5K+", best: true },
                  { name: "Enterprise", pixels: "500+", price: "₹50K+", best: false },
                ].map((plan) => (
                  <div key={plan.name} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                    <div>
                      <div className="font-semibold flex items-center space-x-2">
                        <span>{plan.name}</span>
                        {plan.best && <Badge variant="secondary">Popular</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">{plan.pixels} pixels</div>
                    </div>
                    <div className="font-bold text-primary">{plan.price}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <Link to="/buy-pixels">
            <Button 
              variant="gradient" 
              size="lg" 
              className="text-base md:text-lg px-8 py-4 font-semibold h-14 min-w-[240px]"
            >
              🚀 Start Your Pixel Journey
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;