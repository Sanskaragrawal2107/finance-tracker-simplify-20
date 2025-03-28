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

interface AdvanceListProps {
  siteId: string;
  userRole: UserRole;
  isAdminView?: boolean;
  initialAdvances?: any[];
  onTransactionsUpdate?: () => void;
}

export function AdvanceList({
  siteId,
  userRole,
  isAdminView,
  initialAdvances,
  onTransactionsUpdate
}: AdvanceListProps) {
  const [advances, setAdvances] = useState(initialAdvances || []);
  const [isLoading, setIsLoading] = useLoadingState(!initialAdvances);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);

  const fetchAdvances = useCallback(async () => {
    if (!siteId) return;
    
    try {
      setIsLoading(true);
      console.log('Fetching advances for site:', siteId);
      
      const { data, error } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      console.log('Fetched advances:', data);
      setAdvances(data || []);
    } catch (error) {
      console.error('Error fetching advances:', error);
      toast.error('Failed to load advances');
    } finally {
      setIsLoading(false);
    }
  }, [siteId, setIsLoading]);

  useEffect(() => {
    if (initialAdvances) {
      setAdvances(initialAdvances);
    } else {
      fetchAdvances();
    }
  }, [fetchAdvances, initialAdvances]);

  const handleDeleteAdvance = async () => {
    if (!selectedAdvanceId) return;
    
    try {
      // Get advance details before deletion
      const { data: advanceData, error: advanceError } = await supabase
        .from('advances')
        .select('*')
        .eq('id', selectedAdvanceId)
        .single();
        
      if (advanceError) {
        throw advanceError;
      }
      
      // Delete the advance
      const { error } = await supabase
        .from('advances')
        .delete()
        .eq('id', selectedAdvanceId);
        
      if (error) throw error;
      
      // Update site financial summary to reflect the deletion
      const { error: updateError } = await supabase
        .rpc('update_site_financial_summary_for_id', { site_id_param: siteId });
        
      if (updateError) {
        console.error('Error updating financial summary:', updateError);
        // Continue with UI update even if financial summary update fails
      }
      
      // Update UI directly
      setAdvances(prevAdvances => prevAdvances.filter(advance => advance.id !== selectedAdvanceId));
      toast.success('Advance deleted successfully');
      
      // Notify parent component to refresh financial data
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
    } catch (error) {
      console.error('Error deleting advance:', error);
      toast.error('Failed to delete advance');
    } finally {
      setShowDeleteDialog(false);
      setSelectedAdvanceId(null);
    }
  };

  const showDeleteConfirmation = (advanceId: string) => {
    setSelectedAdvanceId(advanceId);
    setShowDeleteDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const showDeleteButton = userRole === UserRole.ADMIN || isAdminView;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advances</CardTitle>
        <CardDescription>View all advance payments for this site</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : advances.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No advances found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {showDeleteButton && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell>{format(new Date(advance.date), 'PPP')}</TableCell>
                    <TableCell>
                      {advance.recipient_name}
                      <Badge className="ml-2" variant="outline">
                        {advance.recipient_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{advance.purpose}</TableCell>
                    <TableCell>{advance.remarks || '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(advance.amount)}
                    </TableCell>
                    {showDeleteButton && (
                      <TableCell>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => showDeleteConfirmation(advance.id)}
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
                This action cannot be undone. This will permanently delete the advance and remove the associated financial data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedAdvanceId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAdvance}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
