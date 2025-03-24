import React, { useEffect, useState } from 'react';
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

const supervisorTransactionSchema = z.object({
  receiver_supervisor_id: z.string({
    required_error: 'Please select a supervisor',
  }),
  site_id: z.string({
    required_error: 'Please select a site',
  }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  date: z.date({
    required_error: 'Date is required',
  }),
  transaction_type: z.enum(['funds_received_from_supervisor', 'advance_paid_to_supervisor'], {
    required_error: 'Transaction type is required',
  }),
});

type SupervisorTransactionFormValues = z.infer<typeof supervisorTransactionSchema>;

interface SupervisorTransactionFormProps {
  onSuccess?: () => void;
}

interface Supervisor {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  location: string;
}

export function SupervisorTransactionForm({ onSuccess }: SupervisorTransactionFormProps) {
  const { user } = useAuth();
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<SupervisorTransactionFormValues>({
    resolver: zodResolver(supervisorTransactionSchema),
    defaultValues: {
      date: new Date(),
      amount: '',
      transaction_type: 'advance_paid_to_supervisor',
    },
  });

  useEffect(() => {
    fetchSupervisors();
  }, []);

  useEffect(() => {
    const receiverId = form.watch('receiver_supervisor_id');
    if (receiverId) {
      fetchSites(receiverId);
    }
  }, [form.watch('receiver_supervisor_id')]);

  const fetchSupervisors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor')
        .neq('id', user?.id);

      if (error) throw error;
      setSupervisors(data || []);
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      toast.error('Failed to load supervisors');
    }
  };

  const fetchSites = async (supervisorId: string) => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, location')
        .eq('supervisor_id', supervisorId);

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load sites');
    }
  };

  const onSubmit = async (data: SupervisorTransactionFormValues) => {
    try {
      setLoading(true);
      
      // Insert into supervisor_transactions table
      const { error: transactionError } = await supabase
        .from('supervisor_transactions')
        .insert({
          payer_supervisor_id: user?.id,
          receiver_supervisor_id: data.receiver_supervisor_id,
          site_id: data.site_id,
          amount: Number(data.amount),
          transaction_type: data.transaction_type,
          date: data.date.toISOString(),
        });

      if (transactionError) throw transactionError;

      // Update site_financial_summary
      const { error: summaryError } = await supabase.rpc('update_supervisor_financial_summary', {
        p_site_id: data.site_id,
        p_amount: Number(data.amount),
        p_transaction_type: data.transaction_type
      });

      if (summaryError) throw summaryError;

      toast.success('Transaction added successfully');
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="receiver_supervisor_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Supervisor</FormLabel>
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

        <FormField
          control={form.control}
          name="site_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Site</FormLabel>
              <FormControl>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...field}
                  disabled={!form.watch('receiver_supervisor_id')}
                >
                  <option value="">Select a site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} - {site.location}
                    </option>
                  ))}
                </select>
              </FormControl>
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
          name="transaction_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Type</FormLabel>
              <FormControl>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...field}
                >
                  <option value="advance_paid_to_supervisor">Advance Paid to Supervisor</option>
                  <option value="funds_received_from_supervisor">Funds Received from Supervisor</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Adding Transaction...' : 'Add Transaction'}
        </Button>
      </form>
    </Form>
  );
} 