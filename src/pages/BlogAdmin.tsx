import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import Header from '@/components/Header';
import { ImageUpload } from '@/components/ImageUpload';
import { ContentImageManager } from '@/components/ContentImageManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Loader2, 
  Shield, 
  FileText, 
  Eye, 
  Save, 
  X, 
  Sparkles,
  Image as ImageIcon,
  Code
} from 'lucide-react';

const BlogAdmin = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featured_image: '',
    tags: '',
    reading_time: 5,
    published: false,
    seo_title: '',
    seo_description: '',
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleAutoSlug = () => {
    if (formData.title && !formData.slug) {
      setFormData({ ...formData, slug: generateSlug(formData.title) });
    }
  };

  const handleFeaturedImageUpload = (url: string) => {
    setFormData({ ...formData, featured_image: url });
  };

  const handleContentImageInsert = (url: string) => {
    // Generate HTML for the image with proper SEO attributes
    const imageHtml = `<figure class="my-8">
  <img src="${url}" alt="Describe your image here" class="w-full rounded-lg shadow-lg" loading="lazy" />
  <figcaption class="text-sm text-center text-muted-foreground mt-2">Add your image caption here</figcaption>
</figure>`;

    // Copy to clipboard
    navigator.clipboard.writeText(imageHtml);
    
    // Also insert at cursor position if possible
    const textarea = document.getElementById('content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.content;
      const newContent = text.substring(0, start) + imageHtml + text.substring(end);
      setFormData({ ...formData, content: newContent });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!formData.content.trim()) {
      toast.error('Please enter content');
      return;
    }

    if (!formData.featured_image) {
      toast.error('Please upload a featured image for better SEO');
      return;
    }

    setIsLoading(true);

    try {
      const slug = formData.slug || generateSlug(formData.title);
      const tags = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      const { error } = await supabase.from('blog_posts').insert({
        title: formData.title,
        slug,
        excerpt: formData.excerpt || null,
        content: formData.content,
        featured_image: formData.featured_image,
        tags,
        reading_time: formData.reading_time,
        published: formData.published,
        published_at: formData.published ? new Date().toISOString() : null,
        seo_title: formData.seo_title || formData.title,
        seo_description: formData.seo_description || formData.excerpt || null,
        author_id: user!.id,
      });

      if (error) throw error;

      toast.success(
        formData.published
          ? '🎉 Blog post published successfully!'
          : '💾 Blog post saved as draft!'
      );
      navigate('/blog');
    } catch (error: any) {
      console.error('Error creating blog post:', error);
      
      if (error.code === '23505') {
        toast.error('A post with this slug already exists. Please use a different slug.');
      } else {
        toast.error(error.message || 'Failed to create blog post');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <Shield className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You do not have permission to create blog posts
          </p>
          <Button onClick={() => navigate('/blog')}>View Blog</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="w-8 h-8" />
              Create New Blog Post
            </h1>
            <p className="text-muted-foreground mt-1">
              Write and publish SEO-optimized content with images
            </p>
          </div>
          <Badge variant="secondary">
            <Shield className="w-3 h-3 mr-1" />
            Admin
          </Badge>
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the main details of your blog post
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter an engaging, SEO-friendly title..."
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    onBlur={handleAutoSlug}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="slug"
                      placeholder="auto-generated-from-title"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFormData({ ...formData, slug: generateSlug(formData.title) })
                      }
                      disabled={!formData.title}
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    URL: /blog/{formData.slug || 'your-post-slug'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt (for SEO & previews)</Label>
                  <Textarea
                    id="excerpt"
                    placeholder="Write a compelling summary that will appear in search results and social media..."
                    value={formData.excerpt}
                    onChange={(e) =>
                      setFormData({ ...formData, excerpt: e.target.value })
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.excerpt.length}/200 characters
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Featured Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Featured Image *
                </CardTitle>
                <CardDescription>
                  Upload a high-quality image (recommended: 1200x630px for social sharing)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  onImageUploaded={handleFeaturedImageUpload}
                  currentImage={formData.featured_image}
                  folder="featured"
                />
              </CardContent>
            </Card>

            {/* Content Editor with Image Manager */}
            <Card>
              <CardHeader>
                <CardTitle>Content *</CardTitle>
                <CardDescription>
                  Write your blog post with images and formatting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="editor">
                  <TabsList className="mb-4">
                    <TabsTrigger value="editor">
                      <FileText className="w-4 h-4 mr-2" />
                      Editor
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor" className="space-y-4">
                    <Textarea
                      id="content"
                      placeholder="<h2>Your heading</h2><p>Your content here...</p>"
                      value={formData.content}
                      onChange={(e) =>
                        setFormData({ ...formData, content: e.target.value })
                      }
                      rows={20}
                      className="font-mono text-sm"
                      required
                    />
                  </TabsContent>

                  <TabsContent value="preview">
                    <div
                      className="prose prose-lg dark:prose-invert max-w-none p-6 border rounded-lg min-h-[400px]"
                      dangerouslySetInnerHTML={{ __html: formData.content || '<p class="text-muted-foreground">Start writing to see preview...</p>' }}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Content Image Manager */}
            <ContentImageManager onInsertImage={handleContentImageInsert} />

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (for SEO & filtering)</Label>
                  <Input
                    id="tags"
                    placeholder="marketing, pixels, tutorial"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                  />
                  {formData.tags && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.split(',').map((tag, i) => {
                        const trimmedTag = tag.trim();
                        return trimmedTag ? (
                          <Badge key={i} variant="secondary" className="capitalize">
                            {trimmedTag}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reading_time">Reading Time (minutes)</Label>
                  <Input
                    id="reading_time"
                    type="number"
                    min="1"
                    max="60"
                    value={formData.reading_time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reading_time: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* SEO */}
            <Card>
              <CardHeader>
                <CardTitle>SEO Optimization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seo_title">SEO Title</Label>
                  <Input
                    id="seo_title"
                    placeholder="Defaults to post title"
                    value={formData.seo_title}
                    onChange={(e) =>
                      setFormData({ ...formData, seo_title: e.target.value })
                    }
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.seo_title.length}/60 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seo_description">SEO Description</Label>
                  <Textarea
                    id="seo_description"
                    placeholder="Defaults to excerpt"
                    value={formData.seo_description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        seo_description: e.target.value,
                      })
                    }
                    rows={3}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.seo_description.length}/160 characters
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Publishing */}
            <Card>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="published">Publish Now</Label>
                    <p className="text-sm text-muted-foreground">
                      Make visible to everyone
                    </p>
                  </div>
                  <Switch
                    id="published"
                    checked={formData.published}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, published: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sticky top-4">
              <Button type="submit" disabled={isLoading} size="lg" className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {formData.published ? 'Publishing...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {formData.published ? (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Publish Post
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Draft
                      </>
                    )}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/blog')}
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlogAdmin;
