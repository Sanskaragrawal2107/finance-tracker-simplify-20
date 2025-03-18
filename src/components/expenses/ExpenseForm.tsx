
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
import SearchableDropdown from './SearchableDropdown';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Expense, ExpenseCategory } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: Partial<Expense>) => void;
  siteId?: string;
  defaultExpense?: Partial<Expense>;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  description: z.string().min(2, {
    message: "Description must be at least 2 characters.",
  }),
  category: z.string({
    required_error: "Category is required",
  }),
  amount: z.coerce.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).positive({
    message: "Amount must be a positive number",
  }),
});

type FormValues = z.infer<typeof formSchema>;

const ExpenseForm: React.FC<ExpenseFormProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  siteId,
  defaultExpense 
}) => {
  const [otherCategory, setOtherCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Set default values, using provided expense data if available
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: defaultExpense?.date || new Date(),
      description: defaultExpense?.description || '',
      category: defaultExpense?.category || '',
      amount: defaultExpense?.amount || undefined,
    },
  });

  const selectedCategory = form.watch('category');
  const isOtherSelected = selectedCategory === 'other';

  const handleSubmit = async (values: FormValues) => {
    // Prevent multiple submissions
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Use the "Other" category value if selected
      const finalCategory = isOtherSelected ? otherCategory : values.category;
      
      if (isOtherSelected && !otherCategory) {
        form.setError('category', { 
          type: 'manual', 
          message: 'Please specify the other category' 
        });
        setIsSubmitting(false);
        return;
      }
      
      if (!siteId) {
        throw new Error("Site ID is required");
      }
      
      // Prepare expense data for database (snake_case)
      const expenseData = {
        site_id: siteId,
        date: values.date.toISOString(),
        description: values.description,
        category: finalCategory,
        amount: values.amount,
        created_by: "system", // This should ideally be the current user's ID
      };
      
      console.log("Submitting expense:", expenseData);

      // If we're updating an existing expense
      if (defaultExpense?.id) {
        const { data, error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', defaultExpense.id)
          .select()
          .single();
          
        if (error) {
          console.error("Error updating expense:", error);
          throw error;
        }
        
        // Convert to camelCase for application
        const updatedExpense: Partial<Expense> = {
          id: data.id,
          siteId: data.site_id,
          date: new Date(data.date),
          description: data.description,
          category: data.category,
          amount: data.amount,
          createdBy: data.created_by,
          createdAt: new Date(data.created_at),
          supervisorId: "system", // This should ideally be set correctly
        };
        
        onSubmit(updatedExpense);
        toast.success("Expense updated successfully");
      } 
      // Creating a new expense
      else {
        const { data, error } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select()
          .single();
          
        if (error) {
          console.error("Error inserting expense:", error);
          throw error;
        }
        
        // Convert to camelCase for application
        const newExpense: Partial<Expense> = {
          id: data.id,
          siteId: data.site_id,
          date: new Date(data.date),
          description: data.description,
          category: data.category,
          amount: data.amount,
          createdBy: data.created_by,
          createdAt: new Date(data.created_at),
          supervisorId: "system", // This should ideally be set correctly
        };
        
        onSubmit(newExpense);
        toast.success("Expense added successfully");
      }
      
      // Reset form and close dialog
      form.reset();
      onClose();
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast.error('Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{defaultExpense?.id ? 'EDIT' : 'ADD'} EXPENSE</DialogTitle>
          <DialogDescription>
            Enter the details for the expense.
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DESCRIPTION</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter expense description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CATEGORY</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(ExpenseCategory).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">OTHER</SelectItem>
                    </SelectContent>
                  </Select>
                  {isOtherSelected && (
                    <Input
                      className="mt-2"
                      placeholder="Specify category"
                      value={otherCategory}
                      onChange={(e) => setOtherCategory(e.target.value)}
                    />
                  )}
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
                    {defaultExpense?.id ? 'UPDATING...' : 'SUBMITTING...'}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {defaultExpense?.id ? 'UPDATE' : 'SUBMIT'}
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

export default ExpenseForm;
