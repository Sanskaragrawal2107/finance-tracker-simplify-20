
import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Site } from "@/lib/types";

interface SupervisorTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  transactionType: 'funds_received' | 'advance_paid';
  siteId?: string;
}

interface Supervisor {
  id: string;
  name: string;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  supervisorId: z.string({
    required_error: "Supervisor is required",
  }),
  siteId: z.string({
    required_error: "Site is required",
  }),
  amount: z.coerce.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).positive({
    message: "Amount must be a positive number",
  }),
});

type FormValues = z.infer<typeof formSchema>;

const SupervisorTransactionForm: React.FC<SupervisorTransactionFormProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  transactionType,
  siteId: currentSiteId 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const { user } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      supervisorId: "",
      siteId: "",
      amount: undefined,
    },
  });

  // When form opens, reset it with the current site ID if available
  useEffect(() => {
    if (isOpen) {
      form.reset({
        date: new Date(),
        supervisorId: "",
        siteId: currentSiteId || "",
        amount: undefined,
      });
    }
  }, [isOpen, currentSiteId, form]);

  // Fetch all supervisors
  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name')
          .eq('role', 'supervisor');
        
        if (error) throw error;
        
        if (data) {
          // Filter out the current user if they are a supervisor
          const filteredSupervisors = data.filter(supervisor => 
            supervisor.id !== user?.id
          );
          setSupervisors(filteredSupervisors);
        }
      } catch (error) {
        console.error('Error fetching supervisors:', error);
        toast.error('Failed to load supervisors');
      }
    };

    if (isOpen) {
      fetchSupervisors();
    }
  }, [isOpen, user?.id]);

  // Monitor selected supervisor and fetch their sites
  useEffect(() => {
    const selectedSupervisorId = form.watch("supervisorId");
    
    const fetchSupervisorSites = async (supervisorId: string) => {
      if (!supervisorId) {
        setFilteredSites([]);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('sites')
          .select('*')
          .eq('supervisor_id', supervisorId)
          .eq('is_completed', false);
        
        if (error) throw error;
        
        if (data) {
          const transformedSites: Site[] = data.map(site => ({
            id: site.id,
            name: site.name,
            jobName: site.job_name || '',
            posNo: site.pos_no || '',
            location: site.location || '',
            startDate: new Date(site.start_date),
            completionDate: site.completion_date ? new Date(site.completion_date) : undefined,
            supervisorId: site.supervisor_id || '',
            supervisor: '', // Will be filled later if needed
            createdAt: new Date(site.created_at),
            isCompleted: site.is_completed || false,
            funds: site.funds || 0,
            totalFunds: site.total_funds || 0,
          }));
          
          setFilteredSites(transformedSites);
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        toast.error('Failed to load sites for the selected supervisor');
      }
    };

    if (selectedSupervisorId) {
      fetchSupervisorSites(selectedSupervisorId);
    } else {
      setFilteredSites([]);
    }
  }, [form.watch("supervisorId")]);

  // Fetch current user's site if in a site context
  useEffect(() => {
    const fetchUserSite = async () => {
      if (!currentSiteId || !user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('sites')
          .select('*')
          .eq('id', currentSiteId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          const site: Site = {
            id: data.id,
            name: data.name,
            jobName: data.job_name || '',
            posNo: data.pos_no || '',
            location: data.location || '',
            startDate: new Date(data.start_date),
            completionDate: data.completion_date ? new Date(data.completion_date) : undefined,
            supervisorId: data.supervisor_id || '',
            supervisor: '', // Will be filled later if needed
            createdAt: new Date(data.created_at),
            isCompleted: data.is_completed || false,
            funds: data.funds || 0,
            totalFunds: data.total_funds || 0,
          };
          
          setSites([site]);
        }
      } catch (error) {
        console.error('Error fetching current site:', error);
      }
    };

    if (isOpen && currentSiteId) {
      fetchUserSite();
    }
  }, [isOpen, currentSiteId, user?.id]);

  const handleSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Get current user ID
      if (!user?.id) {
        toast.error("Authentication error. Please sign in again.");
        throw new Error("User authentication error");
      }

      // Determine payer and receiver based on transaction type
      let payerSupervisorId, receiverSupervisorId, payerSiteId, receiverSiteId;
      
      if (transactionType === 'advance_paid') {
        // Current user is paying an advance
        payerSupervisorId = user.id;
        receiverSupervisorId = values.supervisorId;
        payerSiteId = currentSiteId;
        receiverSiteId = values.siteId;
      } else { // 'funds_received'
        // Current user is receiving funds
        payerSupervisorId = values.supervisorId;
        receiverSupervisorId = user.id;
        payerSiteId = values.siteId;
        receiverSiteId = currentSiteId;
      }

      // Prepare data for supabase
      const transactionData = {
        date: values.date.toISOString(),
        payer_supervisor_id: payerSupervisorId,
        receiver_supervisor_id: receiverSupervisorId,
        payer_site_id: payerSiteId,
        receiver_site_id: receiverSiteId,
        amount: values.amount,
        transaction_type: transactionType
      };

      console.log("Submitting transaction data:", transactionData);
      
      // Insert transaction record
      const { error } = await supabase
        .from('supervisor_transactions')
        .insert(transactionData);
        
      if (error) {
        console.error("Error inserting transaction:", error);
        toast.error("Error adding transaction: " + error.message);
        throw error;
      }
      
      // Success
      toast.success(`Transaction recorded successfully`);
      form.reset();
      onClose();
      onSubmit(); // Notify parent to refresh data
      
    } catch (error) {
      console.error('Error submitting transaction:', error);
      toast.error('Failed to record transaction: ' + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format site display name
  const formatSiteDisplay = (site: Site) => {
    return `${site.name} (${site.location})`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transactionType === 'advance_paid' 
              ? "ADVANCE PAID TO SUPERVISOR" 
              : "FUNDS RECEIVED FROM SUPERVISOR"}
          </DialogTitle>
          <DialogDescription>
            {transactionType === 'advance_paid'
              ? "Record an advance payment to another supervisor."
              : "Record funds received from another supervisor."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>DATE</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal uppercase",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP").toUpperCase()
                          ) : (
                            <span>SELECT A DATE</span>
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
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supervisorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SELECT SUPERVISOR</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a supervisor" />
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

            <FormField
              control={form.control}
              name="siteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SELECT SITE LOCATION</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={filteredSites.length === 0 && !form.watch("supervisorId")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          form.watch("supervisorId") 
                            ? (filteredSites.length === 0 ? "No active sites found" : "Select a site")
                            : "Select a supervisor first"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredSites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {formatSiteDisplay(site)}
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
                  <FormLabel>AMOUNT (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={field.value || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value ? parseFloat(value) : undefined);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                CANCEL
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    SUBMITTING...
                  </>
                ) : (
                  "SUBMIT"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SupervisorTransactionForm;
