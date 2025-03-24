
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SupervisorTransaction } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface SupervisorTransactionHistoryProps {
  siteId?: string;
  supervisorId?: string;
  className?: string;
}

const SupervisorTransactionHistory: React.FC<SupervisorTransactionHistoryProps> = ({
  siteId,
  supervisorId,
  className
}) => {
  const [transactions, setTransactions] = useState<SupervisorTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('supervisor_transactions')
        .select(`
          id,
          date,
          amount,
          transaction_type,
          created_at,
          payer_supervisor_id,
          receiver_supervisor_id,
          payer_site_id,
          receiver_site_id,
          payer_users:payer_supervisor_id(name),
          receiver_users:receiver_supervisor_id(name)
        `)
        .order('date', { ascending: false });

      // Filter by site if provided
      if (siteId) {
        query = query.or(`payer_site_id.eq.${siteId},receiver_site_id.eq.${siteId}`);
      }

      // Filter by supervisor if provided
      if (supervisorId) {
        query = query.or(`payer_supervisor_id.eq.${supervisorId},receiver_supervisor_id.eq.${supervisorId}`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        const formattedTransactions: SupervisorTransaction[] = data.map(item => ({
          id: item.id,
          date: new Date(item.date),
          payerSupervisorId: item.payer_supervisor_id,
          payerSupervisorName: item.payer_users?.name || 'Unknown',
          receiverSupervisorId: item.receiver_supervisor_id,
          receiverSupervisorName: item.receiver_users?.name || 'Unknown',
          payerSiteId: item.payer_site_id,
          receiverSiteId: item.receiver_site_id,
          amount: Number(item.amount),
          transactionType: item.transaction_type,
          createdAt: new Date(item.created_at)
        }));

        setTransactions(formattedTransactions);
      }
    } catch (error) {
      console.error('Error fetching supervisor transactions:', error);
      toast.error('Failed to load supervisor transactions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (siteId || supervisorId) {
      fetchTransactions();
    } else {
      setTransactions([]);
      setIsLoading(false);
    }
  }, [siteId, supervisorId]);

  const handleRefresh = () => {
    fetchTransactions();
  };

  if (isLoading) {
    return (
      <CustomCard className={className}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Supervisor Transactions</h3>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled>
            <Skeleton className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center border-b pb-2">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </CustomCard>
    );
  }

  if (transactions.length === 0) {
    return (
      <CustomCard className={className}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Supervisor Transactions</h3>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <ArrowUp className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
        <div className="py-8 text-center text-muted-foreground">
          <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No supervisor transactions found</p>
        </div>
      </CustomCard>
    );
  }

  return (
    <CustomCard className={className}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Supervisor Transactions</h3>
        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <ArrowUp className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>
      <div className="space-y-3 divide-y">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="pt-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">
                  {transaction.transactionType === 'funds_received' ? (
                    <>
                      <ArrowDown className="h-4 w-4 inline text-green-600 mr-1" />
                      Funds From: {transaction.payerSupervisorName}
                    </>
                  ) : (
                    <>
                      <ArrowUp className="h-4 w-4 inline text-orange-600 mr-1" />
                      Advance To: {transaction.receiverSupervisorName}
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(transaction.date, 'dd MMM yyyy')}
                </p>
              </div>
              <span className={`font-medium ${
                transaction.transactionType === 'funds_received' ? 'text-green-600' : 'text-orange-600'
              }`}>
                ₹{transaction.amount.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </CustomCard>
  );
};

export default SupervisorTransactionHistory;
