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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { ExpenseCategory } from '@/lib/types';
import { useRouter } from 'next/navigation';

const expenseFormSchema = z.object({
  date: z.date({
    required_error: 'Date is required',
  }),
  description: z.string().min(2, {
    message: 'Description must be at least 2 characters.',
  }),
  category: z.nativeEnum(ExpenseCategory, {
    required_error: 'Category is required',
  }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  siteId: z.string({
    required_error: 'Site is required',
  }),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  siteId?: string;
  expense?: {
    id: string;
    date: Date;
    description: string;
    category: ExpenseCategory;
    amount: number;
  };
  isEditMode?: boolean;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ 
  siteId: propSiteId,
  expense,
  isEditMode
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      date: expense?.date || new Date(),
      description: expense?.description || '',
      category: expense?.category || ExpenseCategory.MISC,
      amount: expense?.amount?.toString() || '',
      siteId: propSiteId || '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('expense_categories')
          .select('name');

        if (error) {
          console.error('Error fetching expense categories:', error);
          toast.error('Failed to load expense categories');
        } else {
          setCategories(data.map((item) => item.name));
        }
      } catch (error) {
        console.error('Error fetching expense categories:', error);
        toast.error('Failed to load expense categories');
      }
    }

    fetchCategories();
  }, []);

  const site = {
    id: propSiteId || '',
  };

  const handleSubmit = async (values: ExpenseFormValues) => {
    setLoading(true);
    
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      if (!values.siteId) {
        throw new Error('Site ID is required');
      }
      
      if (isEditMode && expense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            date: values.date.toISOString(),
            description: values.description,
            category: values.category,
            amount: Number(values.amount),
            createdBy: user?.id, 
            site_id: values.siteId
          })
          .eq('id', expense.id);
        
        if (error) {
          console.error('Error updating expense:', error);
          toast.error('Failed to update expense');
        } else {
          toast.success('Expense updated successfully');
          router.push(`/sites/${values.siteId}`);
          router.refresh();
        }
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert({
            date: values.date.toISOString(),
            description: values.description,
            category: values.category,
            amount: Number(values.amount),
            createdBy: user?.id,
            site_id: values.siteId
          });
        
        if (error) {
          console.error('Error creating expense:', error);
          toast.error('Failed to create expense');
        } else {
          toast.success('Expense created successfully');
          form.reset();
          router.push(`/sites/${values.siteId}`);
          router.refresh();
        }
      }
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast.error('Failed to submit expense');
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = Object.values(ExpenseCategory).map((category) => (
    <option key={category} value={category}>
      {category}
    </option>
  ));

  const renderSite = () => {
    if (site) {
      return (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Site Details</h3>
          <p>
            Site ID: {site.id}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
      >
        {renderSite()}
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
                      variant={'outline'}
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
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                >
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Description" {...field} />
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
              <FormControl>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...field}
                >
                  <option value="">Select a category</option>
                  {categoryOptions}
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
                <Input type="number" placeholder="Amount" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="siteId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site ID</FormLabel>
              <FormControl>
                <Input placeholder="Site ID" {...field} disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </Button>
      </form>
    </Form>
  );
};

export default ExpenseForm;
