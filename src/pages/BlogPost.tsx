import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
  Calendar,
  Clock,
  ArrowLeft,
  Share2,
  Eye,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  ChevronUp,
  List,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

// ======================
// TYPES & INTERFACES
// ======================

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  featured_image: string | null;
  published_at: string;
  reading_time: number;
  tags: string[];
  views: number;
  seo_title: string | null;
  seo_description: string | null;
  author_id: string;
}

interface RelatedPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featured_image: string | null;
  published_at: string;
  reading_time: number;
}

interface TableOfContents {
  id: string;
  text: string;
  level: number;
}

// ======================
// CONSTANTS
// ======================

const SCROLL_THRESHOLD = 100;
const VIEW_INCREMENT_DELAY = 3000; // 3 seconds

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Extract table of contents from HTML content
 */
function extractTableOfContents(html: string): TableOfContents[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings = doc.querySelectorAll('h2, h3');
  
  return Array.from(headings).map((heading, index) => ({
    id: heading.id || `heading-${index}`,
    text: heading.textContent || '',
    level: parseInt(heading.tagName.substring(1)),
  }));
}

/**
 * Add IDs to headings for anchor links
 */
function addHeadingIds(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings = doc.querySelectorAll('h2, h3');
  
  headings.forEach((heading, index) => {
    if (!heading.id) {
      const text = heading.textContent || '';
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '') || `heading-${index}`;
      heading.id = id;
    }
  });
  
  return doc.body.innerHTML;
}

// ======================
// COMPONENT
// ======================

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Refs
  const isMountedRef = useRef(true);
  const viewIncrementedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // State
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load blog post
  useEffect(() => {
    if (slug) {
      loadBlogPost();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [slug]);

  // Track reading progress
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercentage = (scrollTop / (documentHeight - windowHeight)) * 100;

      setReadingProgress(Math.min(100, Math.max(0, scrollPercentage)));
      setShowScrollTop(scrollTop > SCROLL_THRESHOLD);

      // Update active heading
      const headings = contentRef.current.querySelectorAll('h2, h3');
      let currentHeading = '';

      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
          currentHeading = heading.id;
        }
      });

      setActiveHeading(currentHeading);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Increment view count after reading for 3 seconds
  useEffect(() => {
    if (!post || viewIncrementedRef.current) return;

    const timer = setTimeout(async () => {
      if (!isMountedRef.current) return;

      try {
        await supabase
          .from('blog_posts' as any)
          .update({ views: (post.views || 0) + 1 })
          .eq('id', post.id);

        viewIncrementedRef.current = true;
      } catch (error) {
        console.error('Failed to increment view count:', error);
      }
    }, VIEW_INCREMENT_DELAY);

    return () => clearTimeout(timer);
  }, [post]);

  const loadBlogPost = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: postData, error: postError } = await supabase
        .from('blog_posts' as any)
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (postError) throw postError;

      if (!isMountedRef.current) return;

      const typedPost = postData as unknown as BlogPost;
      setPost(typedPost);

      // Load related posts
      if (typedPost.tags && typedPost.tags.length > 0) {
        const { data: relatedData } = await supabase
          .from('blog_posts' as any)
          .select('id, slug, title, excerpt, featured_image, published_at, reading_time')
          .eq('status', 'published')
          .neq('id', typedPost.id)
          .overlaps('tags', typedPost.tags)
          .limit(3);

        if (relatedData && isMountedRef.current) {
          setRelatedPosts(relatedData as unknown as RelatedPost[]);
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      console.error('Error loading blog post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load blog post';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Process content with IDs
  const processedContent = useMemo(() => {
    if (!post?.content) return '';
    const withIds = addHeadingIds(post.content);
    return DOMPurify.sanitize(withIds, {
      ADD_ATTR: ['target', 'rel'],
      ADD_TAGS: ['iframe'],
    });
  }, [post?.content]);

  // Extract table of contents
  const tableOfContents = useMemo(() => {
    if (!processedContent) return [];
    return extractTableOfContents(processedContent);
  }, [processedContent]);

  // Share handlers
  const handleShare = useCallback(
    async (platform?: 'twitter' | 'facebook' | 'linkedin') => {
      const url = window.location.href;
      const title = post?.title || 'Check out this blog post';
      const text = post?.excerpt || title;

      if (platform) {
        const shareUrls = {
          twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        };
        window.open(shareUrls[platform], '_blank', 'noopener,noreferrer,width=600,height=400');
        toast.success(`Sharing on ${platform}!`);
      } else if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          toast.success('Shared successfully!');
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            console.error('Share error:', err);
          }
        }
      } else {
        navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    },
    [post]
  );

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      setShowTOC(false);
    }
  }, []);

  // Prefetch related post
  const prefetchRelatedPost = useCallback(
    (postSlug: string) => {
      queryClient.prefetchQuery({
        queryKey: ['blog-post', postSlug],
        queryFn: async () => {
          const { data } = await supabase
            .from('blog_posts' as any)
            .select('*')
            .eq('slug', postSlug)
            .eq('status', 'published')
            .single();
          return data;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  // Schema.org structured data
  const structuredData = useMemo(() => {
    if (!post) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt || post.seo_description,
      image: post.featured_image,
      datePublished: post.published_at,
      dateModified: post.published_at,
      author: {
        '@type': 'Person',
        name: 'BuyAPixel Team',
      },
      publisher: {
        '@type': 'Organization',
        name: 'BuyAPixel',
        logo: {
          '@type': 'ImageObject',
          url: 'https://buyapixel.in/logo.png',
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': window.location.href,
      },
    };
  }, [post]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to toggle TOC
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowTOC((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Error state
  if (error && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center flex-1">
          <AlertTriangle className="w-16 h-16 mx-auto text-destructive mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold mb-4">Failed to Load Post</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={loadBlogPost} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => navigate('/blog')}>Back to Blog</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl flex-1">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-96 w-full mb-8 rounded-xl" />
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return null;
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      <Helmet>
        <title>{post.seo_title || post.title} - BuyAPixel.in</title>
        <meta
          name="description"
          content={
            post.seo_description ||
            post.excerpt ||
            post.content.substring(0, 160).replace(/<[^>]*>/g, '')
          }
        />
        <link rel="canonical" href={shareUrl} />
        
        {/* Open Graph */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.seo_description || post.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={shareUrl} />
        {post.featured_image && <meta property="og:image" content={post.featured_image} />}
        <meta property="article:published_time" content={post.published_at} />
        {post.tags?.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.seo_description || post.excerpt} />
        {post.featured_image && <meta name="twitter:image" content={post.featured_image} />}

        {/* Structured Data */}
        {structuredData && (
          <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        )}
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Reading Progress Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${readingProgress}%` }}
            role="progressbar"
            aria-valuenow={readingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Reading progress"
          />
        </div>

        <Header />

        <article className="container mx-auto px-4 py-8 max-w-4xl flex-1">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/blog')}
            className="mb-6 -ml-2"
            aria-label="Back to blog"
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to Blog
          </Button>

          {/* Featured Image */}
          {post.featured_image && (
            <figure className="relative h-[400px] md:h-[500px] rounded-xl overflow-hidden mb-8 shadow-2xl">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </figure>
          )}

          {/* Post Header */}
          <header className="mb-8">
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
              <time dateTime={post.published_at} className="flex items-center gap-1">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                {format(new Date(post.published_at), 'MMMM dd, yyyy')}
              </time>
              <span aria-hidden="true">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" aria-hidden="true" />
                {post.reading_time} min read
              </span>
              <span aria-hidden="true">•</span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" aria-hidden="true" />
                {post.views} views
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">{post.title}</h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl text-muted-foreground mb-6 leading-relaxed">{post.excerpt}</p>
            )}

            {/* Tags & Share */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2" role="list" aria-label="Article tags">
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Share Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare()}
                  className="gap-2"
                  aria-label="Share article"
                >
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare('twitter')}
                  aria-label="Share on Twitter"
                >
                  <Twitter className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare('linkedin')}
                  aria-label="Share on LinkedIn"
                >
                  <Linkedin className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Table of Contents Toggle */}
            {tableOfContents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTOC(!showTOC)}
                className="mt-4 gap-2"
                aria-expanded={showTOC}
                aria-controls="table-of-contents"
              >
                <List className="w-4 h-4" />
                Table of Contents
              </Button>
            )}
          </header>

          {/* Table of Contents */}
          {showTOC && tableOfContents.length > 0 && (
            <Card id="table-of-contents" className="p-6 mb-8" role="navigation" aria-label="Table of contents">
              <h2 className="text-lg font-bold mb-4">Table of Contents</h2>
              <nav>
                <ul className="space-y-2">
                  {tableOfContents.map((item) => (
                    <li
                      key={item.id}
                      className={cn('text-sm', item.level === 3 && 'ml-4')}
                    >
                      <button
                        onClick={() => scrollToHeading(item.id)}
                        className={cn(
                          'text-left hover:text-primary transition-colors w-full',
                          activeHeading === item.id && 'text-primary font-semibold'
                        )}
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </Card>
          )}

          <Separator className="my-8" />

          {/* Post Content */}
          <div
            ref={contentRef}
            className="prose prose-lg dark:prose-invert max-w-none mb-12
                       prose-headings:font-bold prose-headings:tracking-tight prose-headings:scroll-mt-24
                       prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4
                       prose-h3:text-2xl prose-h3:mt-6 prose-h3:mb-3
                       prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-img:rounded-lg prose-img:shadow-lg prose-img:mx-auto
                       prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                       prose-pre:bg-muted prose-pre:border
                       prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1
                       prose-ul:list-disc prose-ol:list-decimal
                       prose-li:marker:text-primary"
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />

          <Separator className="my-8" />

          {/* Social Share Section */}
          <div className="bg-muted/50 rounded-lg p-6 text-center mb-12">
            <h3 className="text-lg font-semibold mb-3">Enjoyed this article?</h3>
            <p className="text-sm text-muted-foreground mb-4">Share it with your network</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => handleShare('twitter')}>
                <Twitter className="w-4 h-4 mr-2" />
                Twitter
              </Button>
              <Button variant="outline" onClick={() => handleShare('facebook')}>
                <Facebook className="w-4 h-4 mr-2" />
                Facebook
              </Button>
              <Button variant="outline" onClick={() => handleShare('linkedin')}>
                <Linkedin className="w-4 h-4 mr-2" />
                LinkedIn
              </Button>
            </div>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-12">
              <h2 className="text-3xl font-bold mb-6">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((related) => (
                  <article key={related.id}>
                    <Link
                      to={`/blog/${related.slug}`}
                      className="group block focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg"
                      onMouseEnter={() => prefetchRelatedPost(related.slug)}
                      onFocus={() => prefetchRelatedPost(related.slug)}
                      aria-label={`Read article: ${related.title}`}
                    >
                      <div className="border rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
                        {related.featured_image ? (
                          <div className="relative h-40 overflow-hidden bg-muted">
                            <img
                              src={related.featured_image}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="h-40 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <CheckCircle className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-bold line-clamp-2 group-hover:text-primary transition-colors mb-2">
                            {related.title}
                          </h3>
                          {related.excerpt && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {related.excerpt}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            <span>{related.reading_time} min read</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}
        </article>

        <Footer />

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            size="icon"
            className="fixed bottom-8 right-8 rounded-full shadow-lg z-40"
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
        )}
      </div>
    </>
  );
};

export default BlogPost;
