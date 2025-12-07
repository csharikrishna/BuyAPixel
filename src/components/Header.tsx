import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, User, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

const Header = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ✅ CLEANED: Removed Canvas View reference
  const navItems = [
    { label: "Buy Pixels", to: "/" },
    { label: "Marketplace", to: "/marketplace" },
    { label: "Leaderboard", to: "/leaderboard" },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/");
      setMobileMenuOpen(false);
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b glass backdrop-blur-lg bg-background/80">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="text-xl md:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent tracking-tight">
            BuyAPixel
          </div>
          <Badge variant="secondary" className="hidden sm:flex text-xs font-semibold">
            ₹99+
          </Badge>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navItems.map((item) => (
            <Button key={item.label} variant="ghost" size="sm" asChild>
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="outline" size="sm" className="hidden lg:flex items-center gap-2 h-10" asChild>
            <Link to="/leaderboard">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </Link>
          </Button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-10">
                  <User className="w-4 h-4" />
                  <span className="hidden lg:inline">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background border-border">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
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
              <Button variant="default" size="sm" className="btn-premium h-10" asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <div className="flex md:hidden items-center gap-2">
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                  <User className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-background">
              <div className="flex flex-col space-y-4 mt-8">
                {navItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className="justify-start"
                    asChild
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link to={item.to}>{item.label}</Link>
                  </Button>
                ))}
                
                <div className="border-t pt-4">
                  {isAuthenticated ? (
                    <>
                      <Button
                        variant="ghost"
                        className="justify-start w-full"
                        asChild
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Link to="/profile">
                          <User className="w-4 h-4 mr-2" />
                          My Profile
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="justify-start w-full text-destructive"
                        onClick={handleSignOut}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
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
                        className="justify-start w-full btn-premium"
                        asChild
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Link to="/signup">Sign Up</Link>
                      </Button>
                    </>
                  )}
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
