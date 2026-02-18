import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, HelpCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Track 404 for analytics (gtag is optional)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `404: ${location.pathname}`,
        fatal: false,
      });
    }
  }, [location.pathname]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <Helmet>
        <title>404 - Page Not Found | BuyAPixel.in</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="description" content="The page you're looking for doesn't exist. Navigate back to BuyAPixel.in to find what you need." />
        <meta name="prerender-status-code" content="404" />
      </Helmet>

      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-12"
        role="main"
        aria-labelledby="error-title"
      >
        <div className="max-w-2xl w-full text-center">
          {/* 404 Display */}
          <div className="mb-8">
            <div className="relative mb-6 inline-block">
              <h1
                id="error-title"
                className="text-8xl md:text-9xl font-bold bg-gradient-to-br from-primary/40 to-primary/20 bg-clip-text text-transparent select-none"
                aria-label="Error 404 - Page not found"
              >
                404
              </h1>
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                aria-hidden="true"
              >
                <div className="text-5xl md:text-6xl">🔍</div>
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Page Not Found
            </h2>

            <p className="text-base text-muted-foreground mb-2 max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved.
            </p>

            <p className="text-sm text-muted-foreground font-mono mb-8 break-all px-4">
              <span className="opacity-60">Path:</span> {location.pathname}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/" aria-label="Return to homepage">
                <Home className="mr-2 h-5 w-5" />
                Return Home
              </Link>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={goBack}
              className="w-full sm:w-auto"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Go Back
            </Button>
          </div>

          {/* Helpful Links — only real routes */}
          <div className="pt-8 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center justify-center gap-2">
              <HelpCircle size={16} />
              Try These Pages
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { to: "/", icon: "🏠", label: "Home" },
                { to: "/help", icon: "💬", label: "Help Center" },
                { to: "/contact", icon: "📧", label: "Contact Us" },
                { to: "/about", icon: "ℹ️", label: "About" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="p-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform" aria-hidden="true">
                    {link.icon}
                  </div>
                  <div className="text-sm font-medium text-foreground group-hover:text-primary">
                    {link.label}
                  </div>
                </Link>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground mt-6">
              Still can't find what you're looking for?{' '}
              <Link
                to="/contact"
                className="text-primary hover:text-primary/80 underline font-medium"
              >
                Contact our support team
              </Link>
            </div>
          </div>

          {/* Dev debug info */}
          {import.meta.env.DEV && (
            <div className="mt-8 p-4 bg-warning/10 border border-warning/30 rounded-lg text-left">
              <p className="text-xs font-semibold text-warning-foreground mb-2">
                Debug Info (Dev Only)
              </p>
              <div className="space-y-1 text-xs text-muted-foreground font-mono">
                <div><strong>Path:</strong> {location.pathname}</div>
                <div><strong>Search:</strong> {location.search || '(none)'}</div>
                <div><strong>Hash:</strong> {location.hash || '(none)'}</div>
                <div><strong>Referrer:</strong> {document.referrer || '(direct)'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default NotFound;
