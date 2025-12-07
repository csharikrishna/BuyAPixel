import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const HeroSection = () => {
  return (
    <section id="home" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <Badge variant="outline" className="text-lg px-6 py-2">
              🚀 India's First Pixel Marketplace
            </Badge>
            
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight">
              Buy A
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent block">
                Pixel
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Own digital real estate on our <strong>50,000 pixel canvas</strong>. 
              Perfect for advertisers, creators, startups, and meme lovers!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">₹100</div>
                <div className="text-sm text-muted-foreground">per pixel</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              variant="gradient" 
              size="lg" 
              className="text-lg px-8 py-4 shadow-glow"
              onClick={() => {
                document.querySelector('#buy')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              🔲 Start Buying Pixels
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-4"
              onClick={() => {
                document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              📖 How It Works
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold mb-2">Advertise</h3>
                <p className="text-muted-foreground">Place your brand on our viral canvas</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-xl font-semibold mb-2">Invest</h3>
                <p className="text-muted-foreground">Buy pixels and resell them later</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold mb-2">Create</h3>
                <p className="text-muted-foreground">Express yourself with pixel art</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;