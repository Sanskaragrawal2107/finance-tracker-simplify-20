import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useLoadingState } from '@/hooks/use-loading-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { formatCurrency } from '@/lib/utils';

interface ExpenseListProps {
  siteId: string;
  userRole?: UserRole;
  isAdminView?: boolean;
  initialExpenses?: any[];
  onTransactionsUpdate?: () => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ 
  siteId,
  userRole = UserRole.ADMIN,
  isAdminView = false,
  initialExpenses,
  onTransactionsUpdate
}) => {
  const [expenses, setExpenses] = useState<any[]>(initialExpenses || []);
  const [isLoading, setIsLoading] = useLoadingState(initialExpenses ? false : true);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);

  const fetchExpenses = useCallback(async () => {
    if (!siteId) return;
    
    try {
      setIsLoading(true);
      
      console.log('Fetching expenses for site:', siteId);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      console.log('Fetched expenses:', data);
      setExpenses(data || []);
    } catch (error: any) {
      console.error('Error fetching expenses:', error.message);
      toast.error('Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, [siteId, setIsLoading]);

  useEffect(() => {
    if (initialExpenses) {
      setExpenses(initialExpenses);
    } else {
      fetchExpenses();
    }
  }, [fetchExpenses, initialExpenses]);

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    
    try {
      // Get expense details before deletion
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', deleteExpenseId)
        .single();
        
      if (expenseError) {
        throw expenseError;
      }
      
      // Delete the expense
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', deleteExpenseId);

      if (error) {
        throw error;
      }

      // Update site financial summary to reflect the deletion
      const { error: updateError } = await supabase
        .rpc('update_site_financial_summary_for_id', { site_id_param: siteId });
        
      if (updateError) {
        console.error('Error updating financial summary:', updateError);
        // Continue with UI update even if financial summary update fails
      }

      setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== deleteExpenseId));
      toast.success('Expense deleted successfully');
      
      // Notify parent component to refresh financial data
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    } finally {
      setDeleteExpenseId(null);
      setShowDeleteDialog(false);
    }
  };

  const handleOpenDeleteDialog = (id: string) => {
    setDeleteExpenseId(id);
    setShowDeleteDialog(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses</CardTitle>
        <CardDescription>View all expense transactions for this site</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No expenses found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {(isAdminView || userRole === UserRole.ADMIN) && (
                    <TableHead>Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{new Date(expense.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{expense.category || 'General'}</TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                    {(isAdminView || userRole === UserRole.ADMIN) && (
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleOpenDeleteDialog(expense.id)}
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
                This action cannot be undone. This will permanently delete the expense and remove the associated financial data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteExpenseId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExpense}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
