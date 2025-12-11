import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Twitter, Instagram, Linkedin, MessageCircle, Heart } from "lucide-react";

const Footer = () => {
  const socialLinks = [
    { name: "Twitter", url: "https://twitter.com", icon: Twitter },
    { name: "Instagram", url: "https://instagram.com", icon: Instagram },
    { name: "LinkedIn", url: "https://linkedin.com", icon: Linkedin },
    { name: "Discord", url: "https://discord.com", icon: MessageCircle },
  ];

  const footerLinks = [
    {
      title: "Product",
      links: [
        { name: "Buy Pixels", href: "/" },
        { name: "Marketplace", href: "/marketplace" },
        { name: "Leaderboard", href: "/leaderboard" },
        { name: "How It Works", href: "/#how-it-works" },
      ]
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "/help" },
        { name: "Contact Us", href: "/contact" },
        { name: "Terms of Service", href: "/terms" },
        { name: "Privacy Policy", href: "/privacy" },
      ]
    },
    {
      title: "Community",
      links: [
        { name: "Discord Server", href: "https://discord.com" },
        { name: "Success Stories", href: "/success-stories" },
        { name: "Blog", href: "/blog" },
        { name: "Newsletter", href: "/newsletter" },
      ]
    }
  ];

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-muted/30 to-muted/50 border-t">
      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* Main Grid - Different layout for mobile vs desktop */}
        <div className="grid grid-cols-1 gap-8 lg:gap-12">
          {/* Brand Section - Full width on mobile */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Link to="/" className="group">
                <div className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent transition-all group-hover:scale-105">
                  BuyAPixel.in
                </div>
              </Link>
              <Badge variant="outline" className="text-xs font-semibold border-primary/20">
                India
              </Badge>
            </div>
            <p className="text-muted-foreground mb-6 max-w-md text-sm leading-relaxed">
              India's first pixel marketplace where creativity meets opportunity. 
              Own your digital space and be part of internet history.
            </p>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 text-sm">Contact Information</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <a 
                    href="mailto:support@buyapixel.in" 
                    className="flex items-center gap-2 hover:text-foreground transition-colors group"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0 group-hover:text-primary transition-colors" />
                    support@buyapixel.in
                  </a>
                  <a 
                    href="tel:+919876543210" 
                    className="flex items-center gap-2 hover:text-foreground transition-colors group"
                  >
                    <Phone className="w-4 h-4 flex-shrink-0 group-hover:text-primary transition-colors" />
                    +91 98765 43210
                  </a>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    Mumbai, Maharashtra, India
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3 text-sm">Follow Us</h4>
                <div className="flex space-x-2">
                  {socialLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Button 
                        key={link.name} 
                        variant="outline" 
                        size="sm" 
                        className="w-9 h-9 p-0 hover:bg-primary/10 hover:border-primary/30 transition-all"
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
          </div>

          {/* Links Sections - 2 columns on mobile, 3 on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {footerLinks.map((section) => (
              <div key={section.title}>
                <h4 className="font-semibold mb-4 text-sm">{section.title}</h4>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      {link.href.startsWith('http') ? (
                        <a 
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                        >
                          {link.name}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
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
        <div className="border-t border-border/50 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-sm text-muted-foreground">
            <div className="flex flex-col sm:flex-row items-center gap-1 text-center sm:text-left">
              <span>© {currentYear} BuyAPixel.in. All rights reserved.</span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                Made with <Heart className="w-3 h-3 text-red-500 fill-red-500 inline-block" /> in India
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-xs">
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Badge */}
      <div className="bg-muted/30 border-t border-border/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>24/7 Support</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Made in India</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
