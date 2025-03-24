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
import { useAuth } from '@/hooks/use-auth';

interface SupervisorTransaction {
  id: string;
  date: string;
  amount: number;
  transaction_type: 'funds_received_from_supervisor' | 'advance_paid_to_supervisor';
  payer_supervisor: {
    name: string;
  };
  receiver_supervisor: {
    name: string;
  };
  site: {
    name: string;
    location: string;
  };
  created_at: string;
}

interface SupervisorTransactionHistoryProps {
  siteId?: string;
}

export function SupervisorTransactionHistory({ siteId }: SupervisorTransactionHistoryProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<SupervisorTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [siteId]);

  const fetchTransactions = async () => {
    try {
      let query = supabase
        .from('supervisor_transactions')
        .select(`
          *,
          payer_supervisor:payer_supervisor_id(name),
          receiver_supervisor:receiver_supervisor_id(name),
          site:site_id(name, location)
        `)
        .order('date', { ascending: false });

      if (siteId) {
        query = query.eq('site_id', siteId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching supervisor transactions:', error);
      toast.error('Failed to load supervisor transactions');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeColor = (type: SupervisorTransaction['transaction_type']) => {
    switch (type) {
      case 'funds_received_from_supervisor':
        return 'bg-green-100 text-green-800';
      case 'advance_paid_to_supervisor':
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return <div>Loading supervisor transactions...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Payer</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>
                {format(new Date(transaction.date), 'PPP')}
              </TableCell>
              <TableCell>
                <Badge className={getTransactionTypeColor(transaction.transaction_type)}>
                  {transaction.transaction_type.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell>{transaction.payer_supervisor.name}</TableCell>
              <TableCell>{transaction.receiver_supervisor.name}</TableCell>
              <TableCell>
                {transaction.site.name} - {transaction.site.location}
              </TableCell>
              <TableCell>
                ₹{transaction.amount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
            </TableRow>
          ))}
          {transactions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                No supervisor transactions found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
} 