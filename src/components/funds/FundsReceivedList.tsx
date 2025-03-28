import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useLoadingState } from '@/hooks/use-loading-state';
import { formatCurrency } from '@/lib/utils';

interface FundsReceivedListProps {
  siteId: string;
  userRole: UserRole;
  isAdminView?: boolean;
  initialFundsReceived?: any[];
  onTransactionsUpdate?: () => void;
}

export function FundsReceivedList({
  siteId,
  userRole,
  isAdminView,
  initialFundsReceived,
  onTransactionsUpdate
}: FundsReceivedListProps) {
  const [fundsReceived, setFundsReceived] = useState(initialFundsReceived || []);
  const [isLoading, setIsLoading] = useLoadingState(!initialFundsReceived);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);

  const fetchFundsReceived = useCallback(async () => {
    if (!siteId) return;
    
    try {
      setIsLoading(true);
      console.log('Fetching funds received for site:', siteId);
      
      const { data, error } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      console.log('Fetched funds received:', data);
      setFundsReceived(data || []);
    } catch (error) {
      console.error('Error fetching funds received:', error);
      toast.error('Failed to load funds received');
    } finally {
      setIsLoading(false);
    }
  }, [siteId, setIsLoading]);

  useEffect(() => {
    if (initialFundsReceived) {
      setFundsReceived(initialFundsReceived);
    } else {
      fetchFundsReceived();
    }
  }, [fetchFundsReceived, initialFundsReceived]);

  const handleDeleteFund = async () => {
    if (!selectedFundId) return;
    
    try {
      // Get fund details before deletion
      const { data: fundData, error: fundError } = await supabase
        .from('funds_received')
        .select('*')
        .eq('id', selectedFundId)
        .single();
        
      if (fundError) {
        throw fundError;
      }
      
      // Delete the fund
      const { error } = await supabase
        .from('funds_received')
        .delete()
        .eq('id', selectedFundId);
        
      if (error) throw error;
      
      // Update site financial summary to reflect the deletion
      const { error: updateError } = await supabase
        .rpc('update_site_financial_summary_for_id', { site_id_param: siteId });
        
      if (updateError) {
        console.error('Error updating financial summary:', updateError);
        // Continue with UI update even if financial summary update fails
      }
      
      // Update UI directly
      setFundsReceived(prevFunds => prevFunds.filter(fund => fund.id !== selectedFundId));
      toast.success('Funds record deleted successfully');
      
      // Notify parent component to refresh financial data
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
    } catch (error) {
      console.error('Error deleting funds record:', error);
      toast.error('Failed to delete funds record');
    } finally {
      setShowDeleteDialog(false);
      setSelectedFundId(null);
    }
  };

  const showDeleteConfirmation = (fundId: string) => {
    setSelectedFundId(fundId);
    setShowDeleteDialog(true);
  };

  const showDeleteButton = userRole === UserRole.ADMIN || isAdminView;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funds Received</CardTitle>
        <CardDescription>View all funds received transactions for this site</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : fundsReceived.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No funds received found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {showDeleteButton && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundsReceived.map((fund) => (
                  <TableRow key={fund.id}>
                    <TableCell>{format(new Date(fund.date), 'PPP')}</TableCell>
                    <TableCell>{fund.method || 'N/A'}</TableCell>
                    <TableCell>{fund.reference || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {fund.source || 'HEAD_OFFICE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(fund.amount)}
                    </TableCell>
                    {showDeleteButton && (
                      <TableCell>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => showDeleteConfirmation(fund.id)}
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
                This action cannot be undone. This will permanently delete the funds record and remove the associated financial data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedFundId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteFund}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
