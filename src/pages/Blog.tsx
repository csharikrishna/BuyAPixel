import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Clock,
  Search,
  BookOpen,
  TrendingUp,
  Filter,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import debounce from 'lodash/debounce';
import { BLOG_SEED_POSTS } from '@/data/blogSeedPosts';
import { LOGO, getFullLogoUrl } from '@/lib/branding';

// ======================
// TYPES & INTERFACES
// ======================

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featured_image: string | null;
  published_at: string;
  reading_time: number;
  tags: string[];
  view_count: number | null;
  author_id: string;
}

// ======================
// CONSTANTS
// ======================

const POSTS_PER_PAGE = 12;
const SEARCH_DEBOUNCE_MS = 300;
const FEATURED_IMAGE_PLACEHOLDER = '/placeholder-blog.jpg';

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Get unique tags from posts
 */
function extractUniqueTags(posts: BlogPost[]): string[] {
  const tags = new Set<string>();
  posts.forEach((post) => {
    post.tags?.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort();
}

// ======================
// COMPONENT
// ======================

const Blog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Refs
  const isMountedRef = useRef(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // React 19 hooks
  const [isPending, startTransition] = useTransition();

  // State
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallbackPosts, setIsUsingFallbackPosts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const fallbackSlugs = useMemo(() => new Set(BLOG_SEED_POSTS.map((post) => post.slug)), []);

  // Get search and filter from URL params
  const searchQuery = searchParams.get('search') || '';
  const selectedTag = searchParams.get('tag') || null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Load blog posts
  useEffect(() => {
    loadBlogPosts();
  }, []);

  const loadBlogPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (!isMountedRef.current) return;

      const typedData = (data as unknown as BlogPost[]) || [];
      if (typedData.length > 0) {
        setPosts(typedData);
        setIsUsingFallbackPosts(false);
      } else {
        setPosts(BLOG_SEED_POSTS as unknown as BlogPost[]);
        setIsUsingFallbackPosts(true);
      }
    } catch (error: unknown) {
      if (!isMountedRef.current) return;

      console.error('Error loading blog posts:', error);
      setPosts(BLOG_SEED_POSTS as unknown as BlogPost[]);
      setIsUsingFallbackPosts(true);
      setError(null);
      toast.info('Showing curated blog guides while live posts are unavailable.');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Filter posts based on search and tag
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.excerpt?.toLowerCase().includes(query) ||
          post.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedTag) {
      filtered = filtered.filter((post) => post.tags?.includes(selectedTag));
    }

    return filtered;
  }, [posts, searchQuery, selectedTag]);

  // Paginate filtered posts
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    return filteredPosts.slice(startIndex, endIndex);
  }, [filteredPosts, currentPage]);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);

  // Extract unique tags
  const allTags = useMemo(() => extractUniqueTags(posts), [posts]);

  const hasFilters = searchQuery || selectedTag;

  // Update URL params with debouncing for search
  const updateSearchParam = useMemo(
    () =>
      debounce((value: string) => {
        startTransition(() => {
          const params = new URLSearchParams(searchParams);
          if (value) {
            params.set('search', value);
          } else {
            params.delete('search');
          }
          setSearchParams(params);
          setCurrentPage(1); // Reset to first page
        });
      }, SEARCH_DEBOUNCE_MS),
    [searchParams, setSearchParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateSearchParam(value);
    },
    [updateSearchParam]
  );

  const handleTagSelect = useCallback(
    (tag: string | null) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams);
        if (tag) {
          params.set('tag', tag);
        } else {
          params.delete('tag');
        }
        setSearchParams(params);
        setCurrentPage(1); // Reset to first page
      });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      setSearchParams({});
      setCurrentPage(1);
    });
  }, [setSearchParams]);

  const handleRetry = useCallback(() => {
    loadBlogPosts();
  }, [loadBlogPosts]);

  // Prefetch blog post on hover
  const prefetchBlogPost = useCallback(
    (slug: string) => {
      if (fallbackSlugs.has(slug)) return;

      queryClient.prefetchQuery({
        queryKey: ['blog-post', slug],
        queryFn: async () => {
          const { data } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'published')
            .single();
          return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    },
    [queryClient, fallbackSlugs]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('blog-search')?.focus();
      }

      // ESC to clear search
      if (e.key === 'Escape' && hasFilters) {
        clearFilters();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasFilters, clearFilters]);

  // Schema.org structured data for SEO
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'BuyASpot Blog',
      description: 'Insights on pixel marketing and digital advertising',
      url: 'https://buyaspot.in/blog',
      publisher: {
        '@type': 'Organization',
        name: 'BuyASpot',
        logo: getFullLogoUrl(LOGO),
      },
      blogPost: filteredPosts.slice(0, 10).map((post) => ({
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        datePublished: post.published_at,
        url: `https://buyaspot.in/blog/${post.slug}`,
        image: post.featured_image,
      })),
    }),
    [filteredPosts]
  );

  return (
    <>
      <Helmet>
        <title>Blog - buyaspot.in | Insights on Pixel Marketing</title>
        <meta
          name="description"
          content="Read our blog for insights on pixel marketing, digital advertising, and success stories from our community."
        />
        <meta property="og:title" content="Blog - buyaspot.in" />
        <meta property="og:type" content="website" />
        <meta
          property="og:description"
          content="Insights on pixel marketing and digital advertising"
        />
        <meta property="og:url" content="https://buyaspot.in/blog" />
        <link rel="canonical" href="https://buyaspot.in/blog" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        {/* Hero Section */}
        <div className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="secondary" className="mb-4">
                <BookOpen className="w-3 h-3 mr-1" aria-hidden="true" />
                Blog
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Stories, Insights & Updates
              </h1>
              <p className="text-lg text-muted-foreground">
                Learn about pixel marketing, digital advertising strategies, and success stories
                from our community
              </p>
              {posts.length > 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  {posts.length} {posts.length === 1 ? 'article' : 'articles'} published
                </p>
              )}
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 flex-1">
          {isUsingFallbackPosts && (
            <div className="mb-6 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
              Showing curated SEO guides. Live posts will appear automatically when published.
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="blog-search"
                  placeholder="Search articles... (Ctrl+K)"
                  defaultValue={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                  aria-label="Search blog posts"
                />
                {isPending && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="shrink-0"
                  aria-label="Clear all filters"
                >
                  <X className="w-4 h-4 mr-2" aria-hidden="true" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2" role="toolbar" aria-label="Filter by tag">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <Button
                    variant={selectedTag === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTagSelect(null)}
                    className="whitespace-nowrap"
                    aria-pressed={selectedTag === null}
                  >
                    All Topics
                  </Button>
                  {allTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTag === tag ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTagSelect(tag)}
                      className="whitespace-nowrap capitalize"
                      aria-pressed={selectedTag === tag}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Results Count */}
            {hasFilters && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                Showing {filteredPosts.length} of {posts.length} articles
              </p>
            )}
          </div>

          {/* Error State */}
          {error && (
            <div
              className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 flex items-start gap-4 mb-8"
              role="alert"
            >
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-2">Failed to load blog posts</h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={handleRetry} variant="outline" size="sm">
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Blog Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label="Loading blog posts">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16" role="status">
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
              <h2 className="text-xl font-semibold mb-2">No posts found</h2>
              <p className="text-muted-foreground mb-6">
                {searchQuery || selectedTag
                  ? 'Try adjusting your search or filters'
                  : 'Check back soon for new content'}
              </p>
              {hasFilters && (
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
                role="list"
                aria-label="Blog posts"
              >
                {paginatedPosts.map((post) => (
                  <article key={post.id} role="listitem">
                    <Link
                      to={`/blog/${post.slug}`}
                      onMouseEnter={() => prefetchBlogPost(post.slug)}
                      onFocus={() => prefetchBlogPost(post.slug)}
                      className="block focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg"
                    >
                      <Card className="h-full hover:shadow-xl transition-all duration-300 overflow-hidden group border-2 hover:border-primary/20">
                        {post.featured_image ? (
                          <div className="relative h-48 overflow-hidden bg-muted">
                            <img
                              src={post.featured_image}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = FEATURED_IMAGE_PLACEHOLDER;
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                        ) : (
                          <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <BookOpen className="w-16 h-16 text-muted-foreground" aria-hidden="true" />
                          </div>
                        )}
                        <CardContent className="p-6">
                          <div
                            className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap"
                            aria-label="Post metadata"
                          >
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            <time dateTime={post.published_at}>
                              {format(new Date(post.published_at), 'MMM dd, yyyy')}
                            </time>
                            <span aria-hidden="true">•</span>
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            <span>{post.reading_time} min read</span>
                            {(post.view_count ?? 0) > 0 && (
                              <>
                                <span aria-hidden="true">•</span>
                                <TrendingUp className="w-3 h-3" aria-hidden="true" />
                                <span>{post.view_count} views</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-xl font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
                              {post.excerpt}
                            </p>
                          )}
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2" aria-label="Tags">
                              {post.tags.slice(0, 3).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs capitalize"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {post.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{post.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2" role="navigation" aria-label="Pagination">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isPending}
                    aria-label="Previous page"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-4" aria-current="page">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || isPending}
                    aria-label="Next page"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </main>

        <Footer />
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default Blog;
