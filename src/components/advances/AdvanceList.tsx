
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdvanceListProps {
  siteId: string;
  userRole: UserRole;
  isAdminView?: boolean;
  initialAdvances?: any[];
  onTransactionsUpdate?: () => void;
}

export function AdvanceList({
  siteId,
  userRole,
  isAdminView,
  initialAdvances,
  onTransactionsUpdate
}: AdvanceListProps) {
  const [advances, setAdvances] = useState(initialAdvances || []);
  const [loading, setLoading] = useState(!initialAdvances);

  useEffect(() => {
    if (!initialAdvances) {
      fetchAdvances();
    }
  }, [siteId]);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      setAdvances(data || []);
    } catch (error) {
      console.error('Error fetching advances:', error);
      toast.error('Failed to load advances');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div>Loading advances...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {advances.length > 0 ? (
            advances.map((advance) => (
              <TableRow key={advance.id}>
                <TableCell>{format(new Date(advance.date), 'PPP')}</TableCell>
                <TableCell>{advance.recipient_name}</TableCell>
                <TableCell>{advance.purpose}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(advance.status)}>
                    {advance.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  ₹{Number(advance.amount).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                No advances found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
