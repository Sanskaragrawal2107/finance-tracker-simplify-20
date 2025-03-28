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
  const [loading, setLoading] = useState(!initialAdvances);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialAdvances) {
      fetchAdvances();
    }
  }, [siteId]);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      setAdvances(data || []);
    } catch (error) {
      console.error('Error fetching advances:', error);
      toast.error('Failed to load advances');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdvance = async () => {
    if (!selectedAdvanceId) return;
    
    try {
      const { error } = await supabase
        .from('advances')
        .delete()
        .eq('id', selectedAdvanceId);
        
      if (error) throw error;
      
      toast.success('Advance deleted successfully');
      // Refresh the advances list
      fetchAdvances();
      // Update parent component
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

  if (loading) {
    return <div>Loading advances...</div>;
  }

  const showDeleteButton = userRole === UserRole.ADMIN || isAdminView;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {showDeleteButton && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.length > 0 ? (
              advances.map((advance) => (
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
                    ₹{Number(advance.amount).toLocaleString('en-IN', {
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
                        onClick={() => showDeleteConfirmation(advance.id)}
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
                  No advances found
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
              This action will permanently delete this advance. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAdvance}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
