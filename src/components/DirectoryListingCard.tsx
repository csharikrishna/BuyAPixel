import { ExternalLink, Eye, Twitter, Linkedin, Github, Crown, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { DirectoryListing } from '@/pages/DirectoryPage';
import { appendUtmParams } from '@/utils/utmUtils';

interface DirectoryListingCardProps {
  listing: DirectoryListing;
  featured?: boolean;
}

const TIER_CONFIG = {
  premium: {
    icon: Crown,
    label: 'Premium',
    border: 'border-amber-400/50 dark:border-amber-500/30',
    glow: 'shadow-amber-500/10',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/50',
  },
  featured: {
    icon: Sparkles,
    label: 'Featured',
    border: 'border-violet-400/50 dark:border-violet-500/30',
    glow: 'shadow-violet-500/10',
    badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-300/50',
  },
  basic: {
    icon: Zap,
    label: 'Basic',
    border: 'border-gray-200 dark:border-gray-700/50',
    glow: '',
    badge: 'bg-muted text-muted-foreground',
  },
};

export const DirectoryListingCard = ({ listing, featured = false }: DirectoryListingCardProps) => {
  const tier = TIER_CONFIG[listing.listing_tier] || TIER_CONFIG.basic;
  const TierIcon = tier.icon;

  const handleClick = () => {
    // Track view
    void supabase
      .rpc('increment_listing_views', { listing_id: listing.id })
      .then(({ error }) => {
        if (error) console.warn('Failed to track listing view:', error);
      });
  };

  const handleVisitLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (listing.website_url) {
      window.open(appendUtmParams(listing.website_url, 'directory'), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative overflow-hidden rounded-2xl border bg-white dark:bg-gray-900 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${tier.border} ${featured ? `shadow-lg ${tier.glow}` : 'shadow-md'}`}
    >
      {/* Cover Image */}
      {listing.cover_image_url && featured && (
        <div className="relative h-36 overflow-hidden">
          <img
            src={listing.cover_image_url}
            alt={listing.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Logo */}
          {listing.logo_url ? (
            <img
              src={listing.logo_url}
              alt={listing.name}
              className="w-12 h-12 rounded-xl object-cover border border-border/50 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                {listing.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-base text-foreground truncate">
                {listing.name}
              </h3>
              {listing.listing_tier !== 'basic' && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-5 font-bold ${tier.badge}`}
                >
                  <TierIcon className="w-3 h-3 mr-0.5" />
                  {tier.label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {listing.tagline}
            </p>
          </div>
        </div>

        {/* Description (featured/premium only) */}
        {listing.description && (listing.listing_tier !== 'basic' || featured) && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {listing.description}
          </p>
        )}

        {/* Tags */}
        {listing.tags && listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {listing.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-muted/50 text-xs text-muted-foreground font-medium"
              >
                {tag}
              </span>
            ))}
            {listing.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{listing.tags.length - 3} more</span>
            )}
          </div>
        )}

        {/* Category badge */}
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary" className="text-xs capitalize">
            {listing.category}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="w-3 h-3" />
            <span>{listing.views_count}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          {/* Author */}
          <div className="flex items-center gap-2">
            {listing.author_avatar ? (
              <img
                src={listing.author_avatar}
                alt={listing.author_name || ''}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-muted" />
            )}
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {listing.author_name || 'Anonymous'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {listing.twitter_url && (
              <a
                href={listing.twitter_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-[#1DA1F2]/10 text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Twitter className="w-3.5 h-3.5" />
              </a>
            )}
            {listing.linkedin_url && (
              <a
                href={listing.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-[#0A66C2]/10 text-muted-foreground hover:text-[#0A66C2] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
            {listing.github_url && (
              <a
                href={listing.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Github className="w-3.5 h-3.5" />
              </a>
            )}
            {listing.website_url && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 gap-1 text-xs"
                onClick={handleVisitLink}
              >
                <ExternalLink className="w-3 h-3" />
                Visit
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
