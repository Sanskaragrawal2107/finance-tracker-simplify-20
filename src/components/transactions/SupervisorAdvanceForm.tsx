import React, { useState, useEffect } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLoadingState } from '@/hooks/use-loading-state';

// Define the form schema
const supervisorAdvanceSchema = z.object({
  receiverSupervisorId: z.string({ required_error: 'Please select a supervisor' }),
  receiverSiteId: z.string({ required_error: 'Please select a site' }),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.date({ required_error: 'Please select a date' }),
});

// Define types for form values
type SupervisorAdvanceFormValues = z.infer<typeof supervisorAdvanceSchema>;

interface SupervisorAdvanceFormProps {
  onSuccess?: () => void;
  payerSiteId?: string;
}

interface Site {
  id: string;
  name: string;
  location: string;
  supervisor_id: string;
}

interface Supervisor {
  id: string;
  name: string;
}

export function SupervisorAdvanceForm({ onSuccess, payerSiteId }: SupervisorAdvanceFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useLoadingState(false, 30000); // 30 second timeout
  const [receiverSites, setReceiverSites] = useState<Site[]>([]);
  const [availableSupervisors, setAvailableSupervisors] = useState<Supervisor[]>([]);

  const form = useForm<SupervisorAdvanceFormValues>({
    resolver: zodResolver(supervisorAdvanceSchema),
    defaultValues: {
      amount: undefined,
      date: new Date(),
    },
  });

  const selectedSupervisorId = form.watch('receiverSupervisorId');
  
  // Fetch all supervisors except the current user
  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name')
          .eq('role', 'supervisor')
          .neq('id', user?.id);
          
        if (error) throw error;
        
        setAvailableSupervisors(data || []);
      } catch (error) {
        console.error('Error fetching supervisors:', error);
        toast.error('Failed to load supervisors');
      }
    };
    
    if (user) {
      fetchSupervisors();
    }
  }, [user]);

  // Fetch sites for selected supervisor
  useEffect(() => {
    if (selectedSupervisorId) {
      fetchSupervisorSites(selectedSupervisorId);
    } else {
      setReceiverSites([]);
    }
  }, [selectedSupervisorId]);

  const fetchSupervisorSites = async (supervisorId: string) => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, location, supervisor_id')
        .eq('supervisor_id', supervisorId)
        .eq('is_completed', false);

      if (error) throw error;
      
      setReceiverSites(data || []);
    } catch (error) {
      console.error('Error fetching supervisor sites:', error);
      toast.error('Failed to load sites for the selected supervisor');
    }
  };

  const onSubmit = async (data: SupervisorAdvanceFormValues) => {
    if (!user) {
      toast.error('You must be logged in to perform this action');
      return;
    }

    if (!payerSiteId) {
      toast.error('No payer site selected');
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert the supervisor transaction
      const { data: transactionData, error: transactionError } = await supabase
        .from('supervisor_transactions')
        .insert({
          payer_supervisor_id: user.id,
          receiver_supervisor_id: data.receiverSupervisorId,
          payer_site_id: payerSiteId,
          receiver_site_id: data.receiverSiteId,
          amount: data.amount,
          date: data.date.toISOString(),
          transaction_type: 'advance_paid'
        })
        .select();

      if (transactionError) throw transactionError;

      toast.success('Advance paid to supervisor successfully');
      form.reset();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error submitting transaction:', error);
      toast.error(`Failed to submit transaction: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="receiverSupervisorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Supervisor</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableSupervisors.map((supervisor) => (
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

        <FormField
          control={form.control}
          name="receiverSiteId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Site Location</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedSupervisorId}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedSupervisorId ? "Select site" : "Select a supervisor first"} />
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

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  {...field}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    field.onChange(isNaN(value) ? undefined : value);
                  }}
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Submit'
          )}
        </Button>
      </form>
    </Form>
  );
}