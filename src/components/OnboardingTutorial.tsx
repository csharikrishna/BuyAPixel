import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface TutorialStep {
  title: string;
  description: string;
  icon: string;
}

export const OnboardingTutorial = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const isMobile = useIsMobile();

  const steps: TutorialStep[] = isMobile ? [
    {
      title: "Welcome to Buy-A-Pixel! 🎨",
      description: "Own your piece of the internet. Select pixels, upload your content, and showcase to the world!",
      icon: "👋"
    },
    {
      title: "Pinch to Zoom 🔍",
      description: "Use two fingers to pinch and zoom in/out on the canvas to see pixels in detail.",
      icon: "👌"
    },
    {
      title: "Tap to Select 👆",
      description: "Tap pixels to select them. Tap again to deselect. Build your perfect space!",
      icon: "✨"
    },
    {
      title: "Drag to Pan 🗺️",
      description: "Switch to Pan mode and drag with one finger to move around the canvas.",
      icon: "🔄"
    },
    {
      title: "Purchase & Customize 🎯",
      description: "Tap the floating cart button to review and purchase your selected pixels!",
      icon: "🛒"
    }
  ] : [
    {
      title: "Welcome to Buy-A-Pixel! 🎨",
      description: "Own your piece of the internet. Select pixels, upload your content, and showcase to the world!",
      icon: "👋"
    },
    {
      title: "Click to Select 🖱️",
      description: "Click on pixels to select them. Hold Shift and drag to select multiple pixels at once.",
      icon: "✨"
    },
    {
      title: "Zoom & Pan 🔍",
      description: "Use the mouse wheel to zoom, and click and drag to pan around the canvas.",
      icon: "🗺️"
    },
    {
      title: "Purchase & Customize 🎯",
      description: "Once you've selected your pixels, click 'Purchase Selected' to buy and customize them!",
      icon: "🛒"
    }
  ];

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("hasSeenTutorial");
    if (!hasSeenTutorial) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenTutorial", "true");
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-elegant max-w-md w-full p-6 animate-scale-in">
        <div className="flex justify-between items-start mb-4">
          <div className="text-4xl">{step.icon}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">{step.title}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-1.5">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "w-8 bg-primary"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrev}
                size="sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              size="sm"
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
              {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
