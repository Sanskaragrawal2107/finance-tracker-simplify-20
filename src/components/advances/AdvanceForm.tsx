
import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, User, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Advance, AdvancePurpose, RecipientType, ApprovalStatus } from "@/lib/types";
import SearchableDropdown from '../expenses/SearchableDropdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLoadingState } from '@/hooks/use-loading-state';

interface AdvanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (advance: Partial<Advance>) => void;
  siteId: string;
}

// Defining the interface locally to avoid conflicts
interface ContractorOption {
  id: string;
  name: string;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  recipientType: z.nativeEnum(RecipientType, {
    required_error: "Please select recipient type",
  }),
  recipientName: z.string().min(2, {
    message: "Name must be at least 2 characters",
  }),
  purpose: z.nativeEnum(AdvancePurpose, {
    required_error: "Purpose is required",
  }),
  amount: z.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).positive({
    message: "Amount must be a positive number",
  }),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const AdvanceForm: React.FC<AdvanceFormProps> = ({ isOpen, onClose, onSubmit, siteId }) => {
  const [isSubmitting, setIsSubmitting] = useLoadingState(false, 30000); // 30 second timeout
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [recipientOptions, setRecipientOptions] = useState<ContractorOption[]>([]);
  const [showRemarks, setShowRemarks] = useState(false);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const { user } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      recipientType: undefined,
      recipientName: "",
      purpose: undefined,
      amount: undefined,
      remarks: "",
    },
  });

  useEffect(() => {
    const fetchContractors = async () => {
      try {
        const { data, error } = await supabase
          .from('contractors')
          .select('id, name');
        
        if (error) {
          console.error('Error fetching contractors:', error);
          toast.error('Failed to load contractors');
          return;
        }
        
        if (data) {
          console.log('Fetched contractors:', data);
          setContractors(data);
        }
      } catch (error) {
        console.error('Error fetching contractors:', error);
        toast.error('Failed to load contractors');
      }
    };
    
    fetchContractors();
  }, []);

  useEffect(() => {
    const recipientType = form.watch("recipientType");
    
    if (recipientType === RecipientType.SUBCONTRACTOR) {
      setRecipientOptions(contractors);
    } else {
      setRecipientOptions([]);
    }

    if (form.getValues("recipientName")) {
      form.setValue("recipientName", "");
    }
  }, [form.watch("recipientType"), contractors]);

  useEffect(() => {
    const purpose = form.watch("purpose");
    setShowRemarks(purpose === AdvancePurpose.OTHER);
  }, [form.watch("purpose")]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      form.setValue("date", date);
      setIsCalendarOpen(false);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    try {
      if (isSubmitting) return;
      setIsSubmitting(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || user?.id;
      
      if (!userId) {
        toast.error("User authentication error. Please sign in again.");
        throw new Error("User authentication error. Please sign in again.");
      }
      
      const advanceData = {
        site_id: siteId,
        date: values.date instanceof Date ? values.date.toISOString() : new Date().toISOString(),
        recipient_name: values.recipientName,
        recipient_type: values.recipientType,
        purpose: values.purpose,
        amount: values.amount,
        remarks: values.remarks || "",
        created_by: userId,
        created_at: new Date().toISOString(),
        status: ApprovalStatus.PENDING,
      };
      
      console.log("Submitting advance:", advanceData);
      
      const { error } = await supabase
        .from('advances')
        .insert(advanceData);
        
      if (error) {
        console.error("Error inserting advance:", error);
        toast.error("Error adding advance: " + error.message);
        throw error;
      }
      
      toast.success("Advance submitted successfully");
      
      const advanceWithDateObj: Partial<Advance> = {
        date: new Date(advanceData.date),
        recipientName: advanceData.recipient_name,
        recipientType: advanceData.recipient_type,
        purpose: advanceData.purpose,
        amount: advanceData.amount,
        remarks: advanceData.remarks,
        status: advanceData.status,
        createdBy: advanceData.created_by,
        createdAt: new Date(advanceData.created_at),
        siteId: advanceData.site_id,
      };
      
      onSubmit(advanceWithDateObj);
      onClose();
    } catch (error) {
      console.error('Error submitting advance:', error);
      toast.error('Failed to submit advance: ' + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>New Advance</DialogTitle>
          <DialogDescription>
            Enter the details for the new advance payment.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Date picker field */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover 
                    open={isCalendarOpen}
                    onOpenChange={setIsCalendarOpen}
                  >
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
                            <span>Select a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={handleCalendarSelect}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recipient Type field - REMOVED SUPERVISOR OPTION AS REQUESTED */}
            <FormField
              control={form.control}
              name="recipientType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Recipient Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-wrap space-x-0 sm:space-x-4 gap-y-2"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={RecipientType.WORKER} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          Worker
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={RecipientType.SUBCONTRACTOR} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer flex items-center">
                          <Briefcase className="h-4 w-4 mr-1" />
                          Subcontractor
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recipient Name field */}
            <FormField
              control={form.control}
              name="recipientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Name</FormLabel>
                  <FormControl>
                    {form.watch("recipientType") === RecipientType.WORKER ? (
                      <Input 
                        placeholder="Enter worker name" 
                        {...field} 
                      />
                    ) : form.watch("recipientType") === RecipientType.SUBCONTRACTOR ? (
                      <SearchableDropdown
                        options={recipientOptions}
                        selectedVal={field.value}
                        handleChange={(val) => field.onChange(val)}
                        placeholder="Select subcontractor"
                        emptyMessage="No subcontractors found"
                        className="w-full"
                      />
                    ) : (
                      <Input 
                        placeholder="First select a recipient type" 
                        disabled={true} 
                        {...field}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue=""
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={AdvancePurpose.ADVANCE}>Advance</SelectItem>
                      <SelectItem value={AdvancePurpose.SAFETY_SHOES}>Safety Shoes</SelectItem>
                      <SelectItem value={AdvancePurpose.TOOLS}>Tools</SelectItem>
                      <SelectItem value={AdvancePurpose.OTHER}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showRemarks && (
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter remarks for this advance..." 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
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
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Advance
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
