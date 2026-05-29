import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Trophy,
  User,
  LogOut,
  Menu,
  X,
  Home,
  Store,
  BookOpen,
  Info,
  Shield,
  ScanLine,
  HelpCircle,
  MessageCircle,
  BarChart3,
  Rocket,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
// Defer supabase import - only load when prefetch is actually triggered
// import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LOGO } from "@/lib/branding";

// ======================
// TYPES & INTERFACES
// ======================

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  onPrefetch?: () => void;
  external?: boolean;
}

// ======================
// CONSTANTS
// ======================

const SCROLL_THRESHOLD = 50; // px to trigger header shadow
const PREFETCH_DELAY = 100; // ms delay before prefetching

// ======================
// COMPONENT
// ======================

const Header = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [logoSrc, setLogoSrc] = useState(LOGO);

  useEffect(() => {
    setLogoSrc(LOGO);
  }, [LOGO]);

  // Refs
  const prefetchTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const isMountedRef = useRef(true);
  const headerRef = useRef<HTMLElement>(null);

  // State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear all prefetch timers
      Object.values(prefetchTimerRef.current).forEach(clearTimeout);
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Scroll detection for header shadow — uses ref to avoid listener re-registration
  const isScrolledRef = useRef(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    let lastY = window.scrollY;
    
    const handleScroll = () => {
      const currentY = window.scrollY;
      const scrolled = currentY > SCROLL_THRESHOLD;

      // update shadow state
      if (scrolled !== isScrolledRef.current) {
        isScrolledRef.current = scrolled;
        setIsScrolled(scrolled);
      }

      // Handle header visibility based on scroll direction
      if (currentY < lastY) {
        // Scrolling up - show header immediately
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        setHeaderHidden(false);
      } else if (currentY > lastY && currentY > SCROLL_THRESHOLD + 20) {
        // Scrolling down past threshold - hide with debounce
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => {
          setHeaderHidden(true);
        }, 150);
      }

      lastY = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [headerHidden]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Respect reduced motion for transitions
  const prefersReducedMotion = useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }, []);

  // ======================
  // PREFETCH HANDLERS (Optimized with debouncing)
  // ======================

  const createPrefetchHandler = useCallback(
    (key: string, prefetchFn: () => void | Promise<void>) => {
      return () => {
        // Clear existing timer for this key
        if (prefetchTimerRef.current[key]) {
          clearTimeout(prefetchTimerRef.current[key]);
        }

        // Set new timer
        prefetchTimerRef.current[key] = setTimeout(() => {
          if (isMountedRef.current) {
            // Handle both sync and async prefetch functions
            Promise.resolve(prefetchFn());
          }
        }, PREFETCH_DELAY);
      };
    },
    []
  );

  const prefetchProfile = useMemo(
    () =>
      createPrefetchHandler('profile', async () => {
        if (!user?.id) return;
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          queryClient.prefetchQuery({
            queryKey: ['profile', user.id],
            queryFn: async () => {
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
              return data;
            },
            staleTime: 5 * 60 * 1000,
          });
        } catch (error) {
          console.warn('Failed to prefetch profile:', error);
        }
      }),
    [queryClient, user?.id, createPrefetchHandler]
  );

  // memoized home prefetch (no network cost, placeholder for future)
  const prefetchHome = useMemo(() => createPrefetchHandler('home', () => {}), [createPrefetchHandler]);

  const prefetchMarketplace = useMemo(
    () =>
      createPrefetchHandler('marketplace', async () => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          queryClient.prefetchQuery({
            queryKey: ['marketplace_stats_landing'],
            queryFn: async () => {
              const { count } = await supabase
                .from('marketplace_listings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'active');
              return { active_listings: count || 0 };
            },
            staleTime: 2 * 60 * 1000,
          });
        } catch (error) {
          console.warn('Failed to prefetch marketplace:', error);
        }
      }),
    [queryClient, createPrefetchHandler]
  );

  const prefetchLeaderboard = useMemo(
    () =>
      createPrefetchHandler('leaderboard', async () => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          queryClient.prefetchQuery({
            queryKey: ['leaderboard_preview'],
            queryFn: async () => {
              const { data } = await supabase
                .from('profiles')
                .select('user_id, full_name, pixel_count')
                .order('pixel_count', { ascending: false })
                .limit(10);
              return data;
            },
            staleTime: 5 * 60 * 1000,
          });
        } catch (error) {
          console.warn('Failed to prefetch leaderboard:', error);
        }
      }),
    [queryClient, createPrefetchHandler]
  );

  // ======================
  // NAV ITEMS (Memoized)
  // ======================

  const navItems: NavItem[] = useMemo(
    () => [
      { label: 'Buy Pixels', to: '/', icon: Home },
      { label: 'Scan', to: '/scan', icon: ScanLine },
      { label: 'Marketplace', to: '/marketplace', icon: Store, onPrefetch: prefetchMarketplace },
      { label: 'Directory', to: '/directory', icon: Rocket },
      { label: 'Leaderboard', to: '/leaderboard', icon: Trophy, onPrefetch: prefetchLeaderboard },
      { label: 'Live Stats', to: '/stats', icon: BarChart3 },
      { label: 'Blog', to: '/blog', icon: BookOpen },
      { label: 'About', to: '/about', icon: Info },
      { label: 'Help', to: '/help', icon: HelpCircle },
      { label: 'Contact', to: '/contact', icon: MessageCircle },
    ],
    [prefetchMarketplace, prefetchLeaderboard]
  );

  // ======================
  // HANDLERS
  // ======================

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
      setMobileMenuOpen(false);
      setDropdownOpen(false);
    } catch (error: unknown) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  }, [signOut, navigate]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // ======================
  // ACTIVE ROUTE CHECK (Optimized)
  // ======================

  const isActiveRoute = useCallback(
    (path: string) => {
      if (path === '/blog') return location.pathname.startsWith('/blog');
      if (path === '/admin') return location.pathname.startsWith('/admin');
      return location.pathname === path;
    },
    [location.pathname]
  );

  // ======================
  // KEYBOARD SHORTCUTS
  // ======================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close mobile menu on ESC
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }

      // Close dropdown on ESC
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
      }

      // Open search with Ctrl/Cmd + K (future enhancement)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Future: Open search modal
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, dropdownOpen]);

  return (
    <header
      ref={headerRef}
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border/40 backdrop-blur-xl',
        'bg-background/85 supports-[backdrop-filter]:bg-background/70',
        // transition handling (respect reduced motion)
        prefersReducedMotion ? 'transition-none' : 'transition-transform duration-300',
        // translate header for hide/show on scroll
        headerHidden ? '-translate-y-full' : 'translate-y-0',
        // shadow when scrolled
        isScrolled && 'shadow-lg shadow-black/[0.04]'
      )}
      role="banner"
    >
      {/* Skip link for keyboard users */}
      <a
        href="#content"
        className="sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-background focus:text-primary px-3 py-2 rounded-md"
      >
        Skip to content
      </a>
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10 w-full">
        {/* LOGO */}
        <Link
          to="/"
          className="flex items-center gap-2.5 shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md"
          aria-label="BuyASpot"
          onMouseEnter={prefetchHome}
        >
          <img 
            src={logoSrc} 
            alt="BuyASpot Logo" 
            width={32}
            height={32}
            className="w-8 h-8 object-contain transition-all group-hover:scale-105 drop-shadow-sm"
            fetchpriority="high"
            decoding="async"
            loading="eager"
          />
          <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight transition-all group-hover:scale-105">
            BuyASpot
          </div>
          <Badge variant="secondary" className="hidden sm:flex text-xs font-semibold">
            ₹99+
          </Badge>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden lg:flex items-center space-x-0.5" role="navigation" aria-label="Main navigation">
          {navItems.map(({ label, to, icon: Icon, onPrefetch }) => {
            const active = isActiveRoute(to);
            return (
              <Button
                key={to}
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'gap-2 transition-all',
                  active && 'bg-primary/10 text-primary font-semibold'
                )}
                asChild
                onMouseEnter={onPrefetch}
                onFocus={onPrefetch}
              >
                <Link to={to} aria-current={active ? 'page' : undefined}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {label}
                </Link>
              </Button>
            );
          })}

          {/* ADMIN BUTTON (Desktop) */}
          {isAdmin && (
            <Button
              variant={isActiveRoute('/admin') ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'gap-2 transition-all',
                isActiveRoute('/admin') && 'bg-destructive/10 text-destructive font-semibold'
              )}
              asChild
            >
              <Link to="/admin" aria-current={isActiveRoute('/admin') ? 'page' : undefined}>
                <Shield className="w-4 h-4" aria-hidden="true" />
                Admin
              </Link>
            </Button>
          )}
        </nav>

        {/* DESKTOP AUTH */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-10"
                  onMouseEnter={prefetchProfile}
                  aria-label="User account menu"
                >
                  <User className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden lg:inline">Account</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">My Account</p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground truncate" title={user.email}>
                        {user.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild onMouseEnter={prefetchProfile}>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" aria-hidden="true" />
                    My Profile
                  </Link>
                </DropdownMenuItem>

                {/* ADMIN LINK (Tablet/Mobile only) */}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="lg:hidden" />
                    <DropdownMenuItem asChild className="lg:hidden">
                      <Link to="/admin" className="cursor-pointer text-destructive">
                        <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem asChild className="lg:hidden">
                  <Link to="/about" className="cursor-pointer">
                    <Info className="w-4 h-4 mr-2" aria-hidden="true" />
                    About
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-10" asChild>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button
                size="sm"
                className="h-10 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                asChild
              >
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        {/* MOBILE MENU */}
        <div className="flex md:hidden items-center gap-2">
          {/* Mobile User Menu */}
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  aria-label="User account menu"
                >
                  <User className="w-4 h-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">My Account</p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground truncate" title={user.email}>
                        {user.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" aria-hidden="true" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer text-destructive">
                        <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile Navigation Sheet */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Menu className="w-5 h-5" aria-hidden="true" />
                )}
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left flex items-center gap-2">
                  <img 
                    src={logoSrc} 
                    alt="BuyASpot Logo" 
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain drop-shadow-sm"
                    loading="lazy"
                  />
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                    BuyASpot
                  </span>
                </SheetTitle>
                <SheetDescription className="text-left text-sm text-muted-foreground">
                  Navigate to different sections
                </SheetDescription>
              </SheetHeader>

              <nav className="flex flex-col space-y-3 mt-8" role="navigation" aria-label="Mobile navigation">
                {/* Navigation Links */}
                {navItems.map(({ label, to, icon: Icon }) => (
                  <Button
                    key={to}
                    variant={isActiveRoute(to) ? 'secondary' : 'ghost'}
                    className={cn(
                      'justify-start gap-2 w-full',
                      isActiveRoute(to) && 'bg-primary/10 text-primary font-semibold'
                    )}
                    asChild
                    onClick={closeMobileMenu}
                  >
                    <Link to={to} aria-current={isActiveRoute(to) ? 'page' : undefined}>
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      {label}
                    </Link>
                  </Button>
                ))}

                {/* Admin Link */}
                {isAdmin && (
                  <>
                    <div className="border-t my-2" role="separator" />
                    <Button
                      variant={isActiveRoute('/admin') ? 'secondary' : 'ghost'}
                      className={cn(
                        'justify-start gap-2 w-full',
                        isActiveRoute('/admin') && 'bg-destructive/10 text-destructive font-semibold'
                      )}
                      asChild
                      onClick={closeMobileMenu}
                    >
                      <Link to="/admin" aria-current={isActiveRoute('/admin') ? 'page' : undefined}>
                        <Shield className="w-4 h-4" aria-hidden="true" />
                        Admin Dashboard
                      </Link>
                    </Button>
                  </>
                )}

                {/* Auth Section */}
                <div className="border-t pt-4 space-y-2" role="separator">
                  {isAuthenticated ? (
                    <>
                      <Button
                        variant="ghost"
                        className="justify-start w-full gap-2"
                        asChild
                        onClick={closeMobileMenu}
                      >
                        <Link to="/profile">
                          <User className="w-4 h-4" aria-hidden="true" />
                          My Profile
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="justify-start w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleSignOut}
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className="justify-start w-full"
                        asChild
                        onClick={closeMobileMenu}
                      >
                        <Link to="/signin">Sign In</Link>
                      </Button>
                      <Button
                        variant="default"
                        className="justify-start w-full bg-gradient-to-r from-primary to-accent"
                        asChild
                        onClick={closeMobileMenu}
                      >
                        <Link to="/signup">Sign Up</Link>
                      </Button>
                    </>
                  )}
                </div>

                {/* Footer Info */}
                <div className="pt-4 mt-auto border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    India's First Pixel Marketplace
                  </p>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Version 1.0.0
                  </p>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
