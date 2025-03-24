
import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Loader2, 
  Check, 
  ChevronsUpDown, 
  Plus 
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { 
  AdvancePurpose, 
  ApprovalStatus, 
  RecipientType 
} from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdvanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (advance: Partial<Advance>) => void;
  siteId?: string;
}

interface Advance {
  id: string;
  date: Date;
  recipientId?: string;
  recipientName: string;
  recipientType: RecipientType;
  purpose: AdvancePurpose;
  amount: number;
  remarks?: string;
  status: ApprovalStatus;
  createdBy: string;
  createdAt: Date;
  siteId?: string;
}

// Options for recipient types
interface Option {
  value: string;
  label: string;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  recipientName: z.string({
    required_error: "Recipient name is required",
  }).min(2, {
    message: "Recipient name must be at least 2 characters",
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

// Predefined options for different recipient types
const recipientTypeOptions: Option[] = [
  { value: RecipientType.WORKER, label: 'Worker' },
  { value: RecipientType.SUBCONTRACTOR, label: 'Subcontractor' },
  // Removed Supervisor option as requested
];

const purposeOptions: Option[] = [
  { value: AdvancePurpose.ADVANCE, label: 'Advance' },
  { value: AdvancePurpose.SAFETY_SHOES, label: 'Safety Shoes' },
  { value: AdvancePurpose.TOOLS, label: 'Tools' },
  { value: AdvancePurpose.OTHER, label: 'Other' },
];

const AdvanceForm: React.FC<AdvanceFormProps> = ({ isOpen, onClose, onSubmit, siteId }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { user } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      recipientName: '',
      recipientType: undefined,
      purpose: undefined,
      amount: undefined,
      remarks: '',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        date: new Date(),
        recipientName: '',
        recipientType: undefined,
        purpose: undefined,
        amount: undefined,
        remarks: '',
      });
    }
  }, [isOpen, form]);

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
      const advanceData = {
        date: values.date.toISOString(),
        recipient_name: values.recipientName,
        recipient_type: values.recipientType,
        purpose: values.purpose,
        amount: values.amount,
        remarks: values.remarks || null,
        site_id: siteId,
        created_by: userId,
        created_at: new Date().toISOString(),
        status: ApprovalStatus.APPROVED
      };

      console.log("Submitting advance data:", advanceData);
      
      const { error } = await supabase
        .from('advances')
        .insert(advanceData);
        
      if (error) {
        console.error("Error inserting advance:", error);
        toast.error("Error adding advance: " + error.message);
        throw error;
      }
      
      onSubmit({
        date: values.date,
        recipientName: values.recipientName,
        recipientType: values.recipientType,
        purpose: values.purpose,
        amount: values.amount,
        remarks: values.remarks,
        siteId
      });
      
      form.reset();
      onClose();
      toast.success("Advance added successfully");
    } catch (error) {
      console.error('Error submitting advance:', error);
      toast.error('Failed to add advance: ' + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const shouldDisableForm = isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ADD NEW ADVANCE</DialogTitle>
          <DialogDescription>
            Enter the details of the advance payment.
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
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal uppercase",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={shouldDisableForm}
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
                        onSelect={(date) => {
                          field.onChange(date);
                          setDatePickerOpen(false);
                        }}
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
                    <Input
                      placeholder="Enter recipient name"
                      {...field}
                      disabled={shouldDisableForm}
                    />
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
                    disabled={shouldDisableForm}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {recipientTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                    disabled={shouldDisableForm}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {purposeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                      disabled={shouldDisableForm}
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
                      placeholder="Enter any additional information"
                      {...field}
                      disabled={shouldDisableForm}
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

export default AdvanceForm;
