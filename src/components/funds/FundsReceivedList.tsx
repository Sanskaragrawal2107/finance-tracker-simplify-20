
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserRole } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FundsReceivedListProps {
  siteId: string;
  userRole: UserRole;
  isAdminView?: boolean;
  initialFundsReceived?: any[];
  onTransactionsUpdate?: () => void;
}

export function FundsReceivedList({
  siteId,
  userRole,
  isAdminView,
  initialFundsReceived,
  onTransactionsUpdate
}: FundsReceivedListProps) {
  const [fundsReceived, setFundsReceived] = useState(initialFundsReceived || []);
  const [loading, setLoading] = useState(!initialFundsReceived);

  useEffect(() => {
    if (!initialFundsReceived) {
      fetchFundsReceived();
    }
  }, [siteId]);

  const fetchFundsReceived = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      setFundsReceived(data || []);
    } catch (error) {
      console.error('Error fetching funds received:', error);
      toast.error('Failed to load funds received');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading funds received...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fundsReceived.length > 0 ? (
            fundsReceived.map((fund) => (
              <TableRow key={fund.id}>
                <TableCell>{format(new Date(fund.date), 'PPP')}</TableCell>
                <TableCell>{fund.method || 'N/A'}</TableCell>
                <TableCell>{fund.reference || 'N/A'}</TableCell>
                <TableCell className="text-right">
                  ₹{Number(fund.amount).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No funds received found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
