
import React, { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Advance, AdvancePurpose, RecipientType, ApprovalStatus } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";

interface AdvanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (advance: Partial<Advance>) => void;
  siteId?: string;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  recipientName: z.string().min(1, {
    message: "Recipient name is required",
  }),
  recipientType: z.nativeEnum(RecipientType, {
    required_error: "Recipient type is required",
  }),
  purpose: z.nativeEnum(AdvancePurpose, {
    required_error: "Purpose is required",
  }),
  amount: z.coerce.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).positive({
    message: "Amount must be a positive number",
  }),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const AdvanceForm: React.FC<AdvanceFormProps> = ({ isOpen, onClose, onSubmit, siteId }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      recipientName: "",
      recipientType: undefined,
      purpose: undefined,
      amount: undefined,
      remarks: "",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    // Prevent multiple submissions
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      if (!siteId) {
        throw new Error("Site ID is required");
      }
      
      // Create the database entry object with snake_case keys for Supabase
      const advanceData = {
        site_id: siteId,
        date: values.date.toISOString(),
        recipient_name: values.recipientName,
        recipient_type: values.recipientType,
        purpose: values.purpose,
        amount: values.amount,
        remarks: values.remarks || null,
        status: ApprovalStatus.APPROVED,
        created_by: "system", // This should ideally be the user ID
      };
      
      console.log("Submitting advance:", advanceData);
      
      const { data, error } = await supabase
        .from('advances')
        .insert(advanceData)
        .select()
        .single();
        
      if (error) {
        console.error("Error inserting advance:", error);
        throw error;
      }
      
      // Convert the data from snake_case to camelCase for the application
      const newAdvance: Partial<Advance> = {
        id: data.id,
        date: new Date(data.date),
        recipientName: data.recipient_name,
        recipientType: data.recipient_type as RecipientType,
        purpose: data.purpose as AdvancePurpose,
        amount: data.amount,
        remarks: data.remarks,
        status: data.status as ApprovalStatus,
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        siteId: data.site_id,
      };
      
      onSubmit(newAdvance);
      form.reset();
      onClose();
      toast.success("Advance created successfully");
    } catch (error) {
      console.error('Error submitting advance:', error);
      toast.error('Failed to create advance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ADD ADVANCE</DialogTitle>
          <DialogDescription>
            Enter the details for the advance payment.
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
              name="recipientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RECIPIENT NAME</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter recipient name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recipientType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RECIPIENT TYPE</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(RecipientType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
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
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PURPOSE</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(AdvancePurpose).map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {purpose.charAt(0).toUpperCase() + purpose.slice(1).replace('_', ' ')}
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

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>REMARKS (OPTIONAL)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional remarks"
                      {...field}
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
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    SUBMIT
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AdvanceForm;
