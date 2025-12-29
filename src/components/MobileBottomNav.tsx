

//if need a bottom nav bar for mobile devices i can use this code here 
// import { MobileBottomNav } from "@/components/MobileBottomNav";
// <MobileBottomNav />


import { Home, Grid3x3, User, ShoppingCart, Trophy } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

export const MobileBottomNav = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Only show on mobile devices
  if (!isMobile) {
    return null;
  }

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/canvas", icon: Grid3x3, label: "Canvas" },
    { path: "/buy-pixels", icon: ShoppingCart, label: "Buy" },
    { path: "/leaderboard", icon: Trophy, label: "Leaders" },
    { path: isAuthenticated ? "/profile" : "/signin", icon: User, label: isAuthenticated ? "Profile" : "Sign In" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-colors ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className={`text-xs font-medium truncate ${isActive ? "font-semibold" : ""}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
