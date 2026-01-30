import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
import { useNavigate, useBeforeUnload } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
} from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import DOMPurify from 'dompurify';


// ======================
// TYPES & INTERFACES
// ======================

interface FormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string;
  tags: string;
  reading_time: number;
  published: boolean;
  seo_title: string;
  seo_description: string;
}

interface SEOScore {
  score: number;
  issues: string[];
  suggestions: string[];
}

// ======================
// CONSTANTS
// ======================

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const DEBOUNCE_DELAY = 500;
const MIN_CONTENT_LENGTH = 300;
const IDEAL_EXCERPT_LENGTH = 160;
const IDEAL_TITLE_LENGTH = 60;

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate SEO-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Calculate estimated reading time
 */
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Calculate SEO score
 */
function calculateSEOScore(formData: FormData): SEOScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Title checks
  if (!formData.title) {
    issues.push('Missing title');
    score -= 20;
  } else if (formData.title.length < 30) {
    suggestions.push('Title is too short (ideal: 50-60 characters)');
    score -= 5;
  } else if (formData.title.length > 60) {
    issues.push('Title is too long (will be truncated in search results)');
    score -= 10;
  }

  // Excerpt checks
  if (!formData.excerpt) {
    suggestions.push('Add an excerpt for better search results');
    score -= 10;
  } else if (formData.excerpt.length > 160) {
    issues.push('Excerpt is too long (will be truncated)');
    score -= 5;
  }

  // Content checks
  const contentLength = formData.content.replace(/<[^>]*>/g, '').length;
  if (contentLength < MIN_CONTENT_LENGTH) {
    issues.push(`Content too short (minimum ${MIN_CONTENT_LENGTH} characters)`);
    score -= 15;
  }

  // Image check
  if (!formData.featured_image) {
    issues.push('Missing featured image');
    score -= 15;
  }

  // Check for images in content
  const imageCount = (formData.content.match(/<img/g) || []).length;
  if (imageCount === 0 && contentLength > 500) {
    suggestions.push('Consider adding images to break up long content');
    score -= 5;
  }

  // Tags check
  const tags = formData.tags.split(',').filter((t) => t.trim());
  if (tags.length === 0) {
    suggestions.push('Add tags for better discoverability');
    score -= 5;
  } else if (tags.length > 5) {
    suggestions.push('Too many tags (ideal: 3-5)');
    score -= 3;
  }

  return { score: Math.max(0, score), issues, suggestions };
}

/**
 * Debounce function
 */
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ======================
// COMPONENT
// ======================

const BlogAdmin = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const navigate = useNavigate();

  // Refs
  const isMountedRef = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const initialFormDataRef = useRef<FormData | null>(null);

  // React 19 hooks
  const [isPending, startTransition] = useTransition();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [formData, setFormData] = useState<FormData>({
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

  // Memoized calculations
  const seoScore = useMemo(() => calculateSEOScore(formData), [formData]);
  const wordCount = useMemo(
    () => formData.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length,
    [formData.content]
  );
  const characterCount = useMemo(
    () => formData.content.replace(/<[^>]*>/g, '').length,
    [formData.content]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Store initial form data
  useEffect(() => {
    if (!initialFormDataRef.current) {
      initialFormDataRef.current = formData;
    }
  }, []);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
    setHasUnsavedChanges(hasChanges);
  }, [formData]);

  // Warn before leaving with unsaved changes
  useBeforeUnload(
    useCallback(
      (e) => {
        if (hasUnsavedChanges) {
          e.preventDefault();
          return (e.returnValue = 'You have unsaved changes. Are you sure you want to leave?');
        }
      },
      [hasUnsavedChanges]
    )
  );

  // Auto-save draft
  useEffect(() => {
    if (!hasUnsavedChanges || formData.published) return;

    const autoSave = () => {
      const draft = {
        ...formData,
        timestamp: Date.now(),
      };
      localStorage.setItem('blog_draft', JSON.stringify(draft));
      setLastSaved(new Date());
      toast.success('Draft auto-saved', { duration: 2000 });
    };

    autoSaveTimerRef.current = setTimeout(autoSave, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, hasUnsavedChanges]);

  // Restore draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('blog_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const draftAge = Date.now() - draft.timestamp;
        const oneDay = 24 * 60 * 60 * 1000;

        if (draftAge < oneDay) {
          toast.info('Draft found', {
            action: {
              label: 'Restore',
              onClick: () => {
                const { timestamp, ...draftData } = draft;
                setFormData(draftData);
                toast.success('Draft restored');
              },
            },
            duration: 10000,
          });
        } else {
          localStorage.removeItem('blog_draft');
        }
      } catch (error) {
        console.error('Failed to parse draft:', error);
        localStorage.removeItem('blog_draft');
      }
    }
  }, []);

  // Auto-generate slug with debouncing
  const autoGenerateSlug = useMemo(
    () =>
      debounce((title: string) => {
        if (title && !formData.slug) {
          startTransition(() => {
            setFormData((prev) => ({ ...prev, slug: generateSlug(title) }));
          });
        }
      }, DEBOUNCE_DELAY),
    [formData.slug]
  );

  // Auto-calculate reading time
  useEffect(() => {
    if (formData.content) {
      const time = calculateReadingTime(formData.content);
      if (time !== formData.reading_time) {
        setFormData((prev) => ({ ...prev, reading_time: time }));
      }
    }
  }, [formData.content]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(new Event('submit') as any);
      }

      // Ctrl/Cmd + P to toggle preview
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        const previewTab = document.querySelector('[value="preview"]') as HTMLElement;
        previewTab?.click();
      }

      // ESC to show exit dialog
      if (e.key === 'Escape' && hasUnsavedChanges) {
        setShowExitDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges]);

  // Handlers
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const title = e.target.value;
      setFormData((prev) => ({ ...prev, title }));
      autoGenerateSlug(title);
    },
    [autoGenerateSlug]
  );

  const handleAutoSlug = useCallback(() => {
    if (formData.title && !formData.slug) {
      setFormData((prev) => ({ ...prev, slug: generateSlug(prev.title) }));
    }
  }, [formData.title, formData.slug]);

  const handleFeaturedImageUpload = useCallback((url: string) => {
    setFormData((prev) => ({ ...prev, featured_image: url }));
  }, []);

  const handleContentImageInsert = useCallback(
    (url: string) => {
      const imageHtml = `<figure class="my-8">
  <img src="${url}" alt="Describe your image here" class="w-full rounded-lg shadow-lg" loading="lazy" />
  <figcaption class="text-sm text-center text-muted-foreground mt-2">Add your image caption here</figcaption>
</figure>`;

      navigator.clipboard.writeText(imageHtml);
      toast.success('Image HTML copied to clipboard');

      const textarea = document.getElementById('content') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.content;
        const newContent = text.substring(0, start) + imageHtml + text.substring(end);
        setFormData((prev) => ({ ...prev, content: newContent }));

        // Set cursor position after inserted content
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + imageHtml.length;
        }, 0);
      }
    },
    [formData.content]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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

    if (seoScore.score < 50 && formData.published) {
      const proceed = window.confirm(
        `Your SEO score is low (${seoScore.score}/100). Do you still want to publish?`
      );
      if (!proceed) return;
    }

    setIsLoading(true);

    try {
      const slug = formData.slug || generateSlug(formData.title);
      const tags = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      const { error } = await supabase.from('blog_posts' as any).insert({
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

      // Clear draft
      localStorage.removeItem('blog_draft');
      setHasUnsavedChanges(false);

      toast.success(
        formData.published ? '🎉 Blog post published successfully!' : '💾 Blog post saved as draft!'
      );

      // Navigate after a short delay
      setTimeout(() => {
        navigate('/blog');
      }, 1000);
    } catch (error: unknown) {
      console.error('Error creating blog post:', error);

      const errorMessage = getErrorMessage(error);
      if ((error as any)?.code === '23505') {
        toast.error('A post with this slug already exists. Please use a different slug.');
      } else {
        toast.error(errorMessage || 'Failed to create blog post');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
    } else {
      navigate('/blog');
    }
  }, [hasUnsavedChanges, navigate]);

  const confirmExit = useCallback(() => {
    setShowExitDialog(false);
    navigate('/blog');
  }, [navigate]);

  // Authorization check
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
          <Shield className="w-16 h-16 mx-auto text-destructive mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You do not have permission to create blog posts
          </p>
          <Button onClick={() => navigate('/blog')}>View Blog</Button>
        </div>
      </div>
    );
  }

  // Get SEO score color
  const getSEOScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="w-8 h-8" aria-hidden="true" />
                Create New Blog Post
              </h1>
              <p className="text-muted-foreground mt-1">
                Write and publish SEO-optimized content with images
              </p>
              {lastSaved && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last saved: {lastSaved.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                Admin
              </Badge>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-yellow-600">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Unsaved Changes
                </Badge>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Enter the main details of your blog post</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Title * <span className="text-xs text-muted-foreground">({formData.title.length}/{IDEAL_TITLE_LENGTH})</span>
                    </Label>
                    <Input
                      id="title"
                      placeholder="Enter an engaging, SEO-friendly title..."
                      value={formData.title}
                      onChange={handleTitleChange}
                      onBlur={handleAutoSlug}
                      required
                      aria-describedby="title-hint"
                    />
                    <p id="title-hint" className="text-xs text-muted-foreground">
                      {formData.title.length < 30 && 'Title is too short'}
                      {formData.title.length > 60 && 'Title is too long (will be truncated)'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">URL Slug *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="slug"
                        placeholder="auto-generated-from-title"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        aria-describedby="slug-preview"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormData({ ...formData, slug: generateSlug(formData.title) })}
                        disabled={!formData.title || isPending}
                        aria-label="Generate slug from title"
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                    </div>
                    <p id="slug-preview" className="text-xs text-muted-foreground">
                      URL: /blog/{formData.slug || 'your-post-slug'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="excerpt">
                      Excerpt (for SEO & previews) <span className="text-xs text-muted-foreground">({formData.excerpt.length}/{IDEAL_EXCERPT_LENGTH})</span>
                    </Label>
                    <Textarea
                      id="excerpt"
                      placeholder="Write a compelling summary that will appear in search results and social media..."
                      value={formData.excerpt}
                      onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                      rows={3}
                      maxLength={200}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Featured Image */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" aria-hidden="true" />
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
                    maxSizeMB={2}
                    compressBeforeUpload={true}
                  />
                </CardContent>
              </Card>

              {/* Content Editor */}
              <Card>
                <CardHeader>
                  <CardTitle>Content *</CardTitle>
                  <CardDescription className="flex items-center justify-between">
                    <span>Write your blog post with images and formatting</span>
                    <span className="text-xs">
                      {wordCount} words • {characterCount} characters
                    </span>
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
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={20}
                        className="font-mono text-sm"
                        required
                        aria-describedby="content-hint"
                      />
                      <p id="content-hint" className="text-xs text-muted-foreground">
                        Press Ctrl+S to save • Ctrl+P to preview
                      </p>
                    </TabsContent>

                    <TabsContent value="preview">
                      <div
                        className="prose prose-lg dark:prose-invert max-w-none p-6 border rounded-lg min-h-[400px]"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(formData.content) || '<p class="text-muted-foreground">Start writing to see preview...</p>',
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* SEO Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="w-5 h-5" aria-hidden="true" />
                      SEO Score
                    </span>
                    <span className={`text-2xl font-bold ${getSEOScoreColor(seoScore.score)}`}>
                      {seoScore.score}/100
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={seoScore.score} className="h-2" />

                  {seoScore.issues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Issues ({seoScore.issues.length})
                      </h4>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {seoScore.issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-destructive">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {seoScore.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Suggestions ({seoScore.suggestions.length})
                      </h4>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {seoScore.suggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span>•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

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
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
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
                    <Label htmlFor="reading_time">
                      Reading Time (minutes) <span className="text-xs text-muted-foreground">(auto-calculated)</span>
                    </Label>
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
                      readOnly
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
                    <Label htmlFor="seo_title">
                      SEO Title <span className="text-xs text-muted-foreground">({formData.seo_title.length}/60)</span>
                    </Label>
                    <Input
                      id="seo_title"
                      placeholder="Defaults to post title"
                      value={formData.seo_title}
                      onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                      maxLength={60}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_description">
                      SEO Description <span className="text-xs text-muted-foreground">({formData.seo_description.length}/160)</span>
                    </Label>
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
                      <p className="text-sm text-muted-foreground">Make visible to everyone</p>
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
                <Button
                  type="submit"
                  disabled={isLoading || isPending}
                  size="lg"
                  className="w-full"
                  aria-label={formData.published ? 'Publish post' : 'Save as draft'}
                >
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
                  onClick={handleCancel}
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

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your progress will be auto-saved as a draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} className="bg-destructive hover:bg-destructive/90">
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BlogAdmin;
