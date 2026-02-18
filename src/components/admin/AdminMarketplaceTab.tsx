import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Store, Star, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/utils';

interface MarketplaceListing {
  id: string;
  pixel_id: string;
  seller_id: string;
  asking_price: number;
  status: string;
  featured: boolean;
  created_at: string;
}

interface AdminMarketplaceTabProps {
  listings: MarketplaceListing[];
  getUserEmail: (id: string) => string;
  getPixelCoords: (id: string) => string;
  onRefresh: () => void;
}

export function AdminMarketplaceTab({ listings, getUserEmail, getPixelCoords, onRefresh }: AdminMarketplaceTabProps) {
  const [processing, setProcessing] = useState(false);
  const [cancelListingDialog, setCancelListingDialog] = useState<{ open: boolean; listingId: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const handleToggleFeatured = useCallback(async (listingId: string, currentFeatured: boolean) => {
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_toggle_featured_listing' as any, {
        p_listing_id: listingId,
        p_featured: !currentFeatured,
      });
      if (error) throw error;
      toast.success(currentFeatured ? 'Listing unfeatured' : 'Listing featured');
      onRefresh();
    } catch (error: unknown) {
      console.error('Error toggling featured:', error);
      toast.error(getErrorMessage(error) || 'Failed to update listing');
    } finally {
      setProcessing(false);
    }
  }, [onRefresh]);

  const handleCancelListing = useCallback(async () => {
    if (!cancelListingDialog || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_cancel_marketplace_listing' as any, {
        p_listing_id: cancelListingDialog.listingId,
        p_reason: cancelReason,
      });
      if (error) throw error;
      toast.success('Listing cancelled', { description: 'Listing has been removed from marketplace' });
      setCancelListingDialog(null);
      setCancelReason('');
      onRefresh();
    } catch (error: unknown) {
      console.error('Error cancelling listing:', error);
      toast.error(getErrorMessage(error) || 'Failed to cancel listing');
    } finally {
      setProcessing(false);
    }
  }, [cancelListingDialog, cancelReason, onRefresh]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Marketplace Management</CardTitle>
          <CardDescription>
            Manage listings, feature items, and moderate marketplace activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Store className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <p className="text-sm font-medium">No marketplace listings</p>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold">
                          Pixel {getPixelCoords(listing.pixel_id)}
                        </div>
                        <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                          {listing.status}
                        </Badge>
                        {listing.featured && (
                          <Badge variant="default" className="bg-amber-500">
                            <Star className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Seller: {getUserEmail(listing.seller_id)} ·
                        Price: ₹{listing.asking_price.toLocaleString()} ·
                        Listed: {format(new Date(listing.created_at), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {listing.status === 'active' && (
                        <>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleToggleFeatured(listing.id, listing.featured)}
                            disabled={processing}
                          >
                            <Star className="w-4 h-4 mr-1" />
                            {listing.featured ? 'Unfeature' : 'Feature'}
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setCancelListingDialog({ open: true, listingId: listing.id })}
                            disabled={processing} className="text-destructive"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Listing Dialog */}
      <AlertDialog open={!!cancelListingDialog} onOpenChange={(open) => !open && setCancelListingDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this marketplace listing? The pixel will be returned to the owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason" className="mb-2 block">Reason for cancellation</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Violation of terms..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleCancelListing(); }}
              disabled={processing}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancel Listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
