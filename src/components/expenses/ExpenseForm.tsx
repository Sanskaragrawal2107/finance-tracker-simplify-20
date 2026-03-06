import React, { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Trash2, Mic } from "lucide-react";
import VoiceMicButton from '@/components/common/VoiceMicButton';
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
import { cn } from "@/lib/utils";
import { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLoadingState } from "@/hooks/use-loading-state";

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: Partial<Expense>) => void;
  siteId?: string;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  purpose: z.string().min(3, {
    message: "Purpose description must be at least 3 characters",
  }),
  category: z.string({
    required_error: "Category is required",
  }),
  amount: z.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).positive({
    message: "Amount must be a positive number",
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface ExpenseItem {
  id: string;
  date: Date;
  purpose: string;
  category: string;
  amount: number;
}

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_MODEL  = 'gemini-2.5-flash-lite';

const ExpenseForm: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSubmit, siteId }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useLoadingState(false, 45000);
  const { user } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      purpose: "",
      category: "",
      amount: undefined,
    },
  });

  React.useEffect(() => {
    form.setValue("date", selectedDate);
  }, [selectedDate, form]);

  const analyzePurpose = async (purposeText: string) => {
    if (!purposeText || purposeText.length < 3) return;
    setIsAnalyzing(true);
    try {
      const prompt = `You are an expense classifier for a construction company. Classify the following expense description into exactly ONE category from the list below.

Expense description: "${purposeText}"

Available categories (return the EXACT text of one):
${EXPENSE_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Rules:
- Return ONLY the category name, nothing else.
- No punctuation, no explanation, no quotes.
- If unsure, pick the closest match.`;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { temperature: 0.1, maxOutputTokens: 40 },
      });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();

      // Normalised matching — try exact first, then substring
      const normalise = (s: string) => s.toUpperCase().replace(/[^A-Z0-9&.]/g, ' ').replace(/\s+/g, ' ').trim();
      const normRaw = normalise(raw);
      const matched =
        EXPENSE_CATEGORIES.find(cat => normalise(cat) === normRaw) ||
        EXPENSE_CATEGORIES.find(cat => normRaw.includes(normalise(cat))) ||
        EXPENSE_CATEGORIES.find(cat => normalise(cat).includes(normRaw));

      if (matched) {
        form.setValue('category', matched);
        setAiSuggestedCategory(matched);
        toast.success(`AI suggested: ${matched}`, { duration: 2500 });
      }
    } catch (err) {
      console.error('Error analyzing purpose:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addExpenseToList = (values: FormValues) => {
    const newExpense: ExpenseItem = {
      id: Date.now().toString(),
      date: values.date,
      purpose: values.purpose,
      category: values.category,
      amount: values.amount,
    };
    
    console.log("Adding expense to list:", newExpense);
    setExpenses([...expenses, newExpense]);
    
    form.reset({
      date: selectedDate,
      purpose: "",
      category: "",
      amount: undefined,
    });
    setAiSuggestedCategory(null);
    toast.success("Expense added to the list");
  };
  
  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(expense => expense.id !== id));
    toast.info("Expense removed");
  };

  const submitAllExpenses = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      console.log("Submitting all expenses:", expenses);
      
      // Get current user ID from auth
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
      
      // Create an array to store all promises
      const promises = expenses.map(expense => {
        const newExpense: Partial<Expense> = {
          date: expense.date,
          description: expense.purpose,
          category: expense.category as unknown as ExpenseCategory,
          amount: expense.amount,
          status: "pending" as any,
          siteId: siteId,
          createdBy: userId,
          created_at: new Date(),
        };
        
        return supabase
          .from('expenses')
          .insert({
            date: newExpense.date instanceof Date ? newExpense.date.toISOString() : new Date().toISOString(),
            description: newExpense.description || '',
            category: newExpense.category,
            amount: newExpense.amount || 0,
            site_id: siteId,
            created_by: userId,
            created_at: new Date().toISOString()
          })
          .then(({ data, error }) => {
            if (error) {
              console.error("Error inserting expense:", error);
              throw error;
            }
            console.log("Successfully inserted expense:", data);
            return data;
          });
      });
      
      await Promise.all(promises);
      
      setExpenses([]);
      form.reset();
      onClose();
      
      if (expenses.length > 0) {
        toast.success(`${expenses.length} expenses submitted successfully`);
        onSubmit({} as Partial<Expense>); // Trigger the parent's onSubmit to refresh the data
      }
    } catch (error) {
      console.error("Error submitting expenses:", error);
      toast.error("Failed to submit one or more expenses: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Get current user ID from auth
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
      
      const newExpense: Partial<Expense> = {
        date: values.date,
        description: values.purpose,
        category: values.category as unknown as ExpenseCategory,
        amount: values.amount,
        status: "pending" as any,
        siteId: siteId,
        createdBy: userId,
        created_at: new Date(),
      };
      
      console.log("Submitting single expense:", newExpense);
      
      const { error } = await supabase
        .from('expenses')
        .insert({
          date: newExpense.date instanceof Date ? newExpense.date.toISOString() : new Date().toISOString(),
          description: newExpense.description || '',
          category: newExpense.category,
          amount: newExpense.amount || 0,
          site_id: siteId,
          created_by: userId,
          created_at: new Date().toISOString()
        });
        
      if (error) {
        console.error("Error inserting expense:", error);
        toast.error("Error adding expense: " + error.message);
        throw error;
      }
      
      form.reset();
      setExpenses([]);
      onClose();
      toast.success("Expense submitted successfully");
      onSubmit(newExpense); // Trigger the parent's onSubmit to refresh the data
    } catch (error) {
      console.error("Error submitting expense:", error);
      toast.error("Failed to submit expense: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurposeBlur = () => {
    const purposeValue = form.getValues("purpose");
    if (purposeValue && purposeValue.length >= 3) {
      analyzePurpose(purposeValue);
    }
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      form.setValue("date", date);
      setDatePickerOpen(false); // Close the datepicker after selection
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>New Expense</DialogTitle>
          <DialogDescription>
            Enter the details for the new expense. Add multiple expenses before submitting.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(addExpenseToList)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                            format(field.value, "dd/MM/yyyy")
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
                        onSelect={handleDateChange}
                        defaultMonth={field.value ?? new Date()}
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
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Textarea 
                        placeholder="Describe the purpose of this expense..." 
                        className="resize-none pr-10" 
                        {...field} 
                        onBlur={handlePurposeBlur}
                      />
                      <VoiceMicButton
                        onTranscript={(t) => form.setValue('purpose', field.value ? `${field.value} ${t}` : t)}
                        className="absolute right-2 top-2"
                        append
                        currentValue={field.value}
                      />
                    </div>
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
                  <FormLabel className="flex items-center gap-2">
                    Category
                    {isAnalyzing ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI analysing…
                      </span>
                    ) : aiSuggestedCategory && field.value === aiSuggestedCategory ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                        ✦ AI suggested
                      </span>
                    ) : null}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue=""
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="secondary">
                <Plus className="h-4 w-4 mr-2" />
                Add to List
              </Button>
            </div>
          </form>
        </Form>

        {expenses.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-medium">Expenses List ({expenses.length})</h3>
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-start justify-between gap-2 border rounded-md p-3 bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{expense.purpose}</p>
                    <p className="text-xs text-muted-foreground">{format(expense.date, 'MMM dd')} · {expense.category}</p>
                    <p className="text-sm font-semibold text-primary">₹{expense.amount.toLocaleString('en-IN')}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 flex-shrink-0" 
                    onClick={() => removeExpense(expense.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto" disabled={isSubmitting}>
            Cancel
          </Button>
          {expenses.length > 0 ? (
            <Button 
              type="button" 
              onClick={submitAllExpenses} 
              className="w-full sm:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit All Expenses"
              )}
            </Button>
          ) : (
            <Button 
              type="button" 
              onClick={form.handleSubmit(handleSingleSubmit)} 
              className="w-full sm:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Expense"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseForm;
