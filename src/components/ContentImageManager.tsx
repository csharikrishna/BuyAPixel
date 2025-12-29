import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Image as ImageIcon, 
  Copy,
  Loader2,
  Upload,
  Grid3x3
} from 'lucide-react';
import { ImageUpload } from './ImageUpload';

interface ContentImageManagerProps {
  onInsertImage: (url: string) => void;
}

export const ContentImageManager = ({ onInsertImage }: ContentImageManagerProps) => {
  const [recentImages, setRecentImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const loadRecentImages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('blog-images')
        .list('posts', {
          limit: 20,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const urls = data.map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from('blog-images')
          .getPublicUrl(`posts/${file.name}`);
        return publicUrl;
      });

      setRecentImages(urls);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUploaded = (url: string) => {
    setRecentImages(prev => [url, ...prev]);
    setShowUpload(false);
    toast.success('Image ready to insert!');
  };

  const insertImageToContent = (url: string) => {
    onInsertImage(url);
    toast.success('Image HTML copied to clipboard!');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Content Images
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadRecentImages}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Grid3x3 className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUpload && (
          <ImageUpload
            onImageUploaded={handleImageUploaded}
            folder="posts"
          />
        )}

        {recentImages.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Recently uploaded images (click to insert):
            </p>
            <ScrollArea className="h-[300px] rounded-lg border">
              <div className="grid grid-cols-2 gap-3 p-3">
                {recentImages.map((url, index) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer rounded-lg overflow-hidden border hover:border-primary transition-all"
                    onClick={() => insertImageToContent(url)}
                  >
                    <img
                      src={url}
                      alt={`Content ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Copy className="w-6 h-6 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-lg">
          <p className="font-semibold">💡 SEO Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use descriptive filenames (e.g., "pixel-marketing-guide.jpg")</li>
            <li>Compress images before uploading (aim for &lt;500KB)</li>
            <li>Use WebP format for better performance</li>
            <li>Add alt text to all images for accessibility</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
