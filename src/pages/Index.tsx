import EnhancedHeroSection from "@/components/EnhancedHeroSection";
import StaticPixelPreview from "@/components/StaticPixelPreview";
import HowItWorks from "@/components/HowItWorks";
import Marketplace from "@/components/Marketplace";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Megaphone } from "lucide-react";

const Index = () => {
  const [broadcast, setBroadcast] = useState<string | null>(null);

  useEffect(() => {
    const fetchBroadcast = async () => {
      const { data } = await supabase
        .from('announcements' as any)
        .select('message')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setBroadcast((data as any).message);
      }
    };
    fetchBroadcast();
  }, []);

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <Header />

      {broadcast && (
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white dark:text-white px-4 py-3 relative shadow-md animate-in slide-in-from-top duration-500">
          <div className="container mx-auto flex items-center justify-center gap-2 text-center text-sm md:text-base font-medium pr-8">
            <Megaphone className="w-5 h-5 shrink-0 animate-pulse" />
            <span>{broadcast}</span>
          </div>
          <button
            onClick={() => setBroadcast(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content - Grid First */}
      <StaticPixelPreview />
      <EnhancedHeroSection />
      <HowItWorks />
      <Marketplace />
      <Footer />

    </div>
  );
};

export default Index;
