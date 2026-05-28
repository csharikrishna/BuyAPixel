import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, TrendingUp, ShieldCheck, Users, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseGridStats } from "@/utils/platformStats";

const EnhancedHeroSection = () => {
  const [stats, setStats] = useState({ pixelsSold: 0, uniqueOwners: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: gridStats } = await supabase.rpc('get_grid_stats');
        const parsedStats = parseGridStats(gridStats);
        if (parsedStats) {
          setStats({
            pixelsSold: parsedStats.pixelsSold,
            uniqueOwners: parsedStats.uniqueOwners,
          });
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-hero flex items-center justify-center overflow-hidden py-20">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-float delay-1000" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 max-w-7xl">
        {/* Badge */}
        <div className="animate-fade-in mb-6">
          <Badge className="bg-gradient-primary text-white px-6 py-2.5 text-sm font-semibold border-0 shadow-glow inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            India's First Pixel Marketplace
          </Badge>
        </div>

        {/* Main Heading */}
        <div className="animate-slide-up delay-200 mb-8">
          <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-6 leading-tight tracking-tight">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Buy A Spot
            </span>
          </h1>

          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto leading-relaxed">
            Own a piece of digital history on our
            <span className="text-primary font-semibold"> 10,000 pixel canvas</span>
          </p>

          <p className="text-base md:text-lg text-muted-foreground/80 max-w-2xl mx-auto">
            Advertise your brand, showcase your art, or invest in premium digital real estate
          </p>
        </div>

        {/* Price Display */}
        <div className="animate-scale-in delay-400 mb-10">
          <div className="inline-flex items-center bg-card-premium rounded-2xl p-5 md:p-6 shadow-card border border-border/50">
            <TrendingUp className="w-6 h-6 text-success mr-3" />
            <div className="text-left">
              <p className="text-xs md:text-sm text-muted-foreground font-medium mb-0.5">Starting from</p>
              <p className="text-2xl md:text-3xl font-bold text-primary">
                ₹99<span className="text-base md:text-lg text-muted-foreground font-normal">/pixel</span>
              </p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="animate-slide-up delay-600 flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
          <Link to="/buy-pixels" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="btn-premium bg-gradient-primary hover:shadow-glow text-white px-8 py-4 text-base md:text-lg font-semibold border-0 w-full sm:min-w-[220px] h-14"
            >
              Start Buying Pixels
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Link to="/canvas" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="hover-scale border-2 border-primary/60 text-primary hover:bg-primary hover:text-white px-8 py-4 text-base md:text-lg font-semibold w-full sm:min-w-[220px] h-14"
            >
              View Full Canvas
            </Button>
          </Link>
        </div>

        {/* Social Proof Stats Strip */}
        <div className="animate-fade-in delay-700 flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-16">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{stats.pixelsSold.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">Pixels Sold</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm">
            <Users className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold">{stats.uniqueOwners.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">Owners</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Powered by Razorpay</span>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="animate-fade-in delay-800 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
          {[
            {
              icon: "🚀",
              title: "Advertise",
              description: "Promote your brand with high-impact pixel ads"
            },
            {
              icon: "💎",
              title: "Invest",
              description: "Buy premium locations and watch them appreciate"
            },
            {
              icon: "🎨",
              title: "Create",
              description: "Express yourself with pixel art and digital creativity"
            }
          ].map((feature, index) => (
            <div
              key={feature.title}
              className="card-premium p-8 rounded-xl hover-scale cursor-pointer group transition-all duration-300"
            >
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedHeroSection;
