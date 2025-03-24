import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { HeadOfficeTransaction, UserRole } from '@/lib/types';
import PageTitle from '@/components/common/PageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';

const HeadOffice = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<HeadOfficeTransaction[]>([]);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    date: new Date(),
    supervisorId: '',
    supervisorName: '',
    amount: '',
    description: '',
  });
  const [supervisors, setSupervisors] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalFundsDistributed, setTotalFundsDistributed] = useState(0);

  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchSupervisors();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('supervisor_transactions') // Changed from head_office_transactions
          .select('*')
          .order('date', { ascending: false });
          
        if (error) throw error;
        
        if (data) {
          const formattedTransactions: HeadOfficeTransaction[] = data.map(transaction => ({
            id: transaction.id,
            date: new Date(transaction.date),
            supervisorId: transaction.receiver_supervisor_id,
            supervisorName: transaction.receiver_supervisor_name || 'Unknown',
            amount: transaction.amount,
            description: transaction.description || '',
            createdAt: new Date(transaction.created_at)
          }));
          
          setTransactions(formattedTransactions);
          
          // Calculate total funds distributed
          const total = formattedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
          setTotalFundsDistributed(total);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        toast.error('Failed to load transactions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor');

      if (error) throw error;

      if (data) {
        setSupervisors(data);
      }
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      toast.error('Failed to load supervisors');
    }
  };

  const handleAddTransaction = async () => {
    try {
      if (!newTransaction.supervisorId || !newTransaction.amount || isNaN(Number(newTransaction.amount)) || Number(newTransaction.amount) <= 0) {
        toast.error('Please fill in all required fields with valid values');
        return;
      }

      const selectedSupervisor = supervisors.find(s => s.id === newTransaction.supervisorId);
      if (!selectedSupervisor) {
        toast.error('Invalid supervisor selected');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('supervisor_transactions')
          .insert({
            date: newTransaction.date.toISOString(),
            payer_supervisor_id: user?.id || '',
            payer_supervisor_name: user?.name || 'Head Office',
            receiver_supervisor_id: newTransaction.supervisorId,
            receiver_supervisor_name: selectedSupervisor.name,
            amount: Number(newTransaction.amount),
            description: newTransaction.description,
            transaction_type: 'funds_received'
          });

        if (error) throw error;

        toast.success('Transaction added successfully');
        setIsAddingTransaction(false);
        setNewTransaction({
          date: new Date(),
          supervisorId: '',
          supervisorName: '',
          amount: '',
          description: '',
        });
        fetchTransactions();
      } catch (error) {
        console.error('Error adding transaction:', error);
        toast.error('Failed to add transaction');
      }
    } catch (error) {
      console.error('Error in handleAddTransaction:', error);
      toast.error('An unexpected error occurred');
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <PageTitle
        title="Head Office"
        subtitle="Manage funds distribution to supervisors"
      />

      <div className="flex flex-col md:flex-row gap-4">
        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle>Total Funds Distributed</CardTitle>
            <CardDescription>Total amount sent to supervisors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ₹{totalFundsDistributed.toLocaleString('en-IN')}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setIsAddingTransaction(true)}>
              Add New Transaction
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  Loading transactions...
                </TableCell>
              </TableRow>
            ) : transactions.length > 0 ? (
              transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(transaction.date, 'PPP')}</TableCell>
                  <TableCell>{transaction.supervisorName}</TableCell>
                  <TableCell>₹{transaction.amount.toLocaleString('en-IN')}</TableCell>
                  <TableCell>{transaction.description || '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  No transactions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddingTransaction} onOpenChange={setIsAddingTransaction}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
            <DialogDescription>
              Send funds to a supervisor. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newTransaction.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newTransaction.date ? format(newTransaction.date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newTransaction.date}
                    onSelect={(date) => setNewTransaction({ ...newTransaction, date: date || new Date() })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <select
                id="supervisor"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newTransaction.supervisorId}
                onChange={(e) => setNewTransaction({ ...newTransaction, supervisorId: e.target.value })}
              >
                <option value="">Select a supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                placeholder="Enter amount"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingTransaction(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTransaction}>Save Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HeadOffice;
