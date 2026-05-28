import { memo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { parseGridStats } from "@/utils/platformStats";
import {
  Users,
  TrendingUp,
  ShieldCheck,
  Star,
  BarChart3,
  Zap,
} from "lucide-react";

interface PlatformStats {
  pixelsSold: number;
  uniqueOwners: number;
  totalPixels: number;
  averagePrice: number;
}

const TESTIMONIALS = [
  {
    name: "Rahul M.",
    role: "Startup Founder",
    quote: "Got my startup noticed within the first week. The pixel concept is unique and actually drives traffic.",
    rating: 5,
  },
  {
    name: "Priya S.",
    role: "College Student",
    quote: "Promoted my final year project for just ₹99. Simple process, no complicated ad dashboards.",
    rating: 5,
  },
  {
    name: "Arjun K.",
    role: "Indie Developer",
    quote: "Love the marketplace feature — bought pixels early and resold at a profit. Great community.",
    rating: 5,
  },
];

const SocialProof = memo(() => {
  const [stats, setStats] = useState<PlatformStats>({
    pixelsSold: 0,
    uniqueOwners: 0,
    totalPixels: 10000,
    averagePrice: 0,
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
            averagePrice: parsedStats.averagePrice,
          });
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    };
    fetchStats();
  }, []);

  const statsCards = [
    {
      icon: BarChart3,
      value: stats.pixelsSold.toLocaleString(),
      label: "Pixels Sold",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Users,
      value: stats.uniqueOwners.toLocaleString(),
      label: "Unique Owners",
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
    {
      icon: TrendingUp,
      value: `₹${stats.averagePrice}`,
      label: "Avg. Price",
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Zap,
      value: `${((stats.pixelsSold / stats.totalPixels) * 100).toFixed(1)}%`,
      label: "Canvas Filled",
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <section
      className="py-16 md:py-20 bg-gradient-to-b from-background via-muted/20 to-background"
      aria-labelledby="social-proof-heading"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Section Header */}
        <header className="text-center mb-14 space-y-4">
          <Badge
            variant="outline"
            className="text-sm px-5 py-2 font-semibold border-2 hover:bg-primary/5 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Trusted Platform
          </Badge>
          <h2
            id="social-proof-heading"
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight"
          >
            Real Numbers,{" "}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
              Real Results
            </span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Live platform statistics — not inflated, not fake. These numbers come directly from our database.
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16">
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-2 hover:border-primary/20"
              >
                <CardContent className="p-4 md:p-6 text-center">
                  <div
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${stat.bgColor} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.color}`} />
                  </div>
                  <div className={`text-2xl md:text-3xl font-bold ${stat.color} mb-1`}>
                    {stat.value}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground font-medium">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-16">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Razorpay Verified
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              SSL Encrypted
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
              7-Day Refund Policy
            </span>
          </div>
        </div>

        {/* Testimonials */}
        <div className="text-center mb-10">
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
            What Our Users Say
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testimonial, index) => (
            <Card
              key={index}
              className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-2 hover:border-primary/20"
            >
              <CardContent className="p-6">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 text-amber-500 fill-amber-500"
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm md:text-base text-foreground leading-relaxed mb-4 italic">
                  "{testimonial.quote}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{testimonial.name}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
});

SocialProof.displayName = "SocialProof";

export default SocialProof;
