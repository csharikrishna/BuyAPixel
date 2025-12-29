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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useState } from "react";
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
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Header = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ======================
  // NAV ITEMS (UPDATED)
  // ======================
  const navItems = [
    { label: "Buy Pixels", to: "/", icon: Home },
    { label: "Marketplace", to: "/marketplace", icon: Store },
    { label: "Leaderboard", to: "/leaderboard", icon: Trophy },
    { label: "Blog", to: "/blog", icon: BookOpen },
    { label: "About", to: "/about", icon: Info },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/");
      setMobileMenuOpen(false);
    } catch {
      toast.error("Failed to sign out");
    }
  };

  // ======================
  // ACTIVE ROUTE CHECK
  // ======================
  const isActiveRoute = (path: string) => {
    if (path === "/blog") return location.pathname.startsWith("/blog");
    if (path === "/admin") return location.pathname.startsWith("/admin");
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b backdrop-blur-lg bg-background/80 supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight transition-all group-hover:scale-105">
            BuyAPixel
          </div>
          <Badge
            variant="secondary"
            className="hidden sm:flex text-xs font-semibold"
          >
            ₹99+
          </Badge>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navItems.map(({ label, to, icon: Icon }) => {
            const active = isActiveRoute(to);
            return (
              <Button
                key={label}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2 transition-all",
                  active && "bg-primary/10 text-primary font-semibold"
                )}
                asChild
              >
                <Link to={to}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              </Button>
            );
          })}

          {/* ADMIN BUTTON (Desktop - Outside dropdown) */}
          {isAdmin && (
            <Button
              variant={isActiveRoute("/admin") ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "gap-2 transition-all",
                isActiveRoute("/admin") &&
                  "bg-destructive/10 text-destructive font-semibold"
              )}
              asChild
            >
              <Link to="/admin">
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            </Button>
          )}
        </nav>

        {/* DESKTOP AUTH */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-10">
                  <User className="w-4 h-4" />
                  <span className="hidden lg:inline">Account</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">My Account</p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </Link>
                </DropdownMenuItem>

                {/* ADMIN DASHBOARD LINK (For mobile/tablet only) */}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="lg:hidden" />
                    <DropdownMenuItem asChild className="lg:hidden">
                      <Link to="/admin" className="cursor-pointer text-destructive">
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem asChild className="lg:hidden">
                  <Link to="/about" className="cursor-pointer">
                    <Info className="w-4 h-4 mr-2" />
                    About
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
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
                className="h-10 bg-gradient-to-r from-primary to-accent"
                asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        {/* MOBILE MENU */}
        <div className="flex md:hidden items-center gap-2">
          {/* Mobile User Menu (Separate from navigation) */}
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                  <User className="w-4 h-4" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">My Account</p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer text-destructive">
                        <Shield className="w-4 h-4 mr-2" />
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
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile Navigation Sheet */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                    BuyAPixel
                  </span>
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col space-y-3 mt-8">
                {/* Navigation Links */}
                {navItems.map(({ label, to, icon: Icon }) => (
                  <Button
                    key={label}
                    variant={isActiveRoute(to) ? "secondary" : "ghost"}
                    className={cn(
                      "justify-start gap-2",
                      isActiveRoute(to) &&
                        "bg-primary/10 text-primary font-semibold"
                    )}
                    asChild
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link to={to}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  </Button>
                ))}

                {/* Admin Link for Mobile */}
                {isAdmin && (
                  <>
                    <div className="border-t my-2" />
                    <Button
                      variant={isActiveRoute("/admin") ? "secondary" : "ghost"}
                      className={cn(
                        "justify-start gap-2",
                        isActiveRoute("/admin") &&
                          "bg-destructive/10 text-destructive font-semibold"
                      )}
                      asChild
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link to="/admin">
                        <Shield className="w-4 h-4" />
                        Admin Dashboard
                      </Link>
                    </Button>
                  </>
                )}

                {/* Auth Section */}
                <div className="border-t pt-4 space-y-2">
                  {isAuthenticated ? (
                    <>
                      <Button
                        variant="ghost"
                        className="justify-start w-full gap-2"
                        asChild
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Link to="/profile">
                          <User className="w-4 h-4" />
                          My Profile
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="justify-start w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleSignOut}
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className="justify-start w-full"
                        asChild
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Link to="/signin">Sign In</Link>
                      </Button>
                      <Button
                        variant="default"
                        className="justify-start w-full bg-gradient-to-r from-primary to-accent"
                        asChild
                        onClick={() => setMobileMenuOpen(false)}
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
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
