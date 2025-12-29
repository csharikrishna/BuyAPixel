import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  X 
} from 'lucide-react';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featured_image: string | null;
  published_at: string;
  reading_time: number;
  tags: string[];
  views: number;
  author_id: string;
}

const Blog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    loadBlogPosts();
  }, []);

  useEffect(() => {
    filterPosts();
  }, [searchQuery, selectedTag, posts]);

  const loadBlogPosts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
      setFilteredPosts(data || []);
    } catch (error) {
      console.error('Error loading blog posts:', error);
      toast.error('Failed to load blog posts');
    } finally {
      setIsLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = posts;

    if (searchQuery) {
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTag) {
      filtered = filtered.filter((post) => post.tags?.includes(selectedTag));
    }

    setFilteredPosts(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
  };

  const allTags = Array.from(new Set(posts.flatMap((post) => post.tags || [])));
  const hasFilters = searchQuery || selectedTag;

  return (
    <>
      <Helmet>
        <title>Blog - BuyAPixel.in | Insights on Pixel Marketing</title>
        <meta
          name="description"
          content="Read our blog for insights on pixel marketing, digital advertising, and success stories from our community."
        />
        <meta property="og:title" content="Blog - BuyAPixel.in" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Insights on pixel marketing and digital advertising" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        {/* Hero Section */}
        <div className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="secondary" className="mb-4">
                <BookOpen className="w-3 h-3 mr-1" />
                Blog
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Stories, Insights & Updates
              </h1>
              <p className="text-lg text-muted-foreground">
                Learn about pixel marketing, digital advertising strategies, and success
                stories from our community
              </p>
              {posts.length > 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  {posts.length} {posts.length === 1 ? 'article' : 'articles'} published
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 flex-1">
          {/* Search & Filter Bar */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles by title or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="shrink-0"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <Button
                    variant={selectedTag === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTag(null)}
                    className="whitespace-nowrap"
                  >
                    All Topics
                  </Button>
                  {allTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTag === tag ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTag(tag)}
                      className="whitespace-nowrap capitalize"
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Results Count */}
            {hasFilters && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredPosts.length} of {posts.length} articles
              </p>
            )}
          </div>

          {/* Blog Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
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
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No posts found</h3>
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <Link key={post.id} to={`/blog/${post.slug}`}>
                  <Card className="h-full hover:shadow-xl transition-all duration-300 overflow-hidden group border-2 hover:border-primary/20">
                    {post.featured_image ? (
                      <div className="relative h-48 overflow-hidden bg-muted">
                        <img
                          src={post.featured_image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <BookOpen className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(post.published_at), 'MMM dd, yyyy')}
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        {post.reading_time} min
                        {post.views > 0 && (
                          <>
                            <span>•</span>
                            <TrendingUp className="w-3 h-3" />
                            {post.views}
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
                        <div className="flex flex-wrap gap-2">
                          {post.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs capitalize">
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
              ))}
            </div>
          )}
        </div>

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
