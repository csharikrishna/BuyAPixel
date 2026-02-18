import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Megaphone, Loader2 } from 'lucide-react';

interface AdminBroadcastTabProps {
  broadcastMessage: string;
  isBroadcastActive: boolean;
  broadcastId: string | null;
  processing: boolean;
  onMessageChange: (msg: string) => void;
  onActiveChange: (active: boolean) => void;
  onSave: () => void;
  onReset: () => void;
}

export function AdminBroadcastTab({
  broadcastMessage, isBroadcastActive, broadcastId, processing,
  onMessageChange, onActiveChange, onSave, onReset,
}: AdminBroadcastTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Announcements</CardTitle>
        <CardDescription>Publish a message to all users on the home page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/30 p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <Label className="text-base">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Enable this to show the banner on the homepage
              </p>
            </div>
            <Switch
              checked={isBroadcastActive}
              onCheckedChange={onActiveChange}
              disabled={processing}
            />
          </div>
          <div className="space-y-2">
            <Label>Banner Message</Label>
            <Textarea
              placeholder="e.g., '🎉 50% Off All Pixels This Weekend!'"
              value={broadcastMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={3}
              className="resize-none font-medium"
              disabled={processing}
            />
            <p className="text-xs text-muted-foreground text-right">
              {broadcastMessage.length} characters
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onReset} disabled={processing}>
            Reset
          </Button>
          <Button onClick={onSave} disabled={processing || !broadcastMessage.trim()}>
            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />}
            {broadcastId ? 'Update Broadcast' : 'Publish Broadcast'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
