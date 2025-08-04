import React, { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLoadingState } from '@/hooks/use-loading-state';

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
import { cn } from "@/lib/utils";
import { FundsReceived, PaymentMethod } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FundsReceivedFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (funds: Partial<FundsReceived>) => void;
  siteId?: string;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  amount: z.coerce.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).positive({
    message: "Amount must be a positive number",
  }),
  reference: z.string().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const FundsReceivedForm: React.FC<FundsReceivedFormProps> = ({ isOpen, onClose, onSubmit, siteId }) => {
  const [isSubmitting, setIsSubmitting] = useLoadingState(false, 30000); // 30 second timeout
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { user } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      amount: undefined,
      reference: '',
      method: undefined,
    },
  });

  const handleSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Get current user ID from auth session
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || user?.id;
      
      if (!userId) {
        toast.error("User authentication error. Please sign in again.");
        throw new Error("User authentication error. Please sign in again.");
      }

      if (!siteId) {
        toast.error("Site ID is required. Please select a site first.");
        throw new Error("Site ID is required");
      }

      // Prepare data for supabase
      const fundsData = {
        date: values.date.toISOString(),
        amount: values.amount,
        reference: values.reference || null,
        method: values.method || null,
        site_id: siteId,
        created_by: userId,
        created_at: new Date().toISOString()
      };

      console.log("Submitting funds data:", fundsData);
      
      // First check if the funds_received table has the created_by column
      try {
        // Try to refresh schema cache
        await supabase.from('funds_received').select('id').limit(1);
        
        const { error } = await supabase
          .from('funds_received')
          .insert(fundsData);
          
        if (error) {
          console.error("Error inserting funds received:", error);
          // If the error is about the created_by column, try without it
          if (error.message.includes('created_by')) {
            const { site_id, created_by, ...essentialData } = fundsData;
            const fallbackData = { ...essentialData, site_id };
            
            console.log("Retrying without created_by field:", fallbackData);
            const { error: fallbackError } = await supabase
              .from('funds_received')
              .insert(fallbackData);
              
            if (fallbackError) {
              console.error("Error in fallback funds insertion:", fallbackError);
              toast.error("Error adding funds: " + fallbackError.message);
              throw fallbackError;
            } else {
              // Success with fallback
              toast.success("Funds received recorded successfully");
              onSubmit({
                date: values.date,
                amount: values.amount,
                reference: values.reference,
                method: values.method,
                siteId: siteId
              });
              form.reset();
              onClose();
              return;
            }
          } else {
            toast.error("Error adding funds: " + error.message);
            throw error;
          }
        }
        
        onSubmit({
          date: values.date,
          amount: values.amount,
          reference: values.reference,
          method: values.method,
          siteId: siteId
        });
        form.reset();
        onClose();
        toast.success("Funds received recorded successfully");
      } catch (schemaError) {
        console.error("Schema or query error:", schemaError);
        toast.error("Database schema error. Please contact support.");
        throw schemaError;
      }
    } catch (error) {
      console.error('Error submitting funds:', error);
      toast.error('Failed to record funds: ' + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>RECORD FUNDS FROM H.O.</DialogTitle>
          <DialogDescription>
            Enter the details of the funds received from the Head Office.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>DATE RECEIVED</FormLabel>
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

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>REFERENCE NUMBER (OPTIONAL)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter reference number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAYMENT METHOD (OPTIONAL)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(PaymentMethod).map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

export default FundsReceivedForm;
