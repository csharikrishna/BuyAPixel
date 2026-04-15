import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, DollarSign, Undo2, History } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  type: 'marketplace' | 'payment';
  user_email: string;
  amount: number;
  reason?: string;
  created_at: string;
  status: 'completed' | 'pending' | 'failed';
}

interface RefundHistoryItem {
  type: string;
  id: string;
  user_email: string;
  amount: number;
  reason: string;
  processed_at: string;
  status: string;
}

export const AdminRefundTab = () => {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [searchId, setSearchId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [refundHistory, setRefundHistory] = useState<RefundHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load refund history
  useEffect(() => {
    loadRefundHistory();
  }, []);

  const loadRefundHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const { data, error } = await supabase
        .rpc('admin_get_refund_history', {
          p_days_back: 90,
          p_limit: 100,
          p_offset: 0,
        });

      if (error) throw error;
      setRefundHistory(data || []);
    } catch (err) {
      console.error('Error loading refund history:', err);
      toast.error('Failed to load refund history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const handleRefund = useCallback(async () => {
    if (!selectedTransaction || !refundReason.trim()) {
      toast.error('Please provide a refund reason');
      return;
    }

    try {
      setIsRefunding(true);

      if (selectedTransaction.type === 'marketplace') {
        const { error } = await supabase
          .rpc('admin_refund_marketplace_transaction', {
            p_transaction_id: selectedTransaction.id,
            p_reason: refundReason,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .rpc('admin_refund_payment_order', {
            p_payment_order_id: selectedTransaction.id,
            p_reason: refundReason,
          });

        if (error) throw error;
      }

      toast.success(`Refund of ₹${selectedTransaction.amount / 100} processed`);
      setIsConfirmOpen(false);
      setSelectedTransaction(null);
      setRefundReason('');
      loadRefundHistory();
    } catch (err) {
      console.error('Refund error:', err);
      toast.error('Failed to process refund');
    } finally {
      setIsRefunding(false);
    }
  }, [selectedTransaction, refundReason, loadRefundHistory]);

  const handleSearch = useCallback(async () => {
    if (!searchId.trim()) return;

    try {
      // Search in marketplace transactions
      if (activeTab === 'marketplace') {
        const { data: transaction, error } = await supabase
          .from('marketplace_transactions')
          .select('*')
          .eq('id', searchId)
          .single();

        if (error) {
          toast.error('Transaction not found');
          return;
        }

        if (transaction.refund_amount) {
          toast.error('Transaction already refunded');
          return;
        }

        setSelectedTransaction({
          id: transaction.id,
          type: 'marketplace',
          user_email: transaction.buyer_id, // Would need to join auth.users
          amount: transaction.amount,
          created_at: transaction.created_at,
          status: transaction.status as any,
        });
      }
      // Search in payment orders
      else {
        const { data: paymentOrder, error } = await supabase
          .from('payment_orders')
          .select('*')
          .eq('id', searchId)
          .single();

        if (error) {
          toast.error('Payment order not found');
          return;
        }

        if (paymentOrder.status === 'refunded') {
          toast.error('Payment order already refunded');
          return;
        }

        setSelectedTransaction({
          id: paymentOrder.id,
          type: 'payment',
          user_email: paymentOrder.user_id,
          amount: paymentOrder.amount,
          created_at: paymentOrder.created_at,
          status: paymentOrder.status,
        });
      }

      setIsConfirmOpen(true);
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Error searching transaction');
    }
  }, [searchId, activeTab]);

  return (
    <Tabs defaultValue="process" className="w-full space-y-4">
      <TabsList>
        <TabsTrigger value="process">Process Refund</TabsTrigger>
        <TabsTrigger value="history">Refund History</TabsTrigger>
      </TabsList>

      <TabsContent value="process" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5" />
              Process Refund
            </CardTitle>
            <CardDescription>
              Search for a transaction or payment order to process a refund
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="marketplace" onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
                <TabsTrigger value="payment">Direct Purchase</TabsTrigger>
              </TabsList>

              <TabsContent value="marketplace" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Marketplace Transaction ID</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter transaction UUID"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                    />
                    <Button onClick={handleSearch} disabled={!searchId.trim()}>
                      Search
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="payment" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Order ID</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter payment order UUID"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                    />
                    <Button onClick={handleSearch} disabled={!searchId.trim()}>
                      Search
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {selectedTransaction && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Amount</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ₹{(selectedTransaction.amount / 100).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <Badge variant="outline" className="capitalize">
                        {selectedTransaction.type}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Refund Reason</label>
                    <Textarea
                      placeholder="Enter reason for refund (e.g., customer requested, pixels unavailable, etc.)"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={!refundReason.trim() || isRefunding}
                    className="w-full"
                    variant="destructive"
                  >
                    Process Refund
                  </Button>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Refund History
            </CardTitle>
            <CardDescription>
              Refunds processed in the last 90 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <p className="text-center text-gray-500 py-8">Loading refund history...</p>
            ) : refundHistory.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No refunds found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>User Email</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Processed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundHistory.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {refund.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {refund.user_email}
                        </TableCell>
                        <TableCell>
                          <span className="text-red-600 font-semibold">
                            -₹{(refund.amount / 100).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {refund.reason}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(refund.processed_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Refund Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Refund</DialogTitle>
            <DialogDescription>
              Are you sure you want to process this refund?
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Refunding ₹{(selectedTransaction.amount / 100).toFixed(2)}</p>
                  <p className="text-sm text-red-800 mt-1">
                    {selectedTransaction.type === 'marketplace'
                      ? 'Pixel will be returned to seller'
                      : 'Pixels will be released and unassigned'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Reason:</p>
                <p className="text-sm p-2 bg-gray-100 rounded border">
                  {refundReason}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={isRefunding}
            >
              {isRefunding ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
};
