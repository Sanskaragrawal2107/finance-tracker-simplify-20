import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { UserRole } from '@/lib/types';

interface SupervisorTransaction {
  id: string;
  date: string;
  amount: number;
  transaction_type: string;
  payer_supervisor_id?: string;
  receiver_supervisor_id?: string;
  payer_supervisor: {
    name: string;
  };
  receiver_supervisor: {
    name: string;
  };
  payer_site: {
    name: string;
    location: string;
  };
  receiver_site: {
    name: string;
    location: string;
  };
  created_at: string;
}

interface SupervisorTransactionHistoryProps {
  siteId?: string;
  supervisorId?: string;
  title?: string;
  isAdminView?: boolean;
}

export function SupervisorTransactionHistory({ 
  siteId, 
  supervisorId,
  title = "Supervisor-to-Supervisor Transactions",
  isAdminView = false
}: SupervisorTransactionHistoryProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<SupervisorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
    
    // Set up a subscription for real-time updates
    const channel = supabase
      .channel('supervisor_transactions_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'supervisor_transactions' 
        }, 
        (payload) => {
          console.log('Change received!', payload);
          fetchTransactions();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId, supervisorId]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('supervisor_transactions')
        .select(`
          *,
          payer_supervisor:users!payer_supervisor_id(name),
          receiver_supervisor:users!receiver_supervisor_id(name),
          payer_site:sites!payer_site_id(name, location),
          receiver_site:sites!receiver_site_id(name, location)
        `)
        .order('date', { ascending: false });

      if (siteId) {
        query = query.or(`payer_site_id.eq.${siteId},receiver_site_id.eq.${siteId}`);
      }
      
      if (supervisorId) {
        query = query.or(`payer_supervisor_id.eq.${supervisorId},receiver_supervisor_id.eq.${supervisorId}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // Ensure the data matches the expected shape before setting it
        const mappedData: SupervisorTransaction[] = data.map(item => ({
          id: item.id,
          date: item.date,
          amount: item.amount,
          transaction_type: item.transaction_type,
          payer_supervisor_id: item.payer_supervisor_id,
          receiver_supervisor_id: item.receiver_supervisor_id,
          payer_supervisor: {
            name: item.payer_supervisor?.name || 'Unknown'
          },
          receiver_supervisor: {
            name: item.receiver_supervisor?.name || 'Unknown'
          },
          payer_site: {
            name: item.payer_site?.name || 'Unknown',
            location: item.payer_site?.location || 'Unknown'
          },
          receiver_site: {
            name: item.receiver_site?.name || 'Unknown',
            location: item.receiver_site?.location || 'Unknown'
          },
          created_at: item.created_at
        }));
        
        setTransactions(mappedData);
      }
    } catch (error) {
      console.error('Error fetching supervisor transactions:', error);
      toast.error('Failed to load supervisor transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransactionId) return;
    
    try {
      const { error } = await supabase
        .from('supervisor_transactions')
        .delete()
        .eq('id', selectedTransactionId);
        
      if (error) throw error;
      
      toast.success('Transaction deleted successfully');
      // Refresh the transactions list
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    } finally {
      setShowDeleteDialog(false);
      setSelectedTransactionId(null);
    }
  };

  const showDeleteConfirmation = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setShowDeleteDialog(true);
  };

  if (loading) {
    return <div className="py-4 text-center text-muted-foreground">Loading transactions...</div>;
  }

  if (transactions.length === 0) {
    return <div className="py-4 text-center text-muted-foreground">No supervisor transactions found</div>;
  }

  // Only admins or the component in admin view should see delete buttons
  const showDeleteButton = user?.role === UserRole.ADMIN || isAdminView;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supervisor Paid</TableHead>
                <TableHead>Supervisor Received</TableHead>
                <TableHead>From Site</TableHead>
                <TableHead>To Site</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {showDeleteButton && <TableHead className="w-[80px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                // Format the transaction type for display
                const formatTransactionType = (type: string) => {
                  switch (type) {
                    case 'funds_received':
                      return 'Funds Received from Head Office';
                    case 'advance_paid':
                      // Check if the current user is the payer (meaning they paid an advance to another supervisor)
                      if (transaction.payer_supervisor_id === user?.id) {
                        return 'Advance Paid to Supervisor';
                      }
                      // If current user is the receiver, it's an advance received
                      return 'Advance Received from Supervisor';
                    default:
                      return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  }
                };
                
                return (
                  <TableRow key={transaction.id}>
                    <TableCell>{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{transaction.payer_supervisor.name}</TableCell>
                    <TableCell>{transaction.receiver_supervisor.name}</TableCell>
                    <TableCell>{transaction.payer_site.name} - {transaction.payer_site.location}</TableCell>
                    <TableCell>{transaction.receiver_site.name} - {transaction.receiver_site.location}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          transaction.payer_supervisor_id === user?.id
                            ? 'destructive'
                            : 'default'
                        }
                      >
                        {formatTransactionType(transaction.transaction_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{transaction.amount.toLocaleString('en-IN')}
                    </TableCell>
                    {showDeleteButton && (
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => showDeleteConfirmation(transaction.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this transaction record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTransaction}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
