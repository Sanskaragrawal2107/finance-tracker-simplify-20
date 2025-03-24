
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { SupervisorTransaction } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee } from 'lucide-react';

interface SupervisorTransactionHistoryProps {
  siteId: string;
  className?: string;
}

const SupervisorTransactionHistory: React.FC<SupervisorTransactionHistoryProps> = ({ siteId, className }) => {
  const [transactions, setTransactions] = useState<SupervisorTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [siteId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch transactions where this site is either the payer or receiver
      const { data: transactionsData, error } = await supabase
        .from('supervisor_transactions')
        .select(`
          *,
          payer_supervisor:payer_supervisor_id(name),
          receiver_supervisor:receiver_supervisor_id(name)
        `)
        .or(`payer_site_id.eq.${siteId},receiver_site_id.eq.${siteId}`)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error fetching supervisor transactions:', error);
        return;
      }
      
      if (!transactionsData) {
        setTransactions([]);
        return;
      }

      // Transform the data to match our SupervisorTransaction interface
      const formattedTransactions: SupervisorTransaction[] = transactionsData.map(transaction => ({
        id: transaction.id,
        date: new Date(transaction.date),
        payerSupervisorId: transaction.payer_supervisor_id,
        payerSupervisorName: transaction.payer_supervisor?.name || 'Unknown',
        receiverSupervisorId: transaction.receiver_supervisor_id,
        receiverSupervisorName: transaction.receiver_supervisor?.name || 'Unknown',
        payerSiteId: transaction.payer_site_id,
        receiverSiteId: transaction.receiver_site_id,
        amount: transaction.amount,
        transactionType: transaction.transaction_type as 'funds_received' | 'advance_paid',
        createdAt: new Date(transaction.created_at),
      }));
      
      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error in fetchTransactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomCard className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            {loading ? (
              <p className="text-center py-4 text-sm text-muted-foreground">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">No transactions found</p>
            ) : (
              <div className="space-y-3 mt-2">
                {transactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="flex justify-between items-center p-3 border rounded-md text-sm hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {transaction.transactionType === 'funds_received' 
                          ? `Funds from ${transaction.payerSupervisorName}` 
                          : `Advance to ${transaction.receiverSupervisorName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{format(transaction.date, 'dd MMM yyyy')}</p>
                    </div>
                    <div className={`font-medium ${transaction.transactionType === 'funds_received' && siteId === transaction.receiverSiteId ? 'text-green-600' : 'text-red-600'}`}>
                      <div className="flex items-center">
                        <IndianRupee className="h-3 w-3 mr-1" />
                        {transaction.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="recent">
            {loading ? (
              <p className="text-center py-4 text-sm text-muted-foreground">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">No transactions found</p>
            ) : (
              <div className="space-y-3 mt-2">
                {transactions.slice(0, 5).map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="flex justify-between items-center p-3 border rounded-md text-sm hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {transaction.transactionType === 'funds_received' 
                          ? `Funds from ${transaction.payerSupervisorName}` 
                          : `Advance to ${transaction.receiverSupervisorName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{format(transaction.date, 'dd MMM yyyy')}</p>
                    </div>
                    <div className={`font-medium ${transaction.transactionType === 'funds_received' && siteId === transaction.receiverSiteId ? 'text-green-600' : 'text-red-600'}`}>
                      <div className="flex items-center">
                        <IndianRupee className="h-3 w-3 mr-1" />
                        {transaction.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </CustomCard>
  );
};

export default SupervisorTransactionHistory;
