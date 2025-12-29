import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  Share2, 
  TrendingUp,
  Eye,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';

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

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (slug) {
      loadBlogPost();
      // Scroll to top when post changes
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [slug]);

  const loadBlogPost = async () => {
    try {
      setIsLoading(true);

      const { data: postData, error: postError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();

      if (postError) throw postError;

      setPost(postData);

      // Increment view count
      await supabase
        .from('blog_posts')
        .update({ views: (postData.views || 0) + 1 })
        .eq('id', postData.id);

      // Load related posts
      if (postData.tags && postData.tags.length > 0) {
        const { data: relatedData } = await supabase
          .from('blog_posts')
          .select('id, slug, title, excerpt, featured_image, published_at, reading_time')
          .eq('published', true)
          .neq('id', postData.id)
          .overlaps('tags', postData.tags)
          .limit(3);

        if (relatedData) {
          setRelatedPosts(relatedData);
        }
      }
    } catch (error) {
      console.error('Error loading blog post:', error);
      toast.error('Failed to load blog post');
      navigate('/blog');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async (platform?: 'twitter' | 'facebook' | 'linkedin') => {
    const url = window.location.href;
    const title = post?.title || 'Check out this blog post';
    const text = post?.excerpt || title;

    if (platform) {
      const shareUrls = {
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      };
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
      toast.success(`Sharing on ${platform}!`);
    } else if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        toast.success('Shared successfully!');
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
    setShowShareMenu(false);
  };

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
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
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
          content={post.seo_description || post.excerpt || post.content.substring(0, 160).replace(/<[^>]*>/g, '')}
        />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.seo_description || post.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={shareUrl} />
        {post.featured_image && <meta property="og:image" content={post.featured_image} />}
        <meta property="article:published_time" content={post.published_at} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.seo_description || post.excerpt} />
        {post.featured_image && <meta name="twitter:image" content={post.featured_image} />}
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <article className="container mx-auto px-4 py-8 max-w-4xl flex-1">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/blog')}
            className="mb-6 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Button>

          {/* Featured Image */}
          {post.featured_image && (
            <div className="relative h-[400px] md:h-[500px] rounded-xl overflow-hidden mb-8 shadow-2xl">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
          )}

          {/* Post Header */}
          <header className="mb-8">
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(post.published_at), 'MMMM dd, yyyy')}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.reading_time} min read
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {post.views} views
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {/* Tags & Share */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare('twitter')}
                >
                  <Twitter className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare('linkedin')}
                >
                  <Linkedin className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </header>

          <Separator className="my-8" />

          {/* Post Content */}
          <div
            className="prose prose-lg dark:prose-invert max-w-none mb-12
                       prose-headings:font-bold prose-headings:tracking-tight
                       prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4
                       prose-h3:text-2xl prose-h3:mt-6 prose-h3:mb-3
                       prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-img:rounded-lg prose-img:shadow-lg
                       prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                       prose-pre:bg-muted prose-pre:border
                       prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <Separator className="my-8" />

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-12">
              <h2 className="text-3xl font-bold mb-6">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((related) => (
                  <Link 
                    key={related.id} 
                    to={`/blog/${related.slug}`} 
                    className="group"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    <div className="border rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
                      {related.featured_image && (
                        <div className="relative h-40 overflow-hidden bg-muted">
                          <img
                            src={related.featured_image}
                            alt={related.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                          />
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
                          <Clock className="w-3 h-3" />
                          {related.reading_time} min read
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>

        <Footer />
      </div>
    </>
  );
};

export default BlogPost;
