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
import { useRouter } from 'next/router'; // Change to react-router-dom if needed

const expenseSchema = z.object({
  date: z.date({
    required_error: 'Date is required',
  }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  category: z.string({
    required_error: 'Category is required',
  }),
  description: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  siteId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ 
  siteId,
  onSuccess,
  onClose
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
      amount: '',
      category: '',
      description: '',
    },
  });

  // Fetch expense categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Hard-code categories since there's no expense_categories table
        const predefinedCategories = [
          { id: 'material', name: 'Material' },
          { id: 'labor', name: 'Labor' },
          { id: 'equipment', name: 'Equipment' },
          { id: 'transportation', name: 'Transportation' },
          { id: 'utilities', name: 'Utilities' },
          { id: 'other', name: 'Other' }
        ];
        
        setCategories(predefinedCategories);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load expense categories');
        setIsLoading(false);
      }
    };
    
    fetchCategories();
  }, []);

  const handleExpenseSubmit = async (values: ExpenseFormValues) => {
    if (!user) {
      toast.error('You must be logged in to perform this action');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const expenseData = {
        date: values.date.toISOString(),
        amount: Number(values.amount),
        category: values.category,
        description: values.description,
        site_id: siteId,
        created_by: user.id
      };
      
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select('*')
        .single();
      
      if (error) throw error;
      
      toast.success('Expense added successfully');
      form.reset();
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('Failed to add expense');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleExpenseSubmit)} className="space-y-4">
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
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

        <div className="flex justify-end gap-2 pt-4">
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Expense'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ExpenseForm;
