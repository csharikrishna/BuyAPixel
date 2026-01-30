import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, Search, ArrowLeft, HelpCircle, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedPages, setSuggestedPages] = useState<string[]>([]);

  useEffect(() => {
    // Log 404 errors for monitoring with more context [web:121]
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `404: ${location.pathname}`,
        fatal: false
      });
    }
    
    console.error("404 Error:", {
      path: location.pathname,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });

    // Smart page suggestions based on attempted URL [web:119][web:120]
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const suggestions: string[] = [];
    
    // Common route patterns
    const routeMap: Record<string, string[]> = {
      'product': ['/products', '/shop', '/catalog'],
      'service': ['/services', '/about'],
      'blog': ['/blog', '/articles', '/resources'],
      'contact': ['/contact', '/support', '/help'],
      'account': ['/profile', '/dashboard', '/signin'],
      'cart': ['/cart', '/checkout'],
      'order': ['/orders', '/account/orders']
    };

    pathSegments.forEach(segment => {
      const normalizedSegment = segment.toLowerCase();
      Object.entries(routeMap).forEach(([key, routes]) => {
        if (normalizedSegment.includes(key)) {
          suggestions.push(...routes);
        }
      });
    });

    // Remove duplicates and limit to 4 suggestions
    setSuggestedPages([...new Set(suggestions)].slice(0, 4));
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // HTTP Status Code for proper server-side rendering [web:121][web:126]
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Signal to server that this should return 404 status
      (window as any).__NEXT_DATA__ = { ...(window as any).__NEXT_DATA__, statusCode: 404 };
    }
  }, []);

  return (
    <>
      {/* SEO-optimized meta tags [web:125][web:128] */}
      <Helmet>
        <title>404 - Page Not Found | Your Site Name</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="description" content="The page you're looking for doesn't exist. Find what you need through our search or navigation." />
        <meta name="prerender-status-code" content="404" />
        <link rel="canonical" href="https://yoursite.com/404" />
      </Helmet>

      <div 
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4 py-12"
        role="main"
        aria-labelledby="error-title"
      >
        <div className="max-w-3xl w-full">
          {/* Main Error Display [web:119] */}
          <div className="text-center mb-8">
            {/* Animated 404 with better accessibility */}
            <div className="relative mb-6 inline-block">
              <h1 
                id="error-title"
                className="text-8xl md:text-9xl font-bold bg-gradient-to-br from-gray-200 to-gray-300 bg-clip-text text-transparent select-none animate-pulse-soft"
                aria-label="Error 404 - Page not found"
              >
                404
              </h1>
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                aria-hidden="true"
              >
                <div className="text-5xl md:text-6xl animate-bounce-gentle">
                  🔍
                </div>
              </div>
            </div>

            {/* Clear, friendly error message [web:119][web:123] */}
            <h2 className="text-2xl md:text-4xl font-bold text-gray-800 mb-3">
              Oops! This Page Took a Wrong Turn
            </h2>
            
            <p className="text-base md:text-lg text-gray-600 mb-2 max-w-xl mx-auto">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            {/* Show attempted path for context [web:123] */}
            <p className="text-sm text-gray-500 font-mono mb-8 break-all px-4">
              <span className="text-gray-400">Attempted:</span> {location.pathname}
            </p>
          </div>

          {/* Smart Suggestions Section [web:119][web:120] */}
          {suggestedPages.length > 0 && (
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Looking for one of these?
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestedPages.map((page, index) => (
                  <Link
                    key={index}
                    to={page}
                    className="flex items-center gap-2 p-3 bg-white rounded-lg hover:bg-blue-100 transition-colors border border-blue-100 hover:border-blue-300 group"
                  >
                    <ArrowLeft className="w-4 h-4 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                      {page}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Search Bar [web:119] */}
          <form onSubmit={handleSearch} className="mb-8 max-w-md mx-auto">
            <label htmlFor="site-search" className="sr-only">
              Search site content
            </label>
            <div className="relative group">
              <input
                id="site-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search our site..."
                className="w-full px-5 py-4 pr-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm hover:border-gray-400"
                autoComplete="off"
                aria-label="Search site content"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                aria-label="Submit search"
                disabled={!searchQuery.trim()}
              >
                <Search size={22} className="transition-transform group-hover:scale-110" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Try searching for products, articles, or pages
            </p>
          </form>

          {/* Action Buttons [web:120] */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-semibold transform hover:scale-105"
              aria-label="Return to homepage"
            >
              <Home size={20} />
              Return Home
            </Link>

            <button
              onClick={goBack}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow font-semibold"
              aria-label="Go back to previous page"
            >
              <ArrowLeft size={20} />
              Go Back
            </button>
          </div>

          {/* Helpful Links Section [web:119][web:123] */}
          <div className="pt-8 border-t border-gray-200">
            <div className="text-center mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center justify-center gap-2">
                <HelpCircle size={16} />
                Need Help? Try These Pages
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  to="/"
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    🏠
                  </div>
                  <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    Home
                  </div>
                </Link>

                <Link
                  to="/help"
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    💬
                  </div>
                  <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    Help Center
                  </div>
                </Link>

                <Link
                  to="/contact"
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    📧
                  </div>
                  <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    Contact Us
                  </div>
                </Link>

                <Link
                  to="/sitemap"
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    🗺️
                  </div>
                  <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    Sitemap
                  </div>
                </Link>
              </div>
            </div>

            {/* Support Contact */}
            <div className="text-center text-sm text-gray-600 mt-6">
              Still can't find what you're looking for?{' '}
              <Link 
                to="/contact" 
                className="text-blue-600 hover:text-blue-700 underline font-medium"
              >
                Contact our support team
              </Link>
            </div>
          </div>

          {/* Development Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
              <p className="text-xs font-semibold text-yellow-800 mb-2">
                🐛 Debug Info (Development Only)
              </p>
              <div className="space-y-1 text-xs text-yellow-700 font-mono">
                <div><strong>Path:</strong> {location.pathname}</div>
                <div><strong>Search:</strong> {location.search || '(none)'}</div>
                <div><strong>Hash:</strong> {location.hash || '(none)'}</div>
                <div><strong>Referrer:</strong> {document.referrer || '(direct)'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Optimized animations [web:119] */}
        <style>{`
          @keyframes pulse-soft {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.6; }
          }
          @keyframes bounce-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          .animate-pulse-soft {
            animation: pulse-soft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .animate-bounce-gentle {
            animation: bounce-gentle 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </>
  );
};

export default NotFound;
