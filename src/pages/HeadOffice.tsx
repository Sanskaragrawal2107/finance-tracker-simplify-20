import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { HeadOfficeTransaction } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';
import { Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { CalendarDateRangePicker } from "@/components/ui/calendar"
import { DateRange } from "react-day-picker"

const HeadOffice = () => {
  const [transactions, setTransactions] = useState<HeadOfficeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast()

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('head_office_transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching head office transactions:', error);
        return;
      }

      if (!data) {
        setTransactions([]);
        return;
      }

      const formattedTransactions: HeadOfficeTransaction[] = data.map(transaction => ({
        id: transaction.id,
        date: new Date(transaction.date),
        supervisorId: transaction.supervisor_id,
        supervisorName: transaction.supervisor_name,
        amount: transaction.amount,
        description: transaction.description || '',
        createdAt: new Date(transaction.created_at),
      }));

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error in fetchTransactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addDebit = async (debit: Omit<HeadOfficeTransaction, 'id' | 'createdAt' | 'date'>) => {
    try {
      const { data, error } = await supabase
        .from('head_office_transactions')
        .insert([
          {
            date: date?.from?.toISOString(),
            supervisor_id: debit.supervisorId,
            supervisor_name: debit.supervisorName,
            amount: debit.amount,
            description: debit.description,
          },
        ]);

      if (error) {
        console.error('Error adding head office transaction:', error);
        return { success: false, error };
      }

      fetchTransactions();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error adding head office transaction:', error);
      return { success: false, error: { message: error.message } };
    }
  };

  const handleAddTransaction = async () => {
    if (!date?.from || !supervisorId || !supervisorName || !amount) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields."
      })
      return;
    }

    try {
      const result = await addDebit({
        supervisorId,
        supervisorName,
        amount: parseFloat(amount),
        description,
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Transaction added successfully",
        })
        setSupervisorId('');
        setSupervisorName('');
        setAmount('');
        setDescription('');
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error?.message || 'Failed to add transaction'
        })
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Head Office Transactions</h1>

      <CustomCard className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Add Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !date?.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date?.from ? (
                        date.to ? (
                          `${format(date.from, "dd/MM/yyyy")} - ${format(date.to, "dd/MM/yyyy")}`
                        ) : (
                          format(date.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center" side="bottom">
                    <CalendarDateRangePicker
                      date={date}
                      onDateChange={setDate}
                      numberOfMonths={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisorId">Supervisor ID</Label>
                <Input
                  id="supervisorId"
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisorName">Supervisor Name</Label>
                <Input
                  id="supervisorName"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button onClick={handleAddTransaction}>Add Transaction</Button>
          </div>
        </CardContent>
      </CustomCard>

      <CustomCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4 text-sm text-muted-foreground">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-center py-4 text-sm text-muted-foreground">No transactions found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supervisor ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supervisor Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(transaction.date, 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {transaction.supervisorId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {transaction.supervisorName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {transaction.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {transaction.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </CustomCard>
    </div>
  );
};

export default HeadOffice;
