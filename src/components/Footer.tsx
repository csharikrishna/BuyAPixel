import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Mail, MapPin, Instagram, MessageCircle, Heart, ArrowRight } from "lucide-react";
import { LOGO } from "@/lib/branding";

const Footer = () => {
  const socialLinks = [
    { name: "Instagram", url: "https://instagram.com/buyaspot.in", icon: Instagram },
    { name: "Discord", url: "https://discord.gg/BuyASpot", icon: MessageCircle },
  ];

  const footerLinks = [
    {
      title: "Product",
      links: [
        { name: "Buy Pixels", href: "/" },
        { name: "Live Stats", href: "/stats" },
        { name: "Marketplace", href: "/marketplace" },
        { name: "Leaderboard", href: "/leaderboard" },
      ]
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "/help" },
        { name: "Contact Us", href: "/contact" },
        { name: "Payment Help", href: "/payment-help" },
        { name: "Refund Policy", href: "/refund-policy" },
      ]
    },
    {
      title: "Legal",
      links: [
        { name: "Terms of Service", href: "/terms" },
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Content Guidelines", href: "/content-guidelines" },
      ]
    }
  ];

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-white to-slate-50/80 dark:from-gray-950 dark:to-gray-900 border-t border-slate-200 dark:border-slate-800" role="contentinfo" aria-label="Site footer">
      <div className="container mx-auto px-4 py-16 md:py-20 max-w-7xl">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          
          {/* Brand Section */}
          <div className="lg:col-span-5 pr-0 md:pr-8">
            <div className="flex items-center space-x-3 mb-6">
              <Link to="/" className="group flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg">
                <img 
                  src={LOGO} 
                  alt="BuyASpot Logo" 
                  className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-sm"
                />
                <div className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight">
                  BuyASpot
                </div>
              </Link>
              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                India
              </Badge>
            </div>
            
            <p className="text-muted-foreground mb-8 text-sm leading-relaxed max-w-sm">
              India's premier digital canvas and pixel marketplace. 
              Claim your spot, promote your vision, and become part of internet history.
            </p>

            <div className="space-y-4">
              <a
                href="mailto:support@buyaspot.in"
                className="inline-flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors group bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700/50 shadow-sm"
              >
                <Mail className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                <span className="font-medium">support@buyaspot.in</span>
                <ArrowRight className="w-3 h-3 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all text-primary" />
              </a>
              
              <div className="flex items-center gap-2 pt-2">
                {socialLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Button
                      key={link.name}
                      variant="outline"
                      size="icon"
                      className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all shadow-sm"
                      asChild
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.name}
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Links Sections */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 pt-2">
            {footerLinks.map((section) => (
              <div key={section.title}>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-6 text-sm tracking-wider uppercase">{section.title}</h4>
                <ul className="space-y-3.5">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      {link.href.startsWith('http') ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors inline-flex items-center gap-1.5 group font-medium"
                        >
                          {link.name}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors inline-flex items-center gap-1.5 group font-medium"
                        >
                          {link.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-slate-200 dark:border-slate-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium text-center md:text-left">
            <span>© {currentYear} BuyASpot.in. All rights reserved.</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              Made with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" /> in Mumbai
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>100% Secure</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
