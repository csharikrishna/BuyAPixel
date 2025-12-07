import EnhancedHeroSection from "@/components/EnhancedHeroSection";
import StaticPixelPreview from "@/components/StaticPixelPreview";
import HowItWorks from "@/components/HowItWorks";
import Marketplace from "@/components/Marketplace";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const Index = () => {
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <Header />
      {/* Main Content - Grid First */}
      <StaticPixelPreview />
      <EnhancedHeroSection />
      <HowItWorks />
      <Marketplace />
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default Index;
