
import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { SupervisorTransactionType } from '@/lib/types';

const supervisorTransactionSchema = z.object({
  date: z.date({
    required_error: 'Date is required',
  }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  receiverSupervisorId: z.string({
    required_error: 'Supervisor is required',
  }),
  receiverSiteId: z.string({
    required_error: 'Site is required',
  }),
  payerSiteId: z.string({
    required_error: 'Site is required',
  }),
  transactionType: z.enum(['funds_received', 'advance_paid'], {
    required_error: 'Transaction type is required',
  }),
});

type SupervisorTransactionFormValues = z.infer<typeof supervisorTransactionSchema>;

interface Supervisor {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  location: string;
  supervisorId: string;
}

interface SupervisorTransactionFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  payerSiteId?: string;
  transactionType?: SupervisorTransactionType;
}

const SupervisorTransactionForm: React.FC<SupervisorTransactionFormProps> = ({
  onSuccess,
  onClose,
  payerSiteId,
  transactionType = SupervisorTransactionType.ADVANCE_PAID,
}) => {
  const { user } = useAuth();
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [receiverSites, setReceiverSites] = useState<Site[]>([]);
  const [payerSites, setPayerSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<SupervisorTransactionFormValues>({
    resolver: zodResolver(supervisorTransactionSchema),
    defaultValues: {
      date: new Date(),
      amount: '',
      transactionType: transactionType,
      payerSiteId: payerSiteId || '',
    },
  });

  const selectedSupervisorId = form.watch('receiverSupervisorId');
  const selectedTransactionType = form.watch('transactionType');

  // Fetch supervisors
  useEffect(() => {
    const fetchSupervisors = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.from('users').select('*');
        
        if (error) throw error;
        
        if (data) {
          // Filter out the current user
          const filteredSupervisors = data
            .filter(sup => sup.id !== user.id)
            .map(sup => ({
              id: sup.id,
              name: sup.name
            }));
            
          setSupervisors(filteredSupervisors);
        }
      } catch (error) {
        console.error('Error fetching supervisors:', error);
        toast.error('Failed to load supervisors');
      }
    };
    
    fetchSupervisors();
  }, [user]);

  // Fetch sites
  useEffect(() => {
    const fetchSites = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.from('sites').select('*');
        
        if (error) throw error;
        
        if (data) {
          const transformedSites = data.map(site => ({
            id: site.id,
            name: site.name,
            location: site.location,
            supervisorId: site.supervisor_id
          }));
          
          setAllSites(transformedSites);
          
          // Set payer sites (current user's sites)
          const currentUserSites = transformedSites.filter(
            site => site.supervisorId === user.id
          );
          setPayerSites(currentUserSites);
          
          // If payerSiteId is provided, set it in the form
          if (payerSiteId) {
            form.setValue('payerSiteId', payerSiteId);
          }
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        toast.error('Failed to load sites');
      }
    };
    
    fetchSites();
  }, [user, payerSiteId, form]);

  // Update receiver sites when supervisor changes
  useEffect(() => {
    if (selectedSupervisorId) {
      const supervisorSites = allSites.filter(
        site => site.supervisorId === selectedSupervisorId
      );
      setReceiverSites(supervisorSites);
      
      // Reset the selected site when supervisor changes
      form.setValue('receiverSiteId', '');
    } else {
      setReceiverSites([]);
    }
  }, [selectedSupervisorId, allSites, form]);

  const handleSubmit = async (values: SupervisorTransactionFormValues) => {
    if (!user) {
      toast.error('You must be logged in to perform this action');
      return;
    }
    
    setLoading(true);
    
    try {
      const transactionData = {
        date: values.date.toISOString(),
        amount: Number(values.amount),
        transaction_type: values.transactionType,
        payer_supervisor_id: user.id,
        receiver_supervisor_id: values.receiverSupervisorId,
        payer_site_id: values.payerSiteId,
        receiver_site_id: values.receiverSiteId
      };
      
      const { data, error } = await supabase
        .from('supervisor_transactions')
        .insert(transactionData)
        .select('*')
        .single();
      
      if (error) throw error;
      
      toast.success(`${values.transactionType === 'advance_paid' ? 'Advance' : 'Funds'} transaction completed successfully`);
      
      // Update site financial summary will be handled by the database trigger
      
      form.reset();
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error) {
      console.error('Error creating supervisor transaction:', error);
      toast.error('Failed to complete transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="transactionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Type</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                disabled={transactionType !== undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="advance_paid">Advance Paid to Supervisor</SelectItem>
                  <SelectItem value="funds_received">Funds Received from Supervisor</SelectItem>
                </SelectContent>
              </Select>
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
          name="receiverSupervisorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {selectedTransactionType === 'advance_paid' ? 'Receiver' : 'Payer'} Supervisor
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedSupervisorId && (
          <FormField
            control={form.control}
            name="receiverSiteId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {selectedTransactionType === 'advance_paid' ? 'Receiver' : 'Payer'} Site
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {receiverSites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} - {site.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="payerSiteId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {selectedTransactionType === 'advance_paid' ? 'Payer' : 'Receiver'} Site
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {payerSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} - {site.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Submit Transaction'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default SupervisorTransactionForm;
