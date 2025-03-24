
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

const transactionSchema = z.object({
  date: z.date({
    required_error: 'Date is required',
  }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  type: z.enum(['expense', 'advance', 'funds_received', 'invoice'], {
    required_error: 'Transaction type is required',
  }),
  description: z.string().optional(),
  category: z.string().optional(),
  siteId: z.string().optional(),
  recipientName: z.string().optional(),
  recipientType: z.string().optional(),
  purpose: z.string().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  siteId: string;
  onSuccess?: () => void;
}

const TransactionForm = ({ siteId, onSuccess }: TransactionFormProps) => {
  const { user } = useAuth();
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date(),
      amount: '',
      type: 'expense',
      description: '',
      siteId: siteId,
    },
  });

  const handleTransactionSubmit = async (values: TransactionFormValues) => {
    try {
      let error;
      
      switch (values.type) {
        case 'expense':
          const expenseResult = await supabase.from('expenses').insert({
            date: values.date.toISOString(),
            description: values.description,
            category: values.category,
            amount: Number(values.amount),
            site_id: values.siteId,
            created_by: user?.id
          });
          error = expenseResult.error;
          break;
          
        case 'advance':
          const advanceResult = await supabase.from('advances').insert({
            date: values.date.toISOString(),
            recipient_name: values.recipientName || '',
            recipient_type: values.recipientType || 'worker',
            purpose: values.purpose || 'advance',
            amount: Number(values.amount),
            site_id: values.siteId,
            created_by: user?.id,
            status: 'pending'
          });
          error = advanceResult.error;
          break;
          
        case 'funds_received':
          const fundsResult = await supabase.from('funds_received').insert({
            date: values.date.toISOString(),
            amount: Number(values.amount),
            site_id: values.siteId,
            method: values.method,
            reference: values.reference
          });
          error = fundsResult.error;
          break;
          
        default:
          throw new Error('Invalid transaction type');
      }
      
      if (error) throw error;

      toast.success('Transaction added successfully');
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('Failed to add transaction');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleTransactionSubmit)} className="space-y-4">
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
                      variant="outline"
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
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
                      date > new Date() || date < new Date('1900-01-01')
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
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter amount"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...field}
                >
                  <option value="expense">Expense</option>
                  <option value="advance">Advance</option>
                  <option value="funds_received">Funds Received</option>
                  <option value="invoice">Invoice</option>
                </select>
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
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Enter description"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Add Transaction
        </Button>
      </form>
    </Form>
  );
};

export default TransactionForm;
