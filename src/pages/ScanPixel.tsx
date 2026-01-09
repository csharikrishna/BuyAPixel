import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, ScanLine, AlertCircle, QrCode, Share2, LogIn, History, Download, Trash2, ExternalLink, Contact, Link as LinkIcon, Smartphone, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface UserPixel {
   id: string;
   x: number;
   y: number;
   image_url?: string;
}

interface UserProfile {
   full_name: string | null;
   phone_number: string | null;
   email: string | null;
}

interface ScanHistoryItem {
   id: string;
   type: 'pixel' | 'profile' | 'external' | 'contact';
   value: string; // The URL or coordinates or VCard string
   label: string;
   timestamp: number;
}

const ScanPixel = () => {
   const navigate = useNavigate();
   const { user, isAuthenticated } = useAuth();
   const [scanResult, setScanResult] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [activeTab, setActiveTab] = useState("scan");
   const [userPixels, setUserPixels] = useState<UserPixel[]>([]);
   const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
   const [pixelsLoading, setPixelsLoading] = useState(false);
   const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
   const [isScanning, setIsScanning] = useState(false);
   const [showVCardQr, setShowVCardQr] = useState(false);

   // We use a ref to prevent double initialization in React Strict Mode
   const scannerRef = useRef<Html5QrcodeScanner | null>(null);

   // Load history from local storage on mount
   useEffect(() => {
      const savedHistory = localStorage.getItem('qr_scan_history');
      if (savedHistory) {
         try {
            setScanHistory(JSON.parse(savedHistory));
         } catch (e) {
            console.error("Failed to parse history", e);
         }
      }
   }, []);

   const addToHistory = (item: Omit<ScanHistoryItem, 'id' | 'timestamp'>) => {
      const newItem: ScanHistoryItem = {
         ...item,
         id: crypto.randomUUID(),
         timestamp: Date.now()
      };

      setScanHistory(prev => {
         const updated = [newItem, ...prev].slice(0, 20); // Keep last 20
         localStorage.setItem('qr_scan_history', JSON.stringify(updated));
         return updated;
      });
   };

   const clearHistory = () => {
      if (confirm("Clear scan history?")) {
         setScanHistory([]);
         localStorage.removeItem('qr_scan_history');
         toast.success("History cleared");
      }
   };

   const formatTime = (ms: number) => {
      const diff = Date.now() - ms;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(ms).toLocaleDateString();
   };

   const generateVCard = (profile: UserProfile, userId: string): string => {
      const vcard = [
         'BEGIN:VCARD',
         'VERSION:3.0',
         `FN:${profile.full_name || 'BuyAPixel User'}`,
         profile.email ? `EMAIL;TYPE=INTERNET:${profile.email}` : '',
         profile.phone_number ? `TEL;TYPE=CELL:${profile.phone_number}` : '',
         `URL:${window.location.origin}/profile?id=${userId}`,
         'NOTE:Scanned via BuyAPixel',
         'END:VCARD'
      ].filter(Boolean).join('\n');
      return vcard;
   };

   const downloadVCard = (vcardString: string, filename: string = 'contact.vcf') => {
      const blob = new Blob([vcardString], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Contact saved to downloads");
   };

   // Fetch user pixels and profile when "my-code" tab is active
   useEffect(() => {
      if (activeTab === 'my-code' && user?.id) {
         const fetchData = async () => {
            setPixelsLoading(true);
            try {
               // Fetch Pixels
               const { data: pixels, error: pixelError } = await supabase
                  .from('pixels')
                  .select('id, x, y, image_url')
                  .eq('owner_id', user.id);

               if (pixelError) throw pixelError;
               setUserPixels(pixels || []);

               // Fetch Profile for VCard
               const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('full_name, phone_number')
                  .eq('user_id', user.id)
                  .maybeSingle();

               if (profileData) {
                  setUserProfile({
                     full_name: profileData.full_name,
                     phone_number: profileData.phone_number,
                     email: user.email || null
                  });
               }

            } catch (err) {
               console.error("Error fetching data:", err);
               toast.error("Failed to load your data");
            } finally {
               setPixelsLoading(false);
            }
         };
         fetchData();
      }
   }, [activeTab, user?.id, user?.email]);

   useEffect(() => {
      // Only initialize scanner if tab is 'scan'
      if (activeTab !== 'scan') {
         if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
            setIsScanning(false);
         }
         return;
      }

      const onScanSuccess = (decodedText: string) => {
         // Visual feedback delay
         setScanResult(decodedText);

         setTimeout(() => {
            processScan(decodedText);
         }, 500); // 500ms delay for visual confirmation
      };

      const processScan = (decodedText: string) => {
         try {
            // Check for VCard first
            if (decodedText.startsWith('BEGIN:VCARD')) {
               toast.success("Contact Card Detected!", { icon: <Contact className="w-4 h-4" /> });
               const nameMatch = decodedText.match(/FN:(.*)/);
               const name = nameMatch ? nameMatch[1] : 'Contact';

               addToHistory({
                  type: 'contact',
                  value: decodedText,
                  label: `${name} (Contact)`
               });

               // Offer download
               if (confirm(`Found contact card for "${name}". Download?`)) {
                  downloadVCard(decodedText, `${name.replace(/\s+/g, '_')}.vcf`);
               }
               return;
            }

            let urlObj;
            try {
               if (decodedText.startsWith('http')) {
                  urlObj = new URL(decodedText);
               } else {
                  urlObj = new URL(decodedText, window.location.origin);
               }
            } catch {
               // Not a valid URL and not VCard
               setError("Scanned code is not a valid URL or Contact Card");
               return;
            }

            // Check for Pixel URL
            const pixelParam = urlObj.searchParams.get('pixel');
            // Check for Profile URL (e.g. /profile?id=xyz)
            const isProfile = urlObj.pathname.includes('/profile');
            const profileId = urlObj.searchParams.get('id');

            if (pixelParam) {
               const [x, y] = pixelParam.split(',').map(Number);
               if (!isNaN(x) && !isNaN(y)) {
                  toast.success(`Found Pixel at (${x}, ${y})!`);
                  addToHistory({
                     type: 'pixel',
                     value: `/?pixel=${x},${y}`,
                     label: `Pixel (${x}, ${y})`
                  });

                  navigate(`/?pixel=${x},${y}`);
               } else {
                  setError("Invalid pixel coordinates.");
               }
            } else if (isProfile) {
               toast.success("Found User Profile!");
               const targetUrl = profileId ? `/profile?id=${profileId}` : '/profile';
               addToHistory({
                  type: 'profile',
                  value: targetUrl,
                  label: profileId ? 'User Profile' : 'My Profile'
               });
               navigate(targetUrl);
            } else if (urlObj.origin === window.location.origin) {
               // Internal link
               addToHistory({
                  type: 'external',
                  value: urlObj.pathname + urlObj.search,
                  label: 'BuyAPixel Page'
               });
               navigate(urlObj.pathname + urlObj.search);
            } else {
               // External link logic
               addToHistory({
                  type: 'external',
                  value: decodedText,
                  label: 'External Link'
               });
               window.location.href = decodedText;
            }
         } catch (err) {
            console.error("Scan processing error", err);
            setError("Could not process the Scanned QR code.");
         }
      };

      const onScanFailure = (err: any) => {
         // console.warn(err); // Ignore frame failures
      };

      const config = {
         fps: 10,
         qrbox: { width: 250, height: 250 },
         formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
         rememberLastUsedCamera: true
      };

      // Robust polling for the element to ensure it exists before initializing
      const timerRef = useRef<NodeJS.Timeout>();

      const initScanner = () => {
         const element = document.getElementById("reader");
         if (element) {
            const scanner = new Html5QrcodeScanner("reader", config, /* verbose= */ false);
            scannerRef.current = scanner;
            scanner.render(onScanSuccess, onScanFailure);
            setIsScanning(true);
         } else {
            // If element doesn't exist yet, retry in 50ms
            timerRef.current = setTimeout(initScanner, 50);
         }
      };

      // Start initialization process
      initScanner();

      return () => {
         if (timerRef.current) clearTimeout(timerRef.current);
         if (scannerRef.current) {
            scannerRef.current.clear().catch((error) => {
               console.error("Failed to clear html5-qrcode scanner. ", error);
            });
            scannerRef.current = null;
            setIsScanning(false);
         }
      };
   }, [navigate, activeTab]);

   const handleShare = async (title: string, text: string, url: string) => {
      if (navigator.share) {
         try {
            await navigator.share({ title, text, url });
            toast.success('Shared successfully!');
         } catch (err) {
            console.error('Share failed:', err);
         }
      } else {
         navigator.clipboard.writeText(url);
         toast.success('Link copied to clipboard');
      }
   };

   const handleDownloadQr = async (data: string, filename: string) => {
      try {
         const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
         const response = await fetch(qrUrl);
         const blob = await response.blob();
         const blobUrl = window.URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = blobUrl;
         link.download = filename;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         window.URL.revokeObjectURL(blobUrl);
         toast.success("QR saved to downloads");
      } catch (err) {
         toast.error("Download failed");
      }
   };

   const handleHistoryClick = (item: ScanHistoryItem) => {
      if (item.type === 'contact') {
         // Re-download contact
         const nameMatch = item.value.match(/FN:(.*)/);
         const name = nameMatch ? nameMatch[1] : 'Contact';
         if (confirm(`Download contact "${name}" again?`)) {
            downloadVCard(item.value, `${name.replace(/\s+/g, '_')}.vcf`);
         }
      } else if (item.value.startsWith('http')) {
         window.location.href = item.value;
      } else {
         navigate(item.value);
      }
   };

   const getProfileQrData = () => {
      if (!user?.id) return '';
      if (showVCardQr && userProfile) {
         return generateVCard(userProfile, user.id);
      }
      return `${window.location.origin}/profile?id=${user.id}`;
   };

   return (
      <div className="min-h-screen bg-background flex flex-col">
         <Header />
         <main className="flex-1 flex flex-col items-center py-6 px-4">
            <div className="w-full max-w-md space-y-6">
               {/* Header */}
               <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                     <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <h1 className="text-xl font-bold flex items-center gap-2">
                     <ScanLine className="w-5 h-5 text-primary" />
                     QR Connect
                  </h1>
                  <div className="w-9" />
               </div>

               <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-8">
                     <TabsTrigger value="scan" className="flex items-center gap-2">
                        <ScanLine className="w-4 h-4" />
                        Scan Code
                     </TabsTrigger>
                     <TabsTrigger value="my-code" className="flex items-center gap-2">
                        <QrCode className="w-4 h-4" />
                        My Code
                     </TabsTrigger>
                  </TabsList>

                  <TabsContent value="scan" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="text-center space-y-2">
                        <p className="text-muted-foreground">
                           Point your camera at a BuyAPixel QR code to instantly visit that pixel on the board.
                        </p>
                     </div>

                     {/* Scanner Container */}
                     <div className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-muted/30 shadow-inner min-h-[300px] flex items-center justify-center">
                        <div id="reader" className="w-full" />
                        {/* Visual Pulse when detected */}
                        {scanResult && (
                           <div className="absolute inset-0 bg-green-500/20 z-10 animate-pulse flex items-center justify-center">
                              <div className="bg-background/90 p-4 rounded-full shadow-lg">
                                 <QrCode className="w-8 h-8 text-green-600" />
                              </div>
                           </div>
                        )}
                     </div>

                     {/* Error Display */}
                     {error && (
                        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-start gap-3">
                           <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                           <div className="space-y-1">
                              <p className="font-semibold text-sm">Scan Error</p>
                              <p className="text-xs opacity-90">{error}</p>
                              <Button
                                 variant="link"
                                 className="h-auto p-0 text-destructive underline text-xs mt-2"
                                 onClick={() => { setError(null); setScanResult(null); }}
                              >
                                 Try Again
                              </Button>
                           </div>
                        </div>
                     )}

                     {/* Recent History */}
                     <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between px-1">
                           <h3 className="font-semibold text-sm flex items-center gap-2">
                              <History className="w-4 h-4 text-muted-foreground" />
                              Recent Scans
                           </h3>
                           {scanHistory.length > 0 && (
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-red-500" onClick={clearHistory}>
                                 Clear
                              </Button>
                           )}
                        </div>

                        {scanHistory.length === 0 ? (
                           <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                              No recent scans
                           </div>
                        ) : (
                           <div className="space-y-2">
                              {scanHistory.slice(0, 3).map((item) => (
                                 <div
                                    key={item.id}
                                    onClick={() => handleHistoryClick(item)}
                                    className="flex items-center gap-3 p-3 bg-card border rounded-lg shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-primary/20"
                                 >
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                       {item.type === 'pixel' ? (
                                          <ScanLine className="w-4 h-4 text-primary" />
                                       ) : item.type === 'profile' ? (
                                          <QrCode className="w-4 h-4 text-primary" />
                                       ) : item.type === 'contact' ? (
                                          <Contact className="w-4 h-4 text-primary" />
                                       ) : (
                                          <ExternalLink className="w-4 h-4 text-primary" />
                                       )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <p className="font-medium text-sm truncate">{item.label}</p>
                                       <p className="text-xs text-muted-foreground truncate">{item.value.startsWith('BEGIN:VCARD') ? 'Contact Card' : item.value}</p>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                       {formatTime(item.timestamp)}
                                    </span>
                                 </div>
                              ))}
                              {scanHistory.length > 3 && (
                                 <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                                    View {scanHistory.length - 3} more...
                                 </Button>
                              )}
                           </div>
                        )}
                     </div>
                  </TabsContent>

                  <TabsContent value="my-code" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     {!isAuthenticated ? (
                        <div className="text-center space-y-6 py-8">
                           <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border inline-block">
                              <img
                                 src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin)}`}
                                 alt="BuyAPixel App QR"
                                 className="w-48 h-48 rounded-lg"
                              />
                              <p className="mt-4 text-sm font-medium">BuyAPixel</p>
                              <Button
                                 variant="outline" size="sm" className="mt-2 w-full gap-2"
                                 onClick={() => handleDownloadQr(window.location.origin, 'buyapixel-app.png')}
                              >
                                 <Download className="w-3 h-3" /> Save
                              </Button>
                           </div>
                           <div className="space-y-4">
                              <p className="text-muted-foreground max-w-xs mx-auto">
                                 Sign in to view and share your own Profile and Pixel QR codes.
                              </p>
                              <Button onClick={() => navigate('/signin')} className="gap-2">
                                 <LogIn className="w-4 h-4" />
                                 Sign In
                              </Button>
                           </div>
                        </div>
                     ) : (
                        <div className="space-y-8">
                           {/* Profile QR */}
                           <Card className="overflow-hidden border-purple-500/20 shadow-md">
                              <div className="bg-gradient-to-r from-purple-600/10 to-blue-600/10 p-1" />
                              <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                                 {/* Toggle for VCard */}
                                 <div className="flex items-center gap-2 mb-2 p-1 bg-muted rounded-full">
                                    <div
                                       className={`cursor-pointer px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${!showVCardQr ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                                       onClick={() => setShowVCardQr(false)}
                                    >
                                       <LinkIcon className="w-3 h-3" />
                                       Link
                                    </div>
                                    <div
                                       className={`cursor-pointer px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${showVCardQr ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                                       onClick={() => setShowVCardQr(true)}
                                    >
                                       <Contact className="w-3 h-3" />
                                       Contact
                                    </div>
                                 </div>

                                 <div className="p-4 bg-white rounded-xl border shadow-sm relative group transition-all duration-300">
                                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl pointer-events-none">
                                       <Download className="w-8 h-8 text-black/50" />
                                    </div>
                                    <img
                                       src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getProfileQrData())}`}
                                       alt="My Profile QR"
                                       className="w-40 h-40 cursor-pointer"
                                       onClick={() => handleDownloadQr(getProfileQrData(), showVCardQr ? 'my-contact.png' : 'my-profile-qr.png')}
                                       title="Click to Download"
                                    />
                                 </div>
                                 <div>
                                    <h3 className="font-semibold flex items-center justify-center gap-2">
                                       {showVCardQr ? 'My Business Card' : 'My Profile QR'}
                                       <Badge variant="secondary" className="text-[10px] h-5">Public</Badge>
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                       {showVCardQr ? 'Scan to add me to contacts instantly' : 'Scan to view my profile & pixels'}
                                    </p>
                                 </div>

                                 {showVCardQr && (
                                    <div className="flex gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                                       <Smartphone className="w-3 h-3" />
                                       <span>Scan with phone camera to add contact</span>
                                    </div>
                                 )}

                                 <div className="flex gap-2 w-full">
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       className="gap-2 flex-1"
                                       onClick={() => handleDownloadQr(getProfileQrData(), showVCardQr ? 'my-contact.png' : 'my-profile-qr.png')}
                                    >
                                       <Download className="w-4 h-4" />
                                       Save QR
                                    </Button>
                                    <Button
                                       variant="default"
                                       size="sm"
                                       className="gap-2 flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
                                       onClick={() => {
                                          if (showVCardQr) {
                                             const vcard = getProfileQrData();
                                             downloadVCard(vcard, `${userProfile?.full_name?.replace(/\s+/g, '_') || 'contact'}.vcf`);
                                          } else {
                                             handleShare('My BuyAPixel Profile', 'Check out my profile on BuyAPixel!', `${window.location.origin}/profile?id=${user?.id}`);
                                          }
                                       }}
                                    >
                                       {showVCardQr ? <Contact className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                                       {showVCardQr ? 'Get VCard' : 'Share'}
                                    </Button>
                                 </div>
                              </CardContent>
                           </Card>

                           {/* My Pixels */}
                           <div className="space-y-3">
                              <h3 className="font-semibold flex items-center gap-2">
                                 <QrCode className="w-4 h-4 text-primary" />
                                 My Pixels
                              </h3>

                              {pixelsLoading ? (
                                 <div className="text-center py-8 text-muted-foreground">Loading pixels...</div>
                              ) : userPixels.length > 0 ? (
                                 <div className="grid gap-3">
                                    {userPixels.map(pixel => (
                                       <Card key={pixel.id} className="overflow-hidden group hover:border-primary/30 transition-colors">
                                          <div className="flex items-center p-3 gap-3">
                                             <div className="bg-white p-2 rounded-lg border shrink-0">
                                                <img
                                                   src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${window.location.origin}/?pixel=${pixel.x},${pixel.y}`)}`}
                                                   alt={`Pixel ${pixel.x},${pixel.y}`}
                                                   className="w-14 h-14"
                                                />
                                             </div>
                                             <div className="flex-1 min-w-0">
                                                <h4 className="font-medium truncate text-sm">Pixel ({pixel.x}, {pixel.y})</h4>
                                                <p className="text-xs text-muted-foreground truncate mb-2">
                                                   Owned by you
                                                </p>
                                                <div className="flex gap-2">
                                                   <Button
                                                      variant="secondary"
                                                      size="icon"
                                                      className="h-7 w-7"
                                                      onClick={() => handleDownloadQr(`${window.location.origin}/?pixel=${pixel.x},${pixel.y}`, `pixel-${pixel.x}-${pixel.y}.png`)}
                                                   >
                                                      <Download className="w-3 h-3" />
                                                   </Button>
                                                   <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-7 text-xs px-2"
                                                      onClick={() => handleShare(`My Pixel (${pixel.x},${pixel.y})`, `Check out my pixel at (${pixel.x},${pixel.y}) on BuyAPixel!`, `${window.location.origin}/?pixel=${pixel.x},${pixel.y}`)}
                                                   >
                                                      <Share2 className="w-3 h-3 mr-1" />
                                                      Share
                                                   </Button>
                                                </div>
                                             </div>
                                          </div>
                                       </Card>
                                    ))}
                                 </div>
                              ) : (
                                 <div className="text-center py-8 text-muted-foreground border rounded-xl border-dashed">
                                    <p>You don't own any pixels yet.</p>
                                    <Button variant="link" onClick={() => navigate('/')}>Buy one now!</Button>
                                 </div>
                              )}
                           </div>
                        </div>
                     )}
                  </TabsContent>
               </Tabs>
            </div>
         </main>
         <Footer />
      </div>
   );
};

export default ScanPixel;
