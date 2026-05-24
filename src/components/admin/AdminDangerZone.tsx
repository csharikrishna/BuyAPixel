import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Database, KeyRound, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

interface AdminDangerZoneProps {
  userEmail: string;
  onRefresh: () => void;
}

const CONFIRM_PHRASE = 'CLEAR ALL DATA';

export function AdminDangerZone({ userEmail, onRefresh }: AdminDangerZoneProps) {
  const [clearDbDialog, setClearDbDialog] = useState<{ open: boolean } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [clearingDb, setClearingDb] = useState(false);

  const isConfirmValid = confirmText.trim() === CONFIRM_PHRASE;

  const handleClearDatabase = useCallback(async () => {
    if (!isConfirmValid) {
      setConfirmError(`Please type "${CONFIRM_PHRASE}" exactly`);
      return;
    }

    setClearingDb(true);
    setConfirmError('');

    try {
      const { error } = await supabase.rpc('admin_clear_all_content');
      if (error) throw error;

      toast.success('Database cleared successfully', {
        description: 'All pixel ownership and marketplace listings have been reset.',
        duration: 8000,
      });

      setClearDbDialog(null);
      setConfirmText('');
      setConfirmError('');
      onRefresh();
    } catch (error: unknown) {
      console.error('Error clearing database:', error);
      toast.error('Failed to clear database', { description: getErrorMessage(error) });
    } finally {
      setClearingDb(false);
    }
  }, [isConfirmValid, onRefresh]);

  return (
    <>
      <Card className="mb-8 border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible administrative actions. Proceed with extreme caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-background">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <Database className="w-4 h-4 text-destructive" />
                Clear All Database Content
              </div>
              <p className="text-sm text-muted-foreground max-w-lg">
                Resets all pixel ownership, clears marketplace listings, and removes all user-uploaded content.
                User accounts and profiles remain intact.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setClearDbDialog({ open: true })}
              className="gap-2 shrink-0"
            >
              <Database className="w-4 h-4" />
              Clear Database
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clear Database Dialog */}
      <Dialog
        open={clearDbDialog?.open || false}
        onOpenChange={(open) => {
          if (!open) {
            setClearDbDialog(null);
            setConfirmText('');
            setConfirmError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-destructive" />
              </div>
              Clear All Database Content
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>This action will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All pixel ownership and content (images, links)</li>
                  <li>All marketplace listings</li>
                  <li>All announcements</li>
                </ul>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="font-semibold text-destructive flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    This action cannot be undone!
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-text" className="text-sm font-medium flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Type <span className="font-mono font-bold text-destructive">{CONFIRM_PHRASE}</span> to confirm
              </Label>
              <Input
                id="confirm-text"
                type="text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  setConfirmError('');
                }}
                placeholder={CONFIRM_PHRASE}
                className={confirmError ? 'border-destructive' : isConfirmValid ? 'border-green-500' : ''}
                autoFocus
                autoComplete="off"
              />
              {confirmError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {confirmError}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setClearDbDialog(null);
                setConfirmText('');
                setConfirmError('');
              }}
              disabled={clearingDb}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearDatabase}
              disabled={clearingDb || !isConfirmValid}
              className="gap-2 w-full sm:w-auto"
            >
              {clearingDb && <Loader2 className="w-4 h-4 animate-spin" />}
              {clearingDb ? 'Clearing...' : 'Clear Database'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
