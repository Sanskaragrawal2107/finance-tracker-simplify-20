import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Expense,
  Advance,
  FundsReceived,
  Invoice,
  UserRole,
  PaymentMethod,
  ExpenseCategory,
  AdvancePurpose,
  ApprovalStatus,
  PaymentStatus,
  RecipientType,
  BankDetails,
  MaterialItem,
  HeadOfficeTransaction
} from '@/lib/types';
import { cn } from '@/lib/utils';

const transactionSchema = z.object({
  date: z.date({
    required_error: "A date is required.",
  }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number.",
  }),
  description: z.string().optional(),
  supervisorId: z.string({
    required_error: "Please select a supervisor.",
  }),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const HeadOffice: React.FC = () => {
  const [transactions, setTransactions] = useState<HeadOfficeTransaction[]>([]);
  const [supervisors, setSupervisors] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date(),
      amount: '',
      description: '',
      supervisorId: '',
    },
  });

  useEffect(() => {
    fetchTransactions();
    fetchSupervisors();
  }, []);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('head_office_transactions')
        .select('*, supervisor:supervisor_id(name)')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        toast.error('Failed to load transactions');
      } else {
        // Map the Supabase data to the HeadOfficeTransaction type
        const mappedTransactions: HeadOfficeTransaction[] = data.map((item: any) => ({
          id: item.id,
          date: new Date(item.date),
          amount: item.amount,
          description: item.description || '',
          supervisorId: item.supervisor_id,
          supervisorName: item.supervisor?.name || 'Unknown',
          createdAt: new Date(item.created_at),
        }));
        setTransactions(mappedTransactions);
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

      if (error) {
        console.error('Error fetching supervisors:', error);
        toast.error('Failed to load supervisors');
      } else {
        setSupervisors(data || []);
      }
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      toast.error('Failed to load supervisors');
    }
  };

  const onSubmit = async (data: TransactionFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('head_office_transactions')
        .insert({
          date: data.date.toISOString(),
          amount: Number(data.amount),
          description: data.description,
          supervisor_id: data.supervisorId,
        });

      if (error) {
        console.error('Error adding transaction:', error);
        toast.error('Failed to add transaction');
      } else {
        toast.success('Transaction added successfully');
        form.reset();
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('Failed to add transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string, type: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) {
      return;
    }

    try {
      let result;

      if (type === 'transaction') {
        result = await supabase
          .from('head_office_transactions')
          .delete()
          .eq('id', id);
      } else {
        toast.error('Invalid transaction type');
        return;
      }

      // Check if the result has an error object with a message property
      if (!result.success && result.error && 'message' in result.error) {
        toast.error(result.error.message);
        return;
      }

      if (!result.success) {
        toast.error('Failed to delete transaction');
        return;
      }

      toast.success('Transaction deleted successfully');
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    }
  };

  const confirmDelete = (id: string) => {
    setTransactionToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (transactionToDelete) {
      await handleDeleteTransaction(transactionToDelete, 'transaction');
      setIsDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Head Office Transactions</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Form */}
        <div className="bg-white shadow-md rounded-md p-5">
          <h2 className="text-xl font-semibold mb-4">Add Transaction</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter amount" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supervisorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supervisor</FormLabel>
                    <FormControl>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        {...field}
                      >
                        <option value="">Select a supervisor</option>
                        {supervisors.map((supervisor) => (
                          <option key={supervisor.id} value={supervisor.id}>
                            {supervisor.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add Transaction'}
              </Button>
            </form>
          </Form>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
          {isLoading ? (
            <p>Loading transactions...</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(transaction.date, 'PPP')}</TableCell>
                      <TableCell>₹{transaction.amount.toLocaleString()}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>{transaction.supervisorName}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDelete(transaction.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {/* Delete Confirmation Dialog */}
      <div className="relative z-50">
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Confirm Delete
                </h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete this transaction? This action cannot be undone.
                  </p>
                </div>
                <div className="items-center px-4 py-3">
                  <Button
                    variant="ghost"
                    className="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
                    onClick={handleCancelDelete}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="ml-3 px-4 py-2 bg-red-500 text-white hover:bg-red-700 rounded-md"
                    onClick={handleConfirmDelete}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeadOffice;
