
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoiceListProps {
  siteId: string;
  userRole: UserRole;
  isAdminView?: boolean;
  initialInvoices?: any[];
  onTransactionsUpdate?: () => void;
}

export function InvoiceList({
  siteId,
  userRole,
  isAdminView,
  initialInvoices,
  onTransactionsUpdate
}: InvoiceListProps) {
  const [invoices, setInvoices] = useState(initialInvoices || []);
  const [loading, setLoading] = useState(!initialInvoices);

  useEffect(() => {
    if (!initialInvoices) {
      fetchInvoices();
    }
  }, [siteId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_invoices')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div>Loading invoices...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Party Name</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length > 0 ? (
            invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{format(new Date(invoice.date), 'PPP')}</TableCell>
                <TableCell>{invoice.party_name}</TableCell>
                <TableCell>{invoice.material}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(invoice.payment_status)}>
                    {invoice.payment_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  ₹{Number(invoice.net_amount).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                No invoices found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
