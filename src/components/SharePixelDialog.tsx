import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
   Twitter,
   Linkedin,
   Link as LinkIcon,
   Check,
   Instagram,
   Send,
   MessageCircle,
   Share2,
   Facebook,
   Mail,
   QrCode,
   Download
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";

interface SharePixelDialogProps {
   isOpen: boolean;
   onClose: () => void;
   pixel: {
      x: number;
      y: number;
      url?: string;
   } | null;
}

export const SharePixelDialog = ({ isOpen, onClose, pixel }: SharePixelDialogProps) => {
   const [copied, setCopied] = useState(false);
   const [showQr, setShowQr] = useState(false);

   // Memoize share content
   const shareContent = useMemo(() => {
      if (!pixel) {
         return { url: '', text: '', title: '' };
      }
      return {
         url: `${window.location.origin}?pixel=${pixel.x},${pixel.y}`,
         text: `I just bought a pixel at (${pixel.x}, ${pixel.y}) on #BuyASpot! Own a piece of internet history forever. 🚀`,
         title: `My Pixel at (${pixel.x}, ${pixel.y}) | BuyASpot`
      };
   }, [pixel]);

   const handleNativeShare = useCallback(async () => {
      if (navigator.share) {
         try {
            await navigator.share({
               title: shareContent.title,
               text: shareContent.text,
               url: shareContent.url
            });
            toast.success("Shared successfully!");
         } catch (err: unknown) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
               toast.error("Failed to share");
            }
         }
      } else {
         toast.info("Native sharing not supported on this browser");
         handleCopyLink();
      }
   }, [shareContent]);

   const handleCopyLink = useCallback(() => {
      navigator.clipboard.writeText(shareContent.url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
   }, [shareContent.url]);

   const handleShare = useCallback((platform: string) => {
      const encodedText = encodeURIComponent(shareContent.text);
      const encodedUrl = encodeURIComponent(shareContent.url);
      const encodedTitle = encodeURIComponent(shareContent.title);

      const urls: Record<string, string> = {
         twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
         whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
         telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
         linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}`,
         threads: `https://threads.net/intent/post?text=${encodedText}%20${encodedUrl}`,
         facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
         reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
         email: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`
      };

      if (platform === 'email') {
         window.location.href = urls[platform];
      } else {
         window.open(urls[platform], '_blank', 'noopener,noreferrer,width=600,height=700');
      }
   }, [shareContent]);

   const handleInstagram = useCallback(() => {
      navigator.clipboard.writeText(shareContent.url);
      toast.info("Link copied for Instagram!", {
         description: "Paste in your Story, Reel, or DM! Instagram doesn't support direct web sharing.",
         duration: 5000,
         action: {
            label: "Open App",
            onClick: () => window.open('https://instagram.com', '_blank', 'noopener,noreferrer')
         }
      });
   }, [shareContent.url]);

   const handleDownloadQr = useCallback(async () => {
      try {
         const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=20&data=${encodeURIComponent(shareContent.url)}`;
         const response = await fetch(qrUrl);
         const blob = await response.blob();
         const url = window.URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `pixel-${pixel?.x}-${pixel?.y}-qr.png`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         window.URL.revokeObjectURL(url);
         toast.success("QR Code downloaded successfully!");
      } catch (err: unknown) {
         toast.error("Failed to download QR code");
      }
   }, [shareContent.url, pixel]);

   if (!pixel) return null;

   const socialButtons = [
      { id: 'twitter', name: 'Twitter', icon: <Twitter className="w-5 h-5" />, colorClass: 'hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2]', action: () => handleShare('twitter') },
      { id: 'facebook', name: 'Facebook', icon: <Facebook className="w-5 h-5" />, colorClass: 'hover:bg-[#1877F2]/10 hover:text-[#1877F2]', action: () => handleShare('facebook') },
      { id: 'whatsapp', name: 'WhatsApp', icon: <MessageCircle className="w-5 h-5" />, colorClass: 'hover:bg-[#25D366]/10 hover:text-[#25D366]', action: () => handleShare('whatsapp') },
      { id: 'telegram', name: 'Telegram', icon: <Send className="w-5 h-5" />, colorClass: 'hover:bg-[#0088cc]/10 hover:text-[#0088cc]', action: () => handleShare('telegram') },
      { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" />, colorClass: 'hover:bg-[#0A66C2]/10 hover:text-[#0A66C2]', action: () => handleShare('linkedin') },
      { id: 'instagram', name: 'Instagram', icon: <Instagram className="w-5 h-5" />, colorClass: 'hover:bg-[#E1306C]/10 hover:text-[#E1306C]', action: handleInstagram },
      { 
         id: 'reddit', 
         name: 'Reddit', 
         icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
               <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
         ),
         colorClass: 'hover:bg-[#FF4500]/10 hover:text-[#FF4500]', 
         action: () => handleShare('reddit') 
      },
      { 
         id: 'threads', 
         name: 'Threads', 
         icon: (
            <svg className="w-5 h-5" viewBox="0 0 192 192" fill="currentColor">
               <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.924-10.503 21.338-10.503h.229c6.636.054 11.932 1.885 15.738 5.443 3.01 2.818 5.096 6.605 6.313 11.385-4.163-.577-8.558-.867-13.13-.867-20.86 0-37.52 7.85-44.94 21.185-3.9 7.016-5.024 15.196-3.296 23.56 2.643 12.788 12.062 22.223 23.77 23.82 8.485 1.157 16.758-.77 23.287-5.424 5.426-3.867 9.614-9.46 12.43-16.613 2.838 4.906 6.428 8.695 10.755 11.348 7.023 4.303 15.787 6.313 26.068 5.983 18.328-.588 32.138-9.3 38.817-24.487 4.793-10.89 5.678-24.566 2.498-38.587-4.308-19.025-14.987-33.402-30.882-41.57-15.94-8.197-35.865-9.683-55.932-4.178l4.55 14.762c16.628-4.566 32.716-3.426 45.274 3.208 12.558 6.634 20.644 18.44 23.746 34.695 2.484 13.018 1.802 24.006-1.917 30.941-3.696 6.89-10.644 11.428-20.69 13.507-8.257 1.712-15.448.604-20.243-3.118-4.01-3.113-6.964-8.03-8.788-14.618a75.377 75.377 0 0 0 6.563-5.858c7.963-8.117 12.022-18.58 11.747-30.285-.276-11.692-4.756-21.93-12.615-28.828-7.86-6.897-18.443-10.678-29.798-10.678-11.355 0-21.938 3.78-29.798 10.678-7.859 6.898-12.34 17.136-12.615 28.828-.276 11.706 3.784 22.168 11.747 30.285 7.963 8.117 19.032 12.587 31.179 12.587 5.934 0 11.663-1.078 17.033-3.205a59.977 59.977 0 0 0 14.36-8.038 59.977 59.977 0 0 0 10.755-11.348z" />
            </svg>
         ),
         colorClass: 'hover:bg-black/10 hover:text-black dark:hover:bg-white/10 dark:hover:text-white', 
         action: () => handleShare('threads') 
      },
   ];

   return (
      <Dialog open={isOpen} onOpenChange={onClose}>
         <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-background/95 backdrop-blur-2xl border-border/50 shadow-2xl rounded-2xl">
            {/* Header Area */}
            <div className="px-6 pt-6 pb-4 text-center space-y-1">
               <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Share2 className="w-6 h-6 text-primary" />
               </div>
               <DialogTitle className="text-2xl font-semibold tracking-tight">
                  Share Your Pixel
               </DialogTitle>
               <DialogDescription className="text-sm text-muted-foreground">
                  Show off your digital real estate to the world
               </DialogDescription>
            </div>

            <div className="px-6 pb-6 space-y-6">
               {/* Premium Coordinates Card */}
               <div className="relative overflow-hidden group rounded-2xl p-5 bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex justify-between items-center relative z-10">
                     <div>
                        <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">
                           Your Coordinates
                        </p>
                        <div className="text-3xl font-black tracking-tighter text-foreground flex items-center gap-1">
                           <span className="text-muted-foreground/40 font-light">(</span>
                           {pixel.x}, {pixel.y}
                           <span className="text-muted-foreground/40 font-light">)</span>
                        </div>
                     </div>
                     <Button
                        variant="ghost"
                        size="icon"
                        className={`rounded-full h-10 w-10 transition-all ${showQr ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'bg-background/50 hover:bg-background shadow-sm'}`}
                        onClick={() => setShowQr(!showQr)}
                        title="Toggle QR Code"
                     >
                        <QrCode className="w-5 h-5" />
                     </Button>
                  </div>
                  
                  {/* Subtle background glow effect inside the card */}
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
               </div>

               {/* QR Code Reveal Section */}
               {showQr && (
                  <div className="flex flex-col items-center justify-center p-5 bg-card rounded-2xl border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                     <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 mb-4">
                        <img
                           src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(shareContent.url)}`}
                           alt="QR Code"
                           className="w-40 h-40 rounded-lg"
                        />
                     </div>
                     <Button variant="outline" className="w-full gap-2 rounded-xl h-10" onClick={handleDownloadQr}>
                        <Download className="w-4 h-4" /> Download QR Code
                     </Button>
                  </div>
               )}

               {/* Quick Share Grid */}
               <div className="space-y-3">
                  <div className="flex items-center gap-4">
                     <div className="h-px flex-1 bg-border" />
                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Share via</span>
                     <div className="h-px flex-1 bg-border" />
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                     {socialButtons.map((btn) => (
                        <button
                           key={btn.id}
                           onClick={btn.action}
                           className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-transparent hover:border-border bg-muted/30 hover:bg-card transition-all duration-200 text-muted-foreground ${btn.colorClass}`}
                           title={btn.name}
                        >
                           {btn.icon}
                           <span className="text-[10px] font-medium leading-none">{btn.name}</span>
                        </button>
                     ))}
                  </div>

                  {typeof navigator !== 'undefined' && navigator.share && (
                     <Button
                        variant="secondary"
                        className="w-full gap-2 rounded-xl h-11 bg-muted/50 hover:bg-muted"
                        onClick={handleNativeShare}
                     >
                        <Share2 className="w-4 h-4" />
                        More options...
                     </Button>
                  )}
               </div>

               {/* Direct Link */}
               <div className="space-y-2 pt-2">
                  <Label htmlFor="link" className="text-xs font-semibold text-foreground uppercase tracking-wider ml-1">
                     Direct Link
                  </Label>
                  <div className="flex items-center gap-2 p-1.5 bg-muted/40 border rounded-xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                     <Input
                        id="link"
                        value={shareContent.url}
                        readOnly
                        className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 font-mono text-xs px-3 text-muted-foreground"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                     />
                     <Button
                        size="sm"
                        className="shrink-0 h-9 px-4 rounded-lg gap-2"
                        onClick={handleCopyLink}
                     >
                        {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                        {copied ? "Copied" : "Copy"}
                     </Button>
                  </div>
               </div>
            </div>
         </DialogContent>
      </Dialog>
   );
};
