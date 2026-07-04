import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users, Ban, Trash2, Unlock, AlertTriangle, Loader2, Search,
  Download, Filter, UserCheck, Calendar, MoreVertical, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/utils';
import { useAdminUsers, useAdminStats } from '@/hooks/useAdminData';
import { Skeleton } from '@/components/ui/skeleton';

// Re-export so the parent can use the same type
export interface User {
  user_id: string;
  email: string;
  full_name: string | null;
  pixel_count: number;
  total_spent: number;
  is_blocked: boolean;
  created_at: string;
  last_active_at: string | null;
}

type UserFilter = 'all' | 'active' | 'blocked' | 'paid';
type SortField = 'created_at' | 'pixels_owned' | 'total_spent';
type SortOrder = 'asc' | 'desc';

interface AdminUsersTabProps {
  onRefresh?: () => void;
}

export function AdminUsersTab({ onRefresh }: AdminUsersTabProps) {
  const { data: users = [], isLoading: loadingUsers, refetch: refetchUsers } = useAdminUsers();
  const { data: stats = { activeUsers: 0, blockedUsers: 0, paidUsers: 0 }, isLoading: loadingStats } = useAdminStats();

  const handleRefresh = useCallback(() => {
    refetchUsers();
    if (onRefresh) onRefresh();
  }, [refetchUsers, onRefresh]);

  // --- Local state ---
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [processing, setProcessing] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'block' | 'unblock' | 'export' | 'delete' | null>(null);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState<boolean>(false);
  const [exportCooldown, setExportCooldown] = useState(0);

  // Dialog states
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; userId: string; email: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: string; email: string } | null>(null);
  const [resetUserPixelsDialog, setResetUserPixelsDialog] = useState<{ open: boolean; userId: string; email: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockNotes, setBlockNotes] = useState('');

  const deferredSearchTerm = useDeferredValue(searchTerm);

  // --- Filtered / sorted users ---
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter(u =>
      u.email.toLowerCase().includes(deferredSearchTerm.toLowerCase())
    );

    switch (userFilter) {
      case 'active':
        filtered = filtered.filter(u => !u.is_blocked);
        break;
      case 'blocked':
        filtered = filtered.filter(u => u.is_blocked);
        break;
      case 'paid':
        filtered = filtered.filter(u => u.total_spent > 0);
        break;
    }

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === bVal) return 0;
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
  }, [users, deferredSearchTerm, userFilter, sortField, sortOrder]);

  // --- Export ---
  const exportUsers = useCallback(() => {
    if (exportCooldown > 0) { toast.error('Please wait before exporting again'); return; }
    if (users.length === 0) { toast.error('No users to export'); return; }

    try {
      const csv = [
        ['Email', 'Full Name', 'Status', 'Joined', 'Last Active', 'Pixels Owned', 'Total Spent'].join(','),
        ...users.map(u => [
          `"${u.email}"`,
          `"${u.full_name || ''}"`,
          u.is_blocked ? 'Blocked' : 'Active',
          format(new Date(u.created_at), 'yyyy-MM-dd HH:mm:ss'),
          u.last_active_at ? format(new Date(u.last_active_at), 'yyyy-MM-dd HH:mm:ss') : 'Never',
          u.pixel_count,
          u.total_spent,
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Users exported', { description: `${users.length} users exported to CSV` });

      setExportCooldown(5);
      const interval = setInterval(() => {
        setExportCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (error: unknown) {
      console.error('Export failed:', error);
      toast.error('Failed to export users');
    }
  }, [users, exportCooldown]);

  // --- Action handlers ---
  const handleBlockUser = useCallback(async () => {
    if (!blockDialog || !blockReason.trim()) {
      toast.error('Please provide a reason for blocking');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_block_user', {
        p_user_id: blockDialog.userId,
        p_reason: blockReason,
      });
      if (error) throw error;
      toast.success('User blocked successfully', {
        description: `${blockDialog.email} can no longer access the platform`,
      });
      setBlockDialog(null);
      setBlockReason('');
      setBlockNotes('');
      handleRefresh();
    } catch (error: unknown) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user', { description: getErrorMessage(error) });
    } finally {
      setProcessing(false);
    }
  }, [blockDialog, blockReason, blockNotes, onRefresh]);

  const handleUnblockUser = useCallback(async (userId: string, email: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_unblock_user', { p_user_id: userId });
      if (error) throw error;
      toast.success('User unblocked', { description: `${email} can now access the platform` });
      handleRefresh();
    } catch (error: unknown) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user', { description: getErrorMessage(error) });
    } finally {
      setProcessing(false);
    }
  }, [onRefresh]);

  const handleDeleteUser = useCallback(async () => {
    if (!deleteDialog) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('delete_user_completely', {
        target_user_id: deleteDialog.userId,
      });
      if (error) throw error;
      toast.success('User data deleted', {
        description: 'All associated data has been permanently removed',
        duration: 8000,
      });
      setDeleteDialog(null);
      handleRefresh();
    } catch (error: unknown) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user', { description: getErrorMessage(error) });
    } finally {
      setProcessing(false);
    }
  }, [deleteDialog, onRefresh]);

  const handleResetUserPixels = useCallback(async () => {
    if (!resetUserPixelsDialog) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('pixels')
        .update({ owner_id: null, image_url: null, link_url: null, alt_text: null, purchased_at: null, price_paid: null })
        .eq('owner_id', resetUserPixelsDialog.userId);
      if (error) throw error;
      toast.success('All user pixels reset', {
        description: `Pixels owned by ${resetUserPixelsDialog.email} are now available for purchase.`,
      });
      setResetUserPixelsDialog(null);
      handleRefresh();
    } catch (error: unknown) {
      console.error('Error resetting user pixels:', error);
      toast.error('Failed to reset user pixels', { description: getErrorMessage(error) });
    } finally {
      setProcessing(false);
    }
  }, [resetUserPixelsDialog, onRefresh]);

  // --- Bulk actions ---
  const handleBulkAction = async () => {
    if (selectedUsers.size === 0 || !bulkAction) return;
    
    if (bulkAction === 'delete') {
      setBulkDeleteDialog(true);
      return;
    }

    setProcessing(true);
    const userIds = Array.from(selectedUsers);

    try {
      switch (bulkAction) {
        case 'block':
          await Promise.all(userIds.map(id => supabase.rpc('admin_block_user', { p_user_id: id, p_reason: 'Bulk action' })));
          toast.success(`${userIds.length} users blocked`);
          break;
        case 'unblock':
          await Promise.all(userIds.map(id => supabase.rpc('admin_unblock_user', { p_user_id: id })));
          toast.success(`${userIds.length} users unblocked`);
          break;
        case 'export': {
          const usersToExport = users.filter(u => userIds.includes(u.user_id));
          const csv = [
            ['Email', 'Status', 'Joined', 'Last Active', 'Pixels Owned', 'Total Spent'].join(','),
            ...usersToExport.map(u => [
              `"${u.email}"`,
              u.is_blocked ? 'Blocked' : 'Active',
              format(new Date(u.created_at), 'yyyy-MM-dd HH:mm:ss'),
              u.last_active_at ? format(new Date(u.last_active_at), 'yyyy-MM-dd HH:mm:ss') : 'Never',
              u.pixel_count,
              u.total_spent,
            ].join(','))
          ].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `selected_users_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          break;
        }
      }
      setSelectedUsers(new Set());
      setBulkAction(null);
      handleRefresh();
    } catch (error: unknown) {
      toast.error('Bulk action failed', { description: getErrorMessage(error) });
    } finally {
      setProcessing(false);
    }
  };

  const confirmBulkDelete = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setProcessing(true);
    const userIds = Array.from(selectedUsers);

    try {
      // Process sequentially to prevent database deadlocks from concurrent cascading deletes
      for (const id of userIds) {
        const { error } = await supabase.rpc('delete_user_completely', { target_user_id: id });
        if (error) throw error;
      }
      toast.success(`${userIds.length} users permanently deleted`);
      setSelectedUsers(new Set());
      setBulkAction(null);
      setBulkDeleteDialog(false);
      handleRefresh();
    } catch (error: unknown) {
      toast.error('Bulk deletion failed', { description: getErrorMessage(error) });
      setBulkDeleteDialog(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>User Management</CardTitle>
              {loadingUsers ? (
                <Skeleton className="h-4 w-40 mt-1" />
              ) : (
                <CardDescription>
                  Showing {filteredAndSortedUsers.length} of {users.length} users
                </CardDescription>
              )}
            </div>
            <Button
              onClick={handleBulkAction}
              variant={bulkAction ? 'default' : 'outline'}
              size="sm"
              className="gap-2 w-full lg:w-auto"
              disabled={selectedUsers.size === 0 || !bulkAction}
            >
              Run Bulk Action
            </Button>
            <Select value={bulkAction || ''} onValueChange={(v) => setBulkAction(v as 'block' | 'unblock' | 'export' | 'delete')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Bulk Actions..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Block Selected</SelectItem>
                <SelectItem value="unblock">Unblock Selected</SelectItem>
                <SelectItem value="export">Export Selected</SelectItem>
                <SelectItem value="delete" className="text-red-500">Delete Selected</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportUsers} variant="outline" size="sm" className="gap-2 w-full lg:w-auto">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={userFilter} onValueChange={(v) => setUserFilter(v as UserFilter)}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users ({users.length})</SelectItem>
                <SelectItem value="active">Active Only ({stats.activeUsers})</SelectItem>
                <SelectItem value="blocked">Blocked Only ({stats.blockedUsers})</SelectItem>
                <SelectItem value="paid">Paid Users ({stats.paidUsers})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={`${sortField}-${sortOrder}`} onValueChange={(v) => {
              const [field, order] = v.split('-');
              setSortField(field as SortField);
              setSortOrder(order as SortOrder);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Newest First</SelectItem>
                <SelectItem value="created_at-asc">Oldest First</SelectItem>
                <SelectItem value="pixels_owned-desc">Most Pixels</SelectItem>
                <SelectItem value="pixels_owned-asc">Least Pixels</SelectItem>
                <SelectItem value="total_spent-desc">Highest Spend</SelectItem>
                <SelectItem value="total_spent-asc">Lowest Spend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers(new Set(filteredAndSortedUsers.map(u => u.user_id)));
                          } else {
                            setSelectedUsers(new Set());
                          }
                        }}
                        className="rounded border-gray-300 accent-primary w-4 h-4 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="min-w-[200px]">User</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[120px]">Joined</TableHead>
                    <TableHead className="text-right min-w-[80px]">Pixels</TableHead>
                    <TableHead className="text-right hidden sm:table-cell min-w-[100px]">Spent</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="text-right min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredAndSortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40">
                        <div className="flex flex-col items-center justify-center text-center">
                          <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                          <p className="text-sm font-medium text-muted-foreground">No users found</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {searchTerm || userFilter !== 'all'
                              ? 'Try adjusting your filters'
                              : 'No users registered yet'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedUsers.map((userData) => (
                      <TableRow key={userData.user_id} className="hover:bg-muted/50">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(userData.user_id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedUsers);
                              if (e.target.checked) newSelected.add(userData.user_id);
                              else newSelected.delete(userData.user_id);
                              setSelectedUsers(newSelected);
                            }}
                            className="rounded border-gray-300 accent-primary w-4 h-4 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{userData.email}</span>
                            <span className="text-xs text-muted-foreground md:hidden">
                              {format(new Date(userData.created_at), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(userData.created_at), 'MMM dd, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {userData.pixel_count}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums hidden sm:table-cell">
                          ₹{(userData.total_spent || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {userData.is_blocked ? (
                            <Badge variant="destructive" className="gap-1.5 font-medium">
                              <Ban className="w-3 h-3" />
                              Blocked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-700 border-green-500/20 font-medium">
                              <UserCheck className="w-3 h-3" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Desktop Actions */}
                          <div className="hidden sm:flex items-center justify-end gap-2">
                            {userData.is_blocked ? (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => handleUnblockUser(userData.user_id, userData.email)}
                                disabled={processing} className="h-8 gap-1.5"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">Unblock</span>
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => setResetUserPixelsDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                  disabled={processing || userData.pixel_count === 0}
                                  className="h-8 w-8 p-0" title="Reset all pixels"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => setBlockDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                  disabled={processing} className="h-8 gap-1.5"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">Block</span>
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm" variant="outline"
                              onClick={() => setDeleteDialog({ open: true, userId: userData.user_id, email: userData.email })}
                              disabled={processing}
                              className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          {/* Mobile Dropdown */}
                          <div className="sm:hidden flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {userData.is_blocked ? (
                                  <DropdownMenuItem
                                    onClick={() => handleUnblockUser(userData.user_id, userData.email)}
                                    disabled={processing}
                                  >
                                    <Unlock className="w-4 h-4 mr-2" />
                                    Unblock User
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => setBlockDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                    disabled={processing}
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Block User
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => setResetUserPixelsDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                  disabled={processing || userData.pixel_count === 0}
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Reset All Pixels
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                  disabled={processing}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Block User Dialog */}
      <Dialog open={blockDialog?.open || false} onOpenChange={(open) => !open && setBlockDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Ban className="w-5 h-5 text-destructive" />
              </div>
              Block User Account
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="mb-2">
                  Blocking <strong>{blockDialog?.email}</strong> will prevent them from:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Signing in to their account</li>
                  <li>Accessing any platform features</li>
                  <li>Making new purchases</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="block-reason" className="text-sm font-medium">
                Reason for blocking <span className="text-destructive">*</span>
              </Label>
              <Input
                id="block-reason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Violated terms of service"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-notes" className="text-sm font-medium">
                Additional notes (optional)
              </Label>
              <Textarea
                id="block-notes"
                value={blockNotes}
                onChange={(e) => setBlockNotes(e.target.value)}
                placeholder="Internal notes about this action..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBlockDialog(null)} disabled={processing} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlockUser}
              disabled={processing || !blockReason.trim()}
              className="gap-2 w-full sm:w-auto"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Block User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialog?.open || false} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Permanent Account Deletion
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete <strong className="text-foreground">{deleteDialog?.email}</strong> and all associated data:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All owned pixels (will become available again)</li>
                  <li>User profile and preferences</li>
                  <li>Purchase and transaction history</li>
                  <li>Account status and blocks</li>
                </ul>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="font-semibold text-destructive flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    This action cannot be undone!
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive hover:bg-destructive/90"
              disabled={processing}
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialog} onOpenChange={setBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete {selectedUsers.size} Users Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  You are about to permanently delete <strong>{selectedUsers.size} users</strong>. This action CANNOT be undone.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>User accounts and authentication records will be deleted.</li>
                  <li>All pixels owned by these users will be cleared.</li>
                  <li>Database records (profiles) will be wiped out.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={processing}
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete {selectedUsers.size} Users
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset User Pixels Dialog */}
      <AlertDialog open={!!resetUserPixelsDialog?.open} onOpenChange={(open) => !open && setResetUserPixelsDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All User Pixels?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove ownership of ALL pixels owned by <strong>{resetUserPixelsDialog?.email}</strong>.
              The pixels will become available for purchase again. The user account will remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleResetUserPixels(); }}
              disabled={processing}
            >
              {processing ? 'Resetting...' : 'Reset All Pixels'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
