import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  Sparkles,
  Zap,
  Globe,
  Twitter,
  Linkedin,
  Github,
  Rocket,
  Upload,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ImageUpload } from '@/components/ImageUpload';

interface CreateListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'tier' | 'details' | 'payment' | 'success';

const TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 199,
    icon: Zap,
    color: 'emerald',
    features: ['Card in directory', 'Name + tagline + link', 'Category listing'],
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
  },
  {
    id: 'featured',
    name: 'Featured',
    price: 499,
    icon: Sparkles,
    color: 'violet',
    features: [
      'Highlighted card',
      'Larger image + description',
      'Social links',
      '"Featured" badge',
    ],
    borderClass: 'border-violet-200 dark:border-violet-800',
    bgClass: 'bg-violet-50 dark:bg-violet-950/20',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 999,
    icon: Crown,
    color: 'amber',
    features: [
      'All Featured benefits',
      'Pinned to top for 30 days',
      'Rich blog-style description',
      'Cover image',
      'Priority support',
    ],
    borderClass: 'border-amber-200 dark:border-amber-800',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
  },
];

const CATEGORIES = [
  'startup', 'saas', 'ai', 'ecommerce', 'fintech',
  'gaming', 'education', 'health', 'other',
];

export const CreateListingDialog = ({
  isOpen,
  onClose,
  onSuccess,
}: CreateListingDialogProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('tier');
  const [selectedTier, setSelectedTier] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [category, setCategory] = useState('startup');
  const [tags, setTags] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const selectedTierData = TIERS.find((t) => t.id === selectedTier) || TIERS[0];

  const resetForm = useCallback(() => {
    setStep('tier');
    setSelectedTier('basic');
    setName('');
    setTagline('');
    setDescription('');
    setWebsiteUrl('');
    setTwitterUrl('');
    setLinkedinUrl('');
    setGithubUrl('');
    setCategory('startup');
    setTags('');
    setLogoUrl(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in');
      return;
    }

    if (!name.trim() || !tagline.trim()) {
      toast.error('Name and tagline are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5);

      const { error } = await supabase.from('directory_listings').insert({
        user_id: user.id,
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim() || null,
        website_url: websiteUrl.trim() || null,
        twitter_url: twitterUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        category,
        tags: tagsArray,
        listing_tier: selectedTier,
        logo_url: logoUrl,
        amount_paid: selectedTierData.price,
        status: 'active', // Direct activation for now; will wire to Razorpay later
      });

      if (error) throw error;

      setStep('success');
      toast.success('Your listing is live! 🚀');

      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 2000);
    } catch (err: unknown) {
      console.error('Listing creation failed:', err);
      toast.error('Failed to create listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden bg-background/95 backdrop-blur-2xl border-border/50 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 text-center space-y-1">
          <div className="mx-auto w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
            <Rocket className="w-6 h-6 text-purple-600" />
          </div>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            {step === 'tier' && 'Choose Your Plan'}
            {step === 'details' && 'Startup Details'}
            {step === 'success' && 'You\'re Live! 🚀'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === 'tier' && 'Select a tier that fits your needs'}
            {step === 'details' && 'Tell the world about your startup'}
            {step === 'success' && 'Your listing has been published to the directory'}
          </DialogDescription>
        </div>

        <div className="px-6 pb-6">
          {/* Step 1: Tier Selection */}
          {step === 'tier' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedTier === tier.id
                      ? `${tier.borderClass} ${tier.bgClass} shadow-lg scale-[1.02]`
                      : 'border-border hover:border-border/80 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <tier.icon className={`w-5 h-5 text-${tier.color}-500`} />
                      <span className="font-bold text-base">{tier.name}</span>
                      {tier.popular && (
                        <Badge className="text-[10px] bg-violet-500 text-white border-0">Popular</Badge>
                      )}
                    </div>
                    <span className="text-lg font-black">₹{tier.price}</span>
                  </div>
                  <ul className="space-y-1">
                    {tier.features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className={`w-3 h-3 text-${tier.color}-500 shrink-0`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}

              <Button
                className="w-full h-12 rounded-xl gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg"
                onClick={() => setStep('details')}
              >
                Continue with {selectedTierData.name} · ₹{selectedTierData.price}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 'details' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Tier Badge */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <selectedTierData.icon className={`w-4 h-4 text-${selectedTierData.color}-500`} />
                <span className="text-sm font-semibold">
                  {selectedTierData.name} Listing · ₹{selectedTierData.price}
                </span>
                <button
                  className="ml-auto text-xs text-primary hover:underline"
                  onClick={() => setStep('tier')}
                >
                  Change
                </button>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="listing-name" className="text-xs font-bold uppercase tracking-wider">
                  Startup Name *
                </Label>
                <Input
                  id="listing-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., PixelPay"
                  maxLength={100}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Tagline */}
              <div className="space-y-2">
                <Label htmlFor="listing-tagline" className="text-xs font-bold uppercase tracking-wider">
                  Tagline *
                </Label>
                <Input
                  id="listing-tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="One-liner that describes your startup"
                  maxLength={200}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Description (Featured/Premium) */}
              {selectedTier !== 'basic' && (
                <div className="space-y-2">
                  <Label htmlFor="listing-desc" className="text-xs font-bold uppercase tracking-wider">
                    Description
                  </Label>
                  <Textarea
                    id="listing-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell the community about your startup, what problem you solve, and why it matters..."
                    rows={4}
                    maxLength={2000}
                    className="rounded-xl resize-none"
                  />
                </div>
              )}

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Logo</Label>
                <ImageUpload
                  onImageUploaded={(url) => setLogoUrl(url)}
                  currentImage={logoUrl}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="listing-tags" className="text-xs font-bold uppercase tracking-wider">
                  Tags (comma separated)
                </Label>
                <Input
                  id="listing-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., payments, india, b2b"
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Links */}
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider">Links</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="Website URL"
                      className="pl-9 h-10 rounded-xl text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={twitterUrl}
                      onChange={(e) => setTwitterUrl(e.target.value)}
                      placeholder="Twitter URL"
                      className="pl-9 h-10 rounded-xl text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="LinkedIn URL"
                      className="pl-9 h-10 rounded-xl text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="GitHub URL"
                      className="pl-9 h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl gap-2"
                  onClick={() => setStep('tier')}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !name.trim() || !tagline.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Publish · ₹{selectedTierData.price}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Your Startup is Live!</h3>
              <p className="text-sm text-muted-foreground">
                Your listing is now visible to thousands of BuyASpot visitors.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
