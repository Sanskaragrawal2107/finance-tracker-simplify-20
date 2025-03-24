import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  date: Date;
  amount: number;
  type: string;
  status: string;
  description?: string;
  recipient?: string;
}

interface TransactionHistoryProps {
  siteId: string;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ siteId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const [expenses, advances, funds] = await Promise.all([
          supabase.from('expenses').select('*').order('date', { ascending: false }),
          supabase.from('advances').select('*').order('date', { ascending: false }),
          supabase.from('funds_received').select('*').order('date', { ascending: false })
        ]);

        const formattedTransactions: Transaction[] = [
          ...(expenses.data || []).map((expense: any) => ({
            id: expense.id,
            date: new Date(expense.date),
            amount: expense.amount,
            type: 'expense',
            status: expense.status || 'completed',
            description: expense.description
          })),
          ...(advances.data || []).map((advance: any) => ({
            id: advance.id,
            date: new Date(advance.date),
            amount: advance.amount,
            type: 'advance',
            status: advance.status,
            recipient: advance.recipient_name
          })),
          ...(funds.data || []).map((fund: any) => ({
            id: fund.id,
            date: new Date(fund.date),
            amount: fund.amount,
            type: 'funds',
            status: 'received'
          }))
        ];

        setTransactions(formattedTransactions);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [siteId]);

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'expense':
        return 'bg-red-100 text-red-800';
      case 'advance':
        return 'bg-blue-100 text-blue-800';
      case 'funds':
        return 'bg-green-100 text-green-800';
    }
  };

  if (loading) {
    return <div>Loading transactions...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>
                {format(transaction.date, 'PPP')}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getTypeColor(transaction.type)}>
                  {transaction.type.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                ₹{transaction.amount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getStatusColor(transaction.status)}>
                  {transaction.status}
                </Badge>
              </TableCell>
              <TableCell>{transaction.description || '-'}</TableCell>
            </TableRow>
          ))}
          {transactions.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                No transactions found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
