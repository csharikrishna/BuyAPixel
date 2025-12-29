import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, Search, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Log 404 errors for monitoring
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );

    // Update document title for SEO and accessibility
    document.title = "404 - Page Not Found";

    // Add meta tags for proper 404 handling
    const metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      const meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex, follow";
      document.head.appendChild(meta);
    }

    // Cleanup on unmount
    return () => {
      document.title = ""; // Reset to default or app name
      if (metaRobots && (metaRobots as HTMLMetaElement).content === "noindex, follow") {
        metaRobots.remove();
      }
    };
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const goBack = () => {
    window.history.back();
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4"
      role="main"
      aria-labelledby="error-title"
    >
      <div className="max-w-2xl w-full text-center">
        {/* Animated 404 */}
        <div className="relative mb-8">
          <h1 
            id="error-title"
            className="text-9xl font-bold text-gray-300 select-none animate-pulse"
            aria-label="Error 404"
          >
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl animate-bounce">🔍</div>
          </div>
        </div>

        {/* Error Message */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
          Oops! Page Not Found
        </h2>
        
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved. 
          Let's get you back on track!
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-8 max-w-md mx-auto">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for content..."
              className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
              aria-label="Search site content"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-blue-500 transition-colors"
              aria-label="Submit search"
            >
              <Search size={20} />
            </button>
          </div>
        </form>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg font-medium"
            aria-label="Go to homepage"
          >
            <Home size={20} />
            Return Home
          </Link>

          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            aria-label="Go back to previous page"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4 font-medium">
            Popular Pages
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/about"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm transition-colors"
            >
              About Us
            </Link>
            <span className="text-gray-300">•</span>
            <Link
              to="/contact"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm transition-colors"
            >
              Contact
            </Link>
            <span className="text-gray-300">•</span>
            <Link
              to="/blog"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm transition-colors"
            >
              Blog
            </Link>
            <span className="text-gray-300">•</span>
            <Link
              to="/help"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm transition-colors"
            >
              Help Center
            </Link>
          </div>
        </div>

        {/* Attempted URL Display (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800 font-mono">
              Attempted URL: {location.pathname}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-bounce {
          animation: bounce 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default NotFound;
