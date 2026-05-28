import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { DirectoryListingCard } from '@/components/DirectoryListingCard';
import { CreateListingDialog } from '@/components/CreateListingDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Plus,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Grid3X3,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────
export interface DirectoryListing {
  id: string;
  name: string;
  tagline: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  category: string;
  tags: string[];
  listing_tier: 'basic' | 'featured' | 'premium';
  is_featured: boolean;
  views_count: number;
  clicks_count: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Grid3X3 },
  { id: 'startup', label: 'Startups', icon: Rocket },
  { id: 'saas', label: 'SaaS', icon: Sparkles },
  { id: 'ai', label: 'AI / ML', icon: TrendingUp },
  { id: 'ecommerce', label: 'E-Commerce', icon: Grid3X3 },
  { id: 'fintech', label: 'Fintech', icon: TrendingUp },
  { id: 'gaming', label: 'Gaming', icon: Sparkles },
  { id: 'education', label: 'EdTech', icon: Rocket },
  { id: 'health', label: 'HealthTech', icon: Sparkles },
  { id: 'other', label: 'Other', icon: Grid3X3 },
];

const DirectoryPage = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<DirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch listings
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_directory_listings', {
        category_filter: selectedCategory === 'all' ? null : selectedCategory,
        search_query: debouncedSearch || null,
        page_num: 1,
        page_size: 50,
      });

      if (error) throw error;

      const result = data as unknown as {
        listings: DirectoryListing[];
        total_count: number;
      };

      setListings(result.listings || []);
      setTotalCount(result.total_count || 0);
    } catch (err) {
      console.error('Failed to load listings:', err);
      toast.error('Failed to load directory listings');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, debouncedSearch]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Split listings into featured and regular
  const { featured, regular } = useMemo(() => {
    const f = listings.filter((l) => l.listing_tier === 'premium' || l.is_featured);
    const r = listings.filter((l) => l.listing_tier !== 'premium' && !l.is_featured);
    return { featured: f, regular: r };
  }, [listings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-0">
      <SEO
        title="Startup Directory — BuyASpot"
        description="Discover innovative startups, SaaS products, and projects. List your startup on India's growing pixel marketplace directory."
        canonical="https://buyaspot.in/directory"
        image="https://buyaspot.in/og-image.jpg"
        imageAlt="BuyASpot Startup Directory"
      />
      <Header />

      <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Rocket className="w-3.5 h-3.5" />
            Startup Directory
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent mb-3">
            Discover & Showcase
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm md:text-base">
            A curated directory of startups, products, and projects from the BuyASpot community.
            List your startup to reach thousands of visitors.
          </p>
          <Button
            className="mt-6 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 rounded-xl shadow-lg shadow-purple-500/20 px-8 h-12"
            onClick={() => {
              if (!user) {
                toast.info('Please sign in to list your startup');
                return;
              }
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="w-5 h-5" />
            List Your Startup
          </Button>
        </div>

        {/* Search + Category Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search startups, products, ideas..."
              className="pl-10 h-11 rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-foreground text-background shadow-md'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 border border-transparent hover:border-border'
              }`}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{totalCount}</span>{' '}
            {totalCount === 1 ? 'listing' : 'listings'} found
          </p>
          {totalCount > 0 && (
            <Badge variant="outline" className="text-xs">
              <SlidersHorizontal className="w-3 h-3 mr-1" />
              Featured first
            </Badge>
          )}
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
          </div>
        )}

        {/* No Results */}
        {!loading && listings.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/30 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold mb-2">No listings yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search.`
                : 'Be the first to list your startup in this category!'}
            </p>
            <Button
              onClick={() => {
                if (!user) {
                  toast.info('Please sign in to list your startup');
                  return;
                }
                setCreateDialogOpen(true);
              }}
              className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 rounded-xl"
            >
              <Plus className="w-4 h-4" />
              List Your Startup
            </Button>
          </div>
        )}

        {/* Featured Listings */}
        {featured.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Featured
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featured.map((listing) => (
                <DirectoryListingCard key={listing.id} listing={listing} featured />
              ))}
            </div>
          </div>
        )}

        {/* Regular Listings */}
        {regular.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regular.map((listing) => (
              <DirectoryListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {/* Create Listing Dialog */}
      <CreateListingDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchListings();
        }}
      />

      <Footer />
    </div>
  );
};

export default DirectoryPage;
