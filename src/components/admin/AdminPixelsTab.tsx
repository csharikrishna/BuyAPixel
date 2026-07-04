import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Ban, Trash2, Loader2, Search, Image, TrendingUp,
  Eye, MoreVertical, LayoutGrid, List as ListIcon, RefreshCw, Network
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminPixels, useAdminUsers } from '@/hooks/useAdminData';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminPixelsTabProps {}

export function AdminPixelsTab({}: AdminPixelsTabProps) {
  const { data: pixels = [], isLoading: loadingPixels, refetch: refetchPixels } = useAdminPixels();
  const { data: users = [] } = useAdminUsers();

  const getUserEmail = useCallback((userId: string) => {
    const u = users.find(u => u.user_id === userId);
    return u ? u.email : 'Unknown';
  }, [users]);

  const getUserName = useCallback((userId: string) => {
    const u = users.find(u => u.user_id === userId);
    return u ? (u.full_name || 'User') : 'Unknown';
  }, [users]);

  const [pixelSearchTerm, setPixelSearchTerm] = useState('');
  const [pixelViewMode, setPixelViewMode] = useState<'list' | 'grid'>('grid');
  const [isGrouped, setIsGrouped] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<any[] | null>(null);
  const [resetPixelDialog, setResetPixelDialog] = useState<{ open: boolean; pixelId: string } | null>(null);
  const [clearContentDialog, setClearContentDialog] = useState<{ open: boolean; pixelId: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  const displayedPixels = useMemo(() => {
    let filtered = pixels;
    
    // Apply local search filtering
    if (pixelSearchTerm.trim()) {
      const term = pixelSearchTerm.toLowerCase();
      if (term.includes(',')) {
        const [x, y] = term.split(',').map(s => parseInt(s.trim()));
        if (!isNaN(x) && !isNaN(y)) {
          filtered = filtered.filter(p => p.x === x && p.y === y);
        }
      } else {
        filtered = filtered.filter(p => 
          p.id.toLowerCase().includes(term) || 
          (p.owner_id && p.owner_id.toLowerCase().includes(term))
        );
      }
    }

    if (!isGrouped) return filtered;
    
    const groups = new Map<string, any[]>();
    filtered.forEach(p => {
      const key = (p.image_url || 'no-image') + '|' + (p.link_url || 'no-link') + '|' + (p.owner_id || 'no-owner');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });
    
    return Array.from(groups.entries()).map(([key, groupPixels]) => {
      if (groupPixels.length === 1) return groupPixels[0];
      return {
        ...groupPixels[0],
        id: `group-${key}`,
        isGroup: true,
        count: groupPixels.length,
        children: groupPixels,
      };
    });
  }, [pixels, isGrouped, pixelSearchTerm]);


  const handleResetPixelOwnership = useCallback(async () => {
    if (!resetPixelDialog) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('pixels')
        .update({ owner_id: null, image_url: null, link_url: null, alt_text: null, purchased_at: null, price_paid: null })
        .eq('id', resetPixelDialog.pixelId);
      if (error) throw error;
      toast.success('Pixel ownership reset to system');
      setResetPixelDialog(null);
      refetchPixels();
    } catch (error) {
      console.error('Error resetting pixel:', error);
      toast.error('Failed to reset pixel: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  }, [resetPixelDialog, refetchPixels]);

  const handleClearPixelContent = useCallback(async () => {
    if (!clearContentDialog) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('pixels')
        .update({ image_url: null, link_url: null, alt_text: null })
        .eq('id', clearContentDialog.pixelId);
      if (error) throw error;
      toast.success('Pixel content cleared (Moderated)');
      setClearContentDialog(null);
      refetchPixels();
    } catch (error) {
      console.error('Error clearing pixel content:', error);
      toast.error('Failed to clear content: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  }, [clearContentDialog, refetchPixels]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Purchased Pixels</CardTitle>
          {loadingPixels ? (
            <Skeleton className="h-4 w-40 mt-1" />
          ) : (
            <CardDescription>
              {displayedPixels.length} items found {isGrouped ? '(Grouped)' : ''}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by Pixel ID, Owner ID, or 'x,y'..."
              value={pixelSearchTerm}
              onChange={(e) => setPixelSearchTerm(e.target.value)}
            />
            <div className="flex items-center gap-2 px-3 border rounded-md bg-muted/50">
              <Switch id="group-mode" checked={isGrouped} onCheckedChange={setIsGrouped} />
              <Label htmlFor="group-mode" className="text-sm cursor-pointer whitespace-nowrap">Group Similar</Label>
            </div>
            <div className="flex bg-muted rounded-md p-1 border">
              <Button
                variant={pixelViewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm" className="h-8 w-8 p-0"
                onClick={() => setPixelViewMode('list')}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={pixelViewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm" className="h-8 w-8 p-0"
                onClick={() => setPixelViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {pixelViewMode === 'list' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPixels ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : displayedPixels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                      No purchased pixels found.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedPixels.map((pixel) => (
                    <TableRow key={pixel.id}>
                      <TableCell className="font-mono">
                        {pixel.isGroup ? <Badge variant="secondary">{pixel.count} Pixels</Badge> : `(${pixel.x}, ${pixel.y})`}
                      </TableCell>
                      <TableCell>
                        {pixel.owner_id ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{getUserName(pixel.owner_id)}</span>
                            <span className="text-xs text-muted-foreground">{getUserEmail(pixel.owner_id)}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{pixel.owner_id}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">System / Available</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {pixel.image_url ? (
                            <div className="flex items-center gap-2 text-xs text-green-600">
                              <Image className="w-3 h-3" /> Image Set
                            </div>
                          ) : <div className="text-xs text-muted-foreground">No Image</div>}
                          {pixel.link_url && (
                            <div className="flex items-center gap-2 text-xs text-blue-600 truncate max-w-[150px]">
                              <TrendingUp className="w-3 h-3" /> {pixel.link_url}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {pixel.isGroup ? (
                          <Button variant="outline" size="sm" onClick={() => setSelectedGroup(pixel.children)}>
                            <Network className="w-4 h-4 mr-2" />
                            View Group
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/?x=${pixel.x}&y=${pixel.y}`, '_blank')}>
                                <Eye className="mr-2 h-4 w-4" />
                                View on Canvas
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-amber-600"
                                onClick={() => setClearContentDialog({ open: true, pixelId: pixel.id })}
                                disabled={!pixel.image_url && !pixel.link_url}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Clear Content
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setResetPixelDialog({ open: true, pixelId: pixel.id })}
                                disabled={!pixel.owner_id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Reset Ownership
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayedPixels.length === 0 && !loadingPixels && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No pixels found.
                </div>
              )}
              {displayedPixels.map((pixel) => (
                <Card key={pixel.id} className="overflow-hidden group relative hover:ring-2 hover:ring-primary/50 transition-all">
                  <div className="aspect-square bg-muted/20 relative">
                    {pixel.image_url ? (
                      <img src={pixel.image_url} alt={pixel.alt_text} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <Image className="w-8 h-8" />
                      </div>
                    )}
                    {pixel.isGroup && (
                      <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground shadow-md z-10">
                        x{pixel.count}
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 z-20">
                      {pixel.isGroup ? (
                        <Button
                          size="sm" variant="secondary" className="w-full h-8 text-xs"
                          onClick={() => setSelectedGroup(pixel.children)}
                        >
                          <Network className="w-3 h-3 mr-1" /> View Group
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm" variant="secondary" className="w-full h-8 text-xs"
                            onClick={() => window.open(`/?x=${pixel.x}&y=${pixel.y}`, '_blank')}
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button
                            size="sm" variant="destructive" className="w-full h-8 text-xs"
                            onClick={() => setClearContentDialog({ open: true, pixelId: pixel.id })}
                            disabled={!pixel.image_url}
                          >
                            <Ban className="w-3 h-3 mr-1" /> Clear
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="w-full h-8 text-xs bg-transparent text-white border-white/50 hover:bg-white/20"
                            onClick={() => setResetPixelDialog({ open: true, pixelId: pixel.id })}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Reset
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-2 border-t">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-muted-foreground">
                        {pixel.isGroup ? `Group of ${pixel.count}` : `(${pixel.x}, ${pixel.y})`}
                      </span>
                      {pixel.owner_id ? (
                        <Badge variant="outline" className="h-4 px-1 text-[10px] border-green-500/30 text-green-600">Owned</Badge>
                      ) : (
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">Free</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Pixel Dialog */}
      <AlertDialog open={!!resetPixelDialog?.open} onOpenChange={(open) => !open && setResetPixelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Pixel Ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the current owner and make the pixel available for purchase again.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleResetPixelOwnership(); }}
              disabled={processing}
            >
              {processing ? 'Resetting...' : 'Reset Ownership'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Content Dialog */}
      <AlertDialog open={!!clearContentDialog?.open} onOpenChange={(open) => !open && setClearContentDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Pixel Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the image, link, and alt text from the pixel, but the user will retain ownership.
              Useful for moderation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => { e.preventDefault(); handleClearPixelContent(); }}
              disabled={processing}
            >
              {processing ? 'Clearing...' : 'Clear Content'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grouped Pixels ({selectedGroup?.length})</DialogTitle>
          </DialogHeader>
          <Table>
             <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
             </TableHeader>
             <TableBody>
               {selectedGroup?.map((p) => (
                 <TableRow key={p.id}>
                   <TableCell className="font-mono">({p.x}, {p.y})</TableCell>
                   <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => window.open(`/?x=${p.x}&y=${p.y}`, '_blank')}>
                          View
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelectedGroup(null); setClearContentDialog({ open: true, pixelId: p.id }); }} disabled={!p.image_url && !p.link_url}>
                          Clear
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedGroup(null); setResetPixelDialog({ open: true, pixelId: p.id }); }}>
                          Reset
                        </Button>
                      </div>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
