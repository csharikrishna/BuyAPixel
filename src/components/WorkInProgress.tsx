import { Rocket, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';

interface WorkInProgressProps {
  title?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export const WorkInProgress = ({
  title = 'Coming Soon',
  description = 'We are crafting something exceptional. This feature is currently under development and will be available soon.',
  seoTitle = 'Coming Soon — BuyASpot',
  seoDescription = 'This feature is currently under development.'
}: WorkInProgressProps) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      <SEO title={seoTitle} description={seoDescription} />

      <Header />

      {/* Decorative Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute bottom-20 right-20 h-72 w-72 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="absolute top-40 left-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <main className="relative flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-white/20 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-2xl p-10 md:p-14 text-center">
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-100/80 dark:bg-purple-900/30 px-4 py-2 mb-8">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Coming Soon
              </span>
            </div>

            {/* Icon */}
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
              <Rocket className="h-12 w-12 text-white" />
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent">
                {title}
              </span>
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed mb-10">
              {description}
            </p>

            {/* Progress Indicator */}
            <div className="mb-10">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Development Progress</span>
                <span>75%</span>
              </div>

              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="rounded-xl px-8"
                onClick={() => (window.location.href = '/')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="rounded-xl px-8"
              >
                Notify Me When Ready
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};