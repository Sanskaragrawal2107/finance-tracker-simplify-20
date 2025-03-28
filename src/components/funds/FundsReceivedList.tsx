import React, { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(!initialFundsReceived);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialFundsReceived) {
      fetchFundsReceived();
    }
  }, [siteId]);

  const fetchFundsReceived = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      setFundsReceived(data || []);
    } catch (error) {
      console.error('Error fetching funds received:', error);
      toast.error('Failed to load funds received');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFund = async () => {
    if (!selectedFundId) return;
    
    try {
      const { error } = await supabase
        .from('funds_received')
        .delete()
        .eq('id', selectedFundId);
        
      if (error) throw error;
      
      toast.success('Funds record deleted successfully');
      // Refresh the funds list
      fetchFundsReceived();
      // Update parent component
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

  if (loading) {
    return <div>Loading funds received...</div>;
  }

  const showDeleteButton = userRole === UserRole.ADMIN || isAdminView;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {showDeleteButton && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fundsReceived.length > 0 ? (
              fundsReceived.map((fund) => (
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
                    ₹{Number(fund.amount).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  {showDeleteButton && (
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        onClick={() => showDeleteConfirmation(fund.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={showDeleteButton ? 6 : 5} className="text-center">
                  No funds received found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this funds received record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteFund}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
