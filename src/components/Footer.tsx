import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Footer = () => {
  const socialLinks = [
    { name: "Twitter", url: "#", icon: "🐦" },
    { name: "Instagram", url: "#", icon: "📸" },
    { name: "LinkedIn", url: "#", icon: "💼" },
    { name: "Discord", url: "#", icon: "🎮" },
  ];

  const footerLinks = [
    {
      title: "Product",
      links: [
        { name: "Buy Pixels", href: "#buy" },
        { name: "Marketplace", href: "#marketplace" },
        { name: "How It Works", href: "#how-it-works" },
        { name: "Pricing", href: "#" },
      ]
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "#" },
        { name: "Contact Us", href: "#contact" },
        { name: "Terms of Service", href: "#" },
        { name: "Privacy Policy", href: "#" },
      ]
    },
    {
      title: "Community",
      links: [
        { name: "Discord Server", href: "#" },
        { name: "Success Stories", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Newsletter", href: "#" },
      ]
    }
  ];

  return (
    <footer id="contact" className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                BuyAPixel.in
              </div>
              <Badge variant="outline">India</Badge>
            </div>
            <p className="text-muted-foreground mb-6 max-w-md">
              India's first pixel marketplace where creativity meets opportunity. 
              Own your digital space and be part of internet history.
            </p>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Contact Information</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>📧 hello@buyapixel.in</div>
                  <div>📱 +91 98765 43210</div>
                  <div>📍 Mumbai, Maharashtra, India</div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                {socialLinks.map((link) => (
                  <Button key={link.name} variant="outline" size="sm" className="w-10 h-10 p-0">
                    <span className="text-lg">{link.icon}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Links Sections */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <a 
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-muted-foreground">
              © 2024 BuyAPixel.in. All rights reserved. Made with ❤️ in India.
            </div>
            
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;