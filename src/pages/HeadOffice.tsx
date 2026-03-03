
import React, { useState, useEffect } from 'react';
import PageTitle from '@/components/common/PageTitle';
import { Search, Filter, Plus, Download, ChevronLeft, ChevronRight, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { HeadOfficeTransaction, FundsReceived, UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { fetchSiteFundsReceived, deleteFundsReceived } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Mock data for demonstration
const transactions: HeadOfficeTransaction[] = [
  {
    id: '1',
    date: new Date('2023-07-15'),
    supervisorId: '101',
    supervisorName: 'Rajesh Kumar',
    amount: 500000,
    description: 'Monthly allocation for Site A',
    createdAt: new Date('2023-07-15'),
  },
  {
    id: '2',
    date: new Date('2023-06-15'),
    supervisorId: '101',
    supervisorName: 'Rajesh Kumar',
    amount: 450000,
    description: 'Monthly allocation for Site A',
    createdAt: new Date('2023-06-15'),
  },
  {
    id: '3',
    date: new Date('2023-05-15'),
    supervisorId: '101',
    supervisorName: 'Rajesh Kumar',
    amount: 500000,
    description: 'Monthly allocation for Site A',
    createdAt: new Date('2023-05-15'),
  },
  {
    id: '4',
    date: new Date('2023-07-12'),
    supervisorId: '102',
    supervisorName: 'Sunil Verma',
    amount: 350000,
    description: 'Monthly allocation for Site B',
    createdAt: new Date('2023-07-12'),
  },
  {
    id: '5',
    date: new Date('2023-06-12'),
    supervisorId: '102',
    supervisorName: 'Sunil Verma',
    amount: 350000,
    description: 'Monthly allocation for Site B',
    createdAt: new Date('2023-06-12'),
  },
  {
    id: '6',
    date: new Date('2023-07-10'),
    supervisorId: '103',
    supervisorName: 'Amit Singh',
    amount: 350000,
    description: 'Monthly allocation for Site C',
    createdAt: new Date('2023-07-10'),
  },
];

const HeadOffice: React.FC = () => {
  const { user } = useAuth();
  const [allFunds, setAllFunds] = useState<FundsReceived[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItemToDelete, setSelectedItemToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    // Load all funds received data when component mounts
    if (user?.id && user?.role === UserRole.ADMIN) {
      loadAllFundsReceived();
    }
  }, [user]);

  const loadAllFundsReceived = async () => {
    try {
      setIsLoading(true);
      // In a real implementation, we would fetch all funds from all sites
      // For now, this is a placeholder
      const data = await fetchAllFundsReceived();
      setAllFunds(data);
    } catch (error) {
      console.error('Error loading funds received:', error);
      toast.error('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder function - in a real implementation, this would fetch from all sites
  const fetchAllFundsReceived = async (): Promise<FundsReceived[]> => {
    // Return the mock data for now
    return transactions.map(t => ({
      id: t.id,
      siteId: '',
      amount: t.amount,
      date: t.date,
      method: 'Bank Transfer',
      reference: `Ref-${t.id}`,
      createdAt: t.createdAt
    }));
  };

  const handleDelete = async () => {
    if (!selectedItemToDelete || !user?.id) return;
    
    try {
      console.log(`Attempting to delete fund with ID: ${selectedItemToDelete}`);
      
      // Make sure we have a valid ID before attempting to delete
      if (!selectedItemToDelete || selectedItemToDelete.trim() === '') {
        throw new Error('Invalid transaction ID');
      }
      
      const result = await deleteFundsReceived(selectedItemToDelete, user.id);
      console.log('Delete result:', result);
      
      if (result.success) {
        // Update local state to remove the deleted item
        setAllFunds(prevFunds => prevFunds.filter(fund => fund.id !== selectedItemToDelete));
        toast.success('Transaction deleted successfully');
      } else {
        // If we get here, it means the API call was successful but returned success: false
        throw new Error('Failed to delete transaction: ' + (result.error?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete transaction');
    } finally {
      setIsDeleteDialogOpen(false);
      setSelectedItemToDelete(null);
    }
  };

  const confirmDelete = (id: string) => {
    console.log(`Confirming deletion of fund with ID: ${id}`);
    setSelectedItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageTitle 
        title="Head Office Funds" 
        subtitle="Track funds received from the head office"
      />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search transactions..." 
            className="py-2 pl-10 pr-4 border rounded-md w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            Filter
          </button>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4 mr-2 text-muted-foreground" />
            Export
          </button>
          <button className="inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </button>
        </div>
      </div>
      
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="py-3 pl-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supervisor</th>
                <th className="py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                <th className="py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                <th className="py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3.5 pl-4 text-sm text-muted-foreground">{format(transaction.date, 'dd MMM yyyy')}</td>
                  <td className="py-3.5 text-sm font-medium">{transaction.supervisorName}</td>
                  <td className="py-3.5 text-sm font-semibold text-emerald-700">₹{transaction.amount.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 text-sm text-muted-foreground">{transaction.description}</td>
                  <td className="py-3.5 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors">
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {user?.role === UserRole.ADMIN && (
                        <button
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-100 transition-colors text-red-500"
                          onClick={() => confirmDelete(transaction.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-xs text-muted-foreground">Showing 1–6 of 6 entries</p>
          <div className="flex items-center gap-1">
            <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors opacity-40" disabled>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="h-7 w-7 flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-medium">1</button>
            <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors opacity-40" disabled>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HeadOffice;
