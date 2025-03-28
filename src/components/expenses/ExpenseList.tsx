import React, { useState, useEffect } from 'react';
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

interface ExpenseListProps {
  siteId: string;
  userRole: UserRole;
  isAdminView?: boolean;
  initialExpenses?: any[];
  onTransactionsUpdate?: () => void;
}

export function ExpenseList({
  siteId,
  userRole,
  isAdminView,
  initialExpenses,
  onTransactionsUpdate
}: ExpenseListProps) {
  const [expenses, setExpenses] = useState(initialExpenses || []);
  const [loading, setLoading] = useState(!initialExpenses);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialExpenses) {
      fetchExpenses();
    }
  }, [siteId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!selectedExpenseId) return;
    
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', selectedExpenseId);
        
      if (error) throw error;
      
      toast.success('Expense deleted successfully');
      // Refresh the expense list
      fetchExpenses();
      // Update parent component
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    } finally {
      setShowDeleteDialog(false);
      setSelectedExpenseId(null);
    }
  };

  const showDeleteConfirmation = (expenseId: string) => {
    setSelectedExpenseId(expenseId);
    setShowDeleteDialog(true);
  };

  if (loading) {
    return <div>Loading expenses...</div>;
  }

  // Only show delete button for admins or in admin view
  const showDeleteButton = userRole === UserRole.ADMIN || isAdminView;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {showDeleteButton && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length > 0 ? (
              expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{format(new Date(expense.date), 'PPP')}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell className="text-right">
                    ₹{Number(expense.amount).toLocaleString('en-IN', {
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
                        onClick={() => showDeleteConfirmation(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={showDeleteButton ? 5 : 4} className="text-center">
                  No expenses found
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
              This action will permanently delete this expense. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteExpense}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
