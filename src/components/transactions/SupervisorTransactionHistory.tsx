import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useLoadingState } from '@/hooks/use-loading-state';
import { formatCurrency } from '@/lib/utils';

interface SupervisorTransactionHistoryProps {
  siteId: string;
  isAdminView?: boolean;
  onTransactionsUpdate?: () => void;
}

export function SupervisorTransactionHistory({ 
  siteId,
  isAdminView = false,
  onTransactionsUpdate
}: SupervisorTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useLoadingState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!siteId) return;
    
    try {
      setIsLoading(true);
      console.log('Fetching supervisor transactions for site:', siteId);
      
      const { data, error } = await supabase
        .from('supervisor_transactions')
        .select(`
          *,
          payer_supervisor:users!supervisor_transactions_payer_supervisor_id_fkey(name),
          receiver_supervisor:users!supervisor_transactions_receiver_supervisor_id_fkey(name),
          payer_site:sites!supervisor_transactions_payer_site_id_fkey(name),
          receiver_site:sites!supervisor_transactions_receiver_site_id_fkey(name)
        `)
        .or(`payer_site_id.eq.${siteId},receiver_site_id.eq.${siteId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error.message);
        toast.error('Failed to load transaction history');
        return;
      }

      console.log('Fetched supervisor transactions:', data);
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error in fetchTransactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  }, [siteId, setIsLoading]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete || !siteId) return;
    
    try {
      // Get transaction details before deletion
      const { data: transactionData, error: transactionError } = await supabase
        .from('supervisor_transactions')
        .select('*')
        .eq('id', transactionToDelete)
        .single();
        
      if (transactionError) {
        console.error('Error fetching transaction for deletion:', transactionError);
        toast.error('Failed to find transaction details');
        return;
      }
      
      // Delete the transaction
      const { error } = await supabase
        .from('supervisor_transactions')
        .delete()
        .eq('id', transactionToDelete);

      if (error) {
        console.error('Error deleting transaction:', error);
        toast.error('Failed to delete transaction');
        return;
      }

      // Update site financial summary based on transaction type
      if (transactionData) {
        const { error: updateError } = await supabase
          .rpc('update_site_financial_summary_for_id', { site_id_param: siteId });
          
        if (updateError) {
          console.error('Error updating financial summary:', updateError);
          // Continue with UI update even if financial summary update fails
        }
      }

      // Update UI directly
      setTransactions(prev => prev.filter(transaction => transaction.id !== transactionToDelete));
      toast.success('Transaction deleted successfully');
      
      // Notify parent to refresh financial data
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
    } catch (error: any) {
      console.error('Error in handleDeleteTransaction:', error);
      toast.error('An error occurred while deleting the transaction');
    } finally {
      setTransactionToDelete(null);
      setShowDeleteDialog(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setTransactionToDelete(id);
    setShowDeleteDialog(true);
  };

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'advance_paid':
        return 'Advance Paid';
      case 'funds_received':
        return 'Funds Received';
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'advance_paid':
        return 'bg-red-100 text-red-800';
      case 'funds_received':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supervisor Transactions</CardTitle>
        <CardDescription>Direct transactions between site supervisor and head office</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No supervisor transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {isAdminView && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{new Date(transaction.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {transaction.payer_site?.name || '-'} ({transaction.payer_supervisor?.name || 'Unknown'})
                    </TableCell>
                    <TableCell>
                      {transaction.receiver_site?.name || '-'} ({transaction.receiver_supervisor?.name || 'Unknown'})
                    </TableCell>
                    <TableCell>
                      <Badge className={getTransactionTypeColor(transaction.transaction_type)} variant="outline">
                        {formatTransactionType(transaction.transaction_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    {isAdminView && (
                      <TableCell>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteClick(transaction.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the transaction and update the financial summary.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTransaction}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
