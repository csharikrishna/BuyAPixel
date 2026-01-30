import { useEffect, useState, useCallback, useRef, useTransition, useMemo } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ScanLine,
  AlertCircle,
  QrCode,
  Share2,
  LogIn,
  History,
  Download,
  ExternalLink,
  Contact,
  Link as LinkIcon,
  Smartphone,
  Camera,
  Info,
  Trash2,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  generateVCard,
  downloadVCard,
  type VCardProfile,
} from '@/utils/vcardUtils';

// ======================
// TYPES & INTERFACES
// ======================

interface UserPixel {
  id: string;
  x: number;
  y: number;
  image_url?: string;
}

interface ScanHistoryItem {
  id: string;
  type: 'pixel' | 'profile' | 'external' | 'contact';
  value: string;
  label: string;
  timestamp: number;
}

type CameraPermissionState = 'prompt' | 'granted' | 'denied' | 'checking';

// ======================
// CONSTANTS
// ======================

const HISTORY_KEY = 'qr_scan_history';
const MAX_HISTORY_ITEMS = 20;
const SCAN_SUCCESS_DELAY = 500;
const SCANNER_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  rememberLastUsedCamera: true,
  aspectRatio: 1.0,
};

// ======================
// UTILITY FUNCTIONS
// ======================

const getQrCodeUrl = (data: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;

const formatTime = (ms: number): string => {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString();
};

// ======================
// MAIN COMPONENT
// ======================

const ScanPixel = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Refs
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // React 19 hooks
  const [isPending, startTransition] = useTransition();

  // State
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scan');
  const [userPixels, setUserPixels] = useState<UserPixel[]>([]);
  const [userProfile, setUserProfile] = useState<VCardProfile | null>(null);
  const [pixelsLoading, setPixelsLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showVCardQr, setShowVCardQr] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>('checking');
  const [isVisible, setIsVisible] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Trigger entrance animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Check camera permission [web:84]
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraPermission('denied');
          return;
        }

        // Check if permission is already granted
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermission(result.state as CameraPermissionState);

          result.addEventListener('change', () => {
            setCameraPermission(result.state as CameraPermissionState);
          });
        } else {
          setCameraPermission('prompt');
        }
      } catch (err) {
        console.error('Permission check error:', err);
        setCameraPermission('prompt');
      }
    };

    if (activeTab === 'scan') {
      checkCameraPermission();
    }
  }, [activeTab]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      try {
        setScanHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Fetch user data when "my-code" tab is active
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
              email: user.email || null,
            });
          }
        } catch (err) {
          console.error('Error fetching data:', err);
          toast.error('Failed to load your data');
        } finally {
          if (isMountedRef.current) {
            setPixelsLoading(false);
          }
        }
      };
      fetchData();
    }
  }, [activeTab, user?.id, user?.email]);

  // History management
  const addToHistory = useCallback((item: Omit<ScanHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: ScanHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    startTransition(() => {
      setScanHistory((prev) => {
        const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    });
  }, []);

  const clearHistory = useCallback(() => {
    if (confirm('Clear scan history?')) {
      setScanHistory([]);
      localStorage.removeItem(HISTORY_KEY);
      toast.success('History cleared');
    }
  }, []);

  // QR Scanner initialization [web:85]
  useEffect(() => {
    if (activeTab !== 'scan' || cameraPermission !== 'granted') {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
        setIsScanning(false);
      }
      return;
    }

    const processScan = (decodedText: string) => {
      try {
        // Check for VCard first [web:81]
        if (decodedText.startsWith('BEGIN:VCARD')) {
          toast.success('Contact Card Detected!', { icon: <Contact className="w-4 h-4" /> });
          const nameMatch = decodedText.match(/FN:(.*)/);
          const name = nameMatch ? nameMatch[1] : 'Contact';

          addToHistory({
            type: 'contact',
            value: decodedText,
            label: `${name} (Contact)`,
          });

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
          setError('Scanned code is not a valid URL or Contact Card');
          return;
        }

        // Check for Pixel URL
        const pixelParam = urlObj.searchParams.get('pixel');
        const isProfile = urlObj.pathname.includes('/profile');
        const profileId = urlObj.searchParams.get('id');

        if (pixelParam) {
          const [x, y] = pixelParam.split(',').map(Number);
          if (!isNaN(x) && !isNaN(y)) {
            toast.success(`Found Pixel at (${x}, ${y})!`);
            addToHistory({
              type: 'pixel',
              value: `/?pixel=${x},${y}`,
              label: `Pixel (${x}, ${y})`,
            });
            navigate(`/?pixel=${x},${y}`);
          } else {
            setError('Invalid pixel coordinates.');
          }
        } else if (isProfile) {
          toast.success('Found User Profile!');
          const targetUrl = profileId ? `/profile?id=${profileId}` : '/profile';
          addToHistory({
            type: 'profile',
            value: targetUrl,
            label: profileId ? 'User Profile' : 'My Profile',
          });
          navigate(targetUrl);
        } else if (urlObj.origin === window.location.origin) {
          addToHistory({
            type: 'external',
            value: urlObj.pathname + urlObj.search,
            label: 'BuyAPixel Page',
          });
          navigate(urlObj.pathname + urlObj.search);
        } else {
          addToHistory({
            type: 'external',
            value: decodedText,
            label: 'External Link',
          });
          window.location.href = decodedText;
        }
      } catch (err) {
        console.error('Scan processing error', err);
        setError('Could not process the scanned QR code.');
      }
    };

    const onScanSuccess = (decodedText: string) => {
      setScanResult(decodedText);
      setTimeout(() => {
        processScan(decodedText);
      }, SCAN_SUCCESS_DELAY);
    };

    const onScanFailure = () => {
      // Ignore frame failures
    };

    const initScanner = () => {
      const element = document.getElementById('reader');
      if (element) {
        const scanner = new Html5QrcodeScanner('reader', SCANNER_CONFIG, false);
        scannerRef.current = scanner;
        scanner.render(onScanSuccess, onScanFailure);
        setIsScanning(true);
      } else {
        timerRef.current = setTimeout(initScanner, 50);
      }
    };

    initScanner();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
        setIsScanning(false);
      }
    };
  }, [navigate, activeTab, cameraPermission, addToHistory]);

  // Share handler
  const handleShare = useCallback(async (title: string, text: string, url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        toast.success('Shared successfully!');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  }, []);

  // Download QR handler
  const handleDownloadQr = useCallback(async (data: string, filename: string) => {
    try {
      const qrUrl = getQrCodeUrl(data);
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
      toast.success('QR code saved to downloads');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download failed');
    }
  }, []);

  // History click handler
  const handleHistoryClick = useCallback(
    (item: ScanHistoryItem) => {
      if (item.type === 'contact') {
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
    },
    [navigate]
  );

  // Request camera permission [web:84][web:87]
  const requestCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermission('granted');
      toast.success('Camera access granted!');
    } catch (err) {
      console.error('Camera permission denied:', err);
      setCameraPermission('denied');
      toast.error('Camera access denied. Please check your browser settings.');
    }
  }, []);

  // Get profile QR data
  const getProfileQrData = useMemo(() => {
    if (!user?.id) return '';
    if (showVCardQr && userProfile) {
      return generateVCard(userProfile, user.id);
    }
    return `${window.location.origin}/profile?id=${user.id}`;
  }, [user?.id, showVCardQr, userProfile]);

  // Schema.org structured data
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'BuyAPixel QR Scanner',
      description: 'Scan QR codes to view pixels and profiles on BuyAPixel',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
    }),
    []
  );

  return (
    <>
      <Helmet>
        <title>QR Scanner - Scan Pixels & Profiles | BuyAPixel</title>
        <meta
          name="description"
          content="Scan QR codes to instantly view pixels on the BuyAPixel board. Share your profile and pixel QR codes with others."
        />
        <meta property="og:title" content="QR Scanner - BuyAPixel" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Scan and share QR codes for pixels and profiles" />
        <link rel="canonical" href="https://buyapixel.in/scan" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
        <Header />

        <main className="flex-1 flex flex-col items-center py-6 px-4">
          <div className="w-full max-w-md space-y-6">
            {/* Breadcrumbs */}
            <nav
              className="flex items-center gap-2 text-sm text-muted-foreground"
              aria-label="Breadcrumb"
            >
              <Link to="/" className="hover:text-primary transition-colors">
                Home
              </Link>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
              <span className="text-foreground font-medium">QR Scanner</span>
            </nav>

            {/* Header */}
            <div
              className={cn(
                'flex items-center justify-between transition-all duration-700',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-primary" aria-hidden="true" />
                QR Connect
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Information">
                      <Info className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Scan QR codes to view pixels and profiles. Share your own codes with others!
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className={cn(
                'w-full transition-all duration-700 delay-200',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <TabsList className="grid w-full grid-cols-2 mb-8" role="tablist">
                <TabsTrigger
                  value="scan"
                  className="flex items-center gap-2"
                  role="tab"
                  aria-controls="scan-panel"
                >
                  <ScanLine className="w-4 h-4" aria-hidden="true" />
                  Scan Code
                </TabsTrigger>
                <TabsTrigger
                  value="my-code"
                  className="flex items-center gap-2"
                  role="tab"
                  aria-controls="my-code-panel"
                >
                  <QrCode className="w-4 h-4" aria-hidden="true" />
                  My Code
                </TabsTrigger>
              </TabsList>

              {/* Scan Tab */}
              <TabsContent
                value="scan"
                className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
                id="scan-panel"
                role="tabpanel"
              >
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground text-sm">
                    Point your camera at a BuyAPixel QR code to instantly visit that pixel on the
                    board. [web:81][web:82]
                  </p>
                </div>

                {/* Camera Permission UI [web:84] */}
                {cameraPermission === 'checking' && (
                  <Card className="border-primary/20">
                    <CardContent className="p-8 text-center space-y-4">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Checking camera permissions...
                      </p>
                    </CardContent>
                  </Card>
                )}

                {cameraPermission === 'prompt' && (
                  <Card className="border-primary/20">
                    <CardContent className="p-8 text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                        <Camera className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Camera Access Needed</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          We need camera access to scan QR codes. Your camera is never recorded.
                        </p>
                        <Button onClick={requestCameraPermission} className="gap-2">
                          <Camera className="w-4 h-4" />
                          Allow Camera Access
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {cameraPermission === 'denied' && (
                  <Card className="border-destructive/20">
                    <CardContent className="p-8 text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2 text-destructive">
                          Camera Access Denied
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Please enable camera access in your browser settings to scan QR codes.
                        </p>
                        <Button
                          variant="outline"
                          onClick={requestCameraPermission}
                          className="gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          Try Again
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Scanner Container */}
                {cameraPermission === 'granted' && (
                  <div
                    className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-muted/30 shadow-inner min-h-[300px] flex items-center justify-center"
                    role="region"
                    aria-label="QR code scanner"
                  >
                    <div id="reader" className="w-full" />
                    {scanResult && (
                      <div
                        className="absolute inset-0 bg-green-500/20 z-10 animate-pulse flex items-center justify-center"
                        role="status"
                        aria-live="polite"
                      >
                        <div className="bg-background/90 p-4 rounded-full shadow-lg">
                          <CheckCircle2 className="w-8 h-8 text-green-600" aria-hidden="true" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div
                    className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-start gap-3"
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">Scan Error</p>
                      <p className="text-xs opacity-90">{error}</p>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-destructive underline text-xs mt-2"
                        onClick={() => {
                          setError(null);
                          setScanResult(null);
                        }}
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
                      <History className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      Recent Scans
                    </h3>
                    {scanHistory.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-red-500"
                        onClick={clearHistory}
                        disabled={isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>

                  {scanHistory.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                      No recent scans
                    </div>
                  ) : (
                    <div className="space-y-2" role="list" aria-label="Scan history">
                      {scanHistory.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleHistoryClick(item)}
                          className="flex items-center gap-3 p-3 bg-card border rounded-lg shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:border-primary/20"
                          role="listitem"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {item.type === 'pixel' ? (
                              <ScanLine className="w-4 h-4 text-primary" aria-hidden="true" />
                            ) : item.type === 'profile' ? (
                              <QrCode className="w-4 h-4 text-primary" aria-hidden="true" />
                            ) : item.type === 'contact' ? (
                              <Contact className="w-4 h-4 text-primary" aria-hidden="true" />
                            ) : (
                              <ExternalLink className="w-4 h-4 text-primary" aria-hidden="true" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.label}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.value.startsWith('BEGIN:VCARD') ? 'Contact Card' : item.value}
                            </p>
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

              {/* My Code Tab */}
              <TabsContent
                value="my-code"
                className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
                id="my-code-panel"
                role="tabpanel"
              >
                {!isAuthenticated ? (
                  <div className="text-center space-y-6 py-8">
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border inline-block">
                      <img
                        src={getQrCodeUrl(window.location.origin)}
                        alt="BuyAPixel App QR Code"
                        className="w-48 h-48 rounded-lg"
                      />
                      <p className="mt-4 text-sm font-medium">BuyAPixel</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full gap-2"
                        onClick={() =>
                          handleDownloadQr(window.location.origin, 'buyapixel-app.png')
                        }
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
                        <div
                          className="flex items-center gap-2 mb-2 p-1 bg-muted rounded-full"
                          role="tablist"
                          aria-label="QR code type"
                        >
                          <button
                            className={cn(
                              'cursor-pointer px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5',
                              !showVCardQr
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground/80'
                            )}
                            onClick={() => setShowVCardQr(false)}
                            role="tab"
                            aria-selected={!showVCardQr}
                          >
                            <LinkIcon className="w-3 h-3" aria-hidden="true" />
                            Link
                          </button>
                          <button
                            className={cn(
                              'cursor-pointer px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5',
                              showVCardQr
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground/80'
                            )}
                            onClick={() => setShowVCardQr(true)}
                            role="tab"
                            aria-selected={showVCardQr}
                          >
                            <Contact className="w-3 h-3" aria-hidden="true" />
                            Contact
                          </button>
                        </div>

                        <div className="p-4 bg-white rounded-xl border shadow-sm relative group transition-all duration-300">
                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl pointer-events-none">
                            <Download className="w-8 h-8 text-black/50" />
                          </div>
                          <img
                            src={getQrCodeUrl(getProfileQrData)}
                            alt={showVCardQr ? 'My Business Card QR' : 'My Profile QR'}
                            className="w-40 h-40 cursor-pointer"
                            onClick={() =>
                              handleDownloadQr(
                                getProfileQrData,
                                showVCardQr ? 'my-contact.png' : 'my-profile-qr.png'
                              )
                            }
                            title="Click to Download"
                          />
                        </div>

                        <div>
                          <h3 className="font-semibold flex items-center justify-center gap-2">
                            {showVCardQr ? 'My Business Card' : 'My Profile QR'}
                            <Badge variant="secondary" className="text-[10px] h-5">
                              Public
                            </Badge>
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {showVCardQr
                              ? 'Scan to add me to contacts instantly'
                              : 'Scan to view my profile & pixels'}
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
                            onClick={() =>
                              handleDownloadQr(
                                getProfileQrData,
                                showVCardQr ? 'my-contact.png' : 'my-profile-qr.png'
                              )
                            }
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
                                const vcard = getProfileQrData;
                                downloadVCard(
                                  vcard,
                                  `${userProfile?.full_name?.replace(/\s+/g, '_') || 'contact'}.vcf`
                                );
                              } else {
                                handleShare(
                                  'My BuyAPixel Profile',
                                  'Check out my profile on BuyAPixel!',
                                  `${window.location.origin}/profile?id=${user?.id}`
                                );
                              }
                            }}
                          >
                            {showVCardQr ? (
                              <Contact className="w-4 h-4" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                            {showVCardQr ? 'Get VCard' : 'Share'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* My Pixels */}
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-primary" aria-hidden="true" />
                        My Pixels
                      </h3>

                      {pixelsLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading pixels...
                        </div>
                      ) : userPixels.length > 0 ? (
                        <div className="grid gap-3" role="list" aria-label="My pixels">
                          {userPixels.map((pixel) => (
                            <Card
                              key={pixel.id}
                              className="overflow-hidden group hover:border-primary/30 transition-colors"
                              role="listitem"
                            >
                              <div className="flex items-center p-3 gap-3">
                                <div className="bg-white p-2 rounded-lg border shrink-0">
                                  <img
                                    src={getQrCodeUrl(
                                      `${window.location.origin}/?pixel=${pixel.x},${pixel.y}`
                                    )}
                                    alt={`QR code for Pixel ${pixel.x},${pixel.y}`}
                                    className="w-14 h-14"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium truncate text-sm">
                                    Pixel ({pixel.x}, {pixel.y})
                                  </h4>
                                  <p className="text-xs text-muted-foreground truncate mb-2">
                                    Owned by you
                                  </p>
                                  <div className="flex gap-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() =>
                                              handleDownloadQr(
                                                `${window.location.origin}/?pixel=${pixel.x},${pixel.y}`,
                                                `pixel-${pixel.x}-${pixel.y}.png`
                                              )
                                            }
                                            aria-label="Download QR code"
                                          >
                                            <Download className="w-3 h-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Download QR code</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs px-2"
                                      onClick={() =>
                                        handleShare(
                                          `My Pixel (${pixel.x},${pixel.y})`,
                                          `Check out my pixel at (${pixel.x},${pixel.y}) on BuyAPixel!`,
                                          `${window.location.origin}/?pixel=${pixel.x},${pixel.y}`
                                        )
                                      }
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
                          <Button variant="link" onClick={() => navigate('/')}>
                            Buy one now!
                          </Button>
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
    </>
  );
};

export default ScanPixel;
