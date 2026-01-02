import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
   HelpCircle,
   Map,
   ShoppingCart,
   Image as ImageIcon,
   ShieldCheck,
   Coins,
   ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Help = () => {
   return (
      <div className="min-h-screen bg-gray-50 font-sans">
         <Header />

         <main className="container mx-auto px-4 py-8 max-w-5xl">
            {/* Page Header */}
            <div className="text-center mb-12 space-y-4">
               <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900">
                  How Can We <span className="text-primary">Help You?</span>
               </h1>
               <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Everything you need to know about buying pixels, managing your space, and joining the BuyAPixel community.
               </p>
            </div>

            {/* Quick Guide Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-16">
               <Card className="hover:shadow-lg transition-shadow border-primary/10">
                  <CardHeader>
                     <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                        <Map className="w-6 h-6" />
                     </div>
                     <CardTitle>1. Select Pixels</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     Navigate the 150x150 grid. Zoom in to find your perfect spot. Click individual pixels or drag to select a block.
                  </CardContent>
               </Card>

               <Card className="hover:shadow-lg transition-shadow border-primary/10">
                  <CardHeader>
                     <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                        <ShoppingCart className="w-6 h-6" />
                     </div>
                     <CardTitle>2. Purchase</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     Secure your spot forever. Pay via UPI or Card. Once purchased, you own those pixels on the global canvas.
                  </CardContent>
               </Card>

               <Card className="hover:shadow-lg transition-shadow border-primary/10">
                  <CardHeader>
                     <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600">
                        <ImageIcon className="w-6 h-6" />
                     </div>
                     <CardTitle>3. Customize</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     Upload your logo, art, or message. Add a link to your website. You can update your content anytime!
                  </CardContent>
               </Card>
            </div>

            {/* Pricing Zones */}
            <div className="mb-16">
               <h2 className="text-3xl font-bold mb-8 text-center">Pricing Zones</h2>
               <div className="grid md:grid-cols-3 gap-8">
                  <div className="relative group">
                     <div className="absolute inset-0 bg-yellow-500 blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                     <div className="relative bg-white border-2 border-yellow-400 rounded-xl p-6 text-center transform hover:-translate-y-1 transition-transform">
                        <div className="text-yellow-600 font-bold tracking-wider text-sm uppercase mb-2">Gold Zone</div>
                        <div className="text-4xl font-extrabold text-gray-900 mb-2">₹299</div>
                        <p className="text-sm text-muted-foreground mb-4">per pixel</p>
                        <p className="text-gray-600">The center 60x60 block. Highest visibility, right in the middle of the action.</p>
                     </div>
                  </div>

                  <div className="relative group">
                     <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                     <div className="relative bg-white border-2 border-blue-400 rounded-xl p-6 text-center transform hover:-translate-y-1 transition-transform">
                        <div className="text-blue-600 font-bold tracking-wider text-sm uppercase mb-2">Premium Zone</div>
                        <div className="text-4xl font-extrabold text-gray-900 mb-2">₹199</div>
                        <p className="text-sm text-muted-foreground mb-4">per pixel</p>
                        <p className="text-gray-600">Surrounding the center (120x120). Great visibility at a balanced price.</p>
                     </div>
                  </div>

                  <div className="relative group">
                     <div className="absolute inset-0 bg-gray-500 blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                     <div className="relative bg-white border-2 border-gray-200 rounded-xl p-6 text-center transform hover:-translate-y-1 transition-transform">
                        <div className="text-gray-600 font-bold tracking-wider text-sm uppercase mb-2">Standard Zone</div>
                        <div className="text-4xl font-extrabold text-gray-900 mb-2">₹99</div>
                        <p className="text-sm text-muted-foreground mb-4">per pixel</p>
                        <p className="text-gray-600">The outer edges. Perfect for large logos and affordable expansion.</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* FAQ Section */}
            <div className="grid lg:grid-cols-12 gap-12 mb-16">
               <div className="lg:col-span-4 space-y-6">
                  <h2 className="text-3xl font-bold flex items-center gap-2">
                     <HelpCircle className="w-8 h-8 text-primary" />
                     FAQs
                  </h2>
                  <p className="text-muted-foreground text-lg">
                     Frequently asked questions about owning a piece of the internet.
                  </p>
                  <div className="p-6 bg-primary/5 rounded-xl border border-primary/10">
                     <h3 className="font-semibold text-lg mb-2">Still have questions?</h3>
                     <p className="text-sm text-muted-foreground mb-4">
                        Can't find the answer you're looking for? Our support team is here to help.
                     </p>
                     <Link to="/contact">
                        <Button className="w-full gap-2">
                           Contact Support <ArrowRight className="w-4 h-4" />
                        </Button>
                     </Link>
                  </div>
               </div>

               <div className="lg:col-span-8">
                  <Accordion type="single" collapsible className="w-full space-y-4">
                     <AccordionItem value="item-1" className="bg-white px-6 rounded-lg border">
                        <AccordionTrigger className="text-lg font-medium">Is this a one-time payment?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-base">
                           Yes! When you buy pixels on BuyAPixel, you pay once and own them forever. There are no monthly fees or renewal costs.
                        </AccordionContent>
                     </AccordionItem>

                     <AccordionItem value="item-2" className="bg-white px-6 rounded-lg border">
                        <AccordionTrigger className="text-lg font-medium">Can I change my image later?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-base">
                           Absolutely. As the owner, you can log in to your dashboard at any time to upload a new image, change the link URL, or edit the hover text for your pixels.
                        </AccordionContent>
                     </AccordionItem>

                     <AccordionItem value="item-3" className="bg-white px-6 rounded-lg border">
                        <AccordionTrigger className="text-lg font-medium">What is the "Marketplace"?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-base">
                           The Marketplace allows you to resell pixels you own. Since prime locations are limited, you can list your high-traffic pixels for sale at a price you choose. If someone buys them, the ownership transfers to them and you get paid.
                        </AccordionContent>
                     </AccordionItem>

                     <AccordionItem value="item-4" className="bg-white px-6 rounded-lg border">
                        <AccordionTrigger className="text-lg font-medium">Are there content restrictions?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-base">
                           Yes. We want to keep BuyAPixel fun and safe for everyone. Using pixels for hate speech, illegal content, or explicit material will result in a ban and removal of content without refund. Check our <Link to="/terms" className="text-primary underline">Terms of Service</Link> for details.
                        </AccordionContent>
                     </AccordionItem>

                     <AccordionItem value="item-5" className="bg-white px-6 rounded-lg border">
                        <AccordionTrigger className="text-lg font-medium">How big is the grid?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-base">
                           The grid is 150x150 pixels, meaning there are 22,500 pixels in total. It's a limited supply of digital real estate!
                        </AccordionContent>
                     </AccordionItem>
                  </Accordion>
               </div>
            </div>

         </main>
         <Footer />
      </div>
   );
};

export default Help;
