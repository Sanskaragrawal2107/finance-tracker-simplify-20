import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Expense, ExpenseCategory, ApprovalStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: Partial<Expense>) => void;
  siteId?: string;
  editExpense?: Expense;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSubmit, siteId, editExpense }) => {
  const [formData, setFormData] = useState({
    date: new Date(),
    description: '',
    category: ExpenseCategory.MISC,
    amount: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!editExpense;
  const [expense, setExpense] = useState<Partial<Expense> | null>(null);
  const expenseId = editExpense?.id;

  const { user } = useAuth();

  useEffect(() => {
    if (editExpense) {
      setFormData({
        date: editExpense.date,
        description: editExpense.description,
        category: editExpense.category as ExpenseCategory,
        amount: editExpense.amount,
      });
    }
  }, [editExpense]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prevData => ({
      ...prevData,
      category: value,
    }));
  };

  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);
      
      if (!formData.date || !formData.description || !formData.category || !formData.amount || !siteId) {
        toast.error('Please fill in all fields.');
        return;
      }
      
      const newExpense: Partial<Expense> = {
        date: formData.date,
        description: formData.description,
        category: formData.category,
        amount: formData.amount,
        siteId: siteId,
        createdBy: user?.id || '', // Changed from created_by to createdBy
        status: ApprovalStatus.PENDING, // Changed from string to enum value
        supervisorId: user?.id
      };
      
      if (isEditMode && expenseId) {
        const { data, error } = await supabase
          .from('expenses')
          .update(newExpense)
          .eq('id', expenseId)
          .select()
        
        if (error) {
          console.error('Error updating expense:', error);
          toast.error('Failed to update expense.');
          return;
        }
        
        toast.success('Expense updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert([newExpense])
          .select()
        
        if (error) {
          console.error('Error creating expense:', error);
          toast.error('Failed to create expense.');
          return;
        }
        
        toast.success('Expense created successfully!');
      }
      
      onSubmit(newExpense);
      onClose();
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast.error('Failed to submit expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchExpense = async () => {
      if (!isEditMode || !expenseId) {
        return;
      }
        
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', expenseId)
          .limit(1)
          
        if (error) {
          console.error('Error fetching expense:', error);
          toast.error('Failed to fetch expense.');
          return;
        }
        
        if (data) {
          const expenseData = data[0];
          setFormData({
            date: new Date(expenseData.date),
            description: expenseData.description,
            category: expenseData.category,
            amount: expenseData.amount,
          });
            
          const expenseObj: Partial<Expense> = {
            id: expenseData.id,
            date: new Date(expenseData.date),
            description: expenseData.description,
            category: expenseData.category,
            amount: expenseData.amount,
            status: expenseData.status as ApprovalStatus,
            createdBy: expenseData.created_by, // Changed from created_by to createdBy
            createdAt: new Date(expenseData.created_at),
            siteId: expenseData.site_id
          };
          
          setExpense(expenseObj);
        }
      } catch (error) {
        console.error('Error fetching expense:', error);
        toast.error('Failed to fetch expense.');
      }
    };
    
    if (isOpen) {
      fetchExpense();
    }
  }, [isEditMode, expenseId, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Date
            </Label>
            <Input
              type="date"
              id="date"
              name="date"
              className="col-span-3"
              value={format(new Date(formData.date), 'yyyy-MM-dd')}
              onChange={handleChange as any}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              className="col-span-3"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Select onValueChange={handleSelectChange}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a category" defaultValue={formData.category} />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ExpenseCategory).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input
              type="number"
              id="amount"
              name="amount"
              className="col-span-3"
              value={formData.amount}
              onChange={handleChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={() => handleSubmit(formData)} disabled={isSubmitting}>
            {isEditMode ? 'Update Expense' : 'Add Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseForm;
