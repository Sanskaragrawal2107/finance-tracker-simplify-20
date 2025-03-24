import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CustomCard from '@/components/ui/CustomCard';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Expense, Invoice, PaymentStatus, MaterialItem } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Clock } from 'lucide-react';

interface InvoiceWithRowNumber extends Invoice {
  rowNumber: number;
}

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('site_invoices')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data) {
        setInvoices([]);
        return;
      }

      const formattedInvoices: Invoice[] = data.map((invoice: any) => ({
        id: invoice.id,
        date: new Date(invoice.date),
        partyId: invoice.party_id,
        partyName: invoice.party_name,
        material: invoice.material,
        quantity: invoice.quantity,
        rate: invoice.rate,
        gstPercentage: invoice.gst_percentage,
        grossAmount: invoice.gross_amount,
        netAmount: invoice.net_amount,
        materialItems: invoice.material_items as MaterialItem[] || [],
        bankDetails: invoice.bank_details || {
          accountNumber: '',
          bankName: '',
          ifscCode: '',
          email: '',
          mobile: ''
        },
        billUrl: invoice.bill_url,
        invoiceImageUrl: invoice.invoice_image_url || '',
        paymentStatus: invoice.payment_status as PaymentStatus,
        createdBy: invoice.created_by,
        createdAt: new Date(invoice.created_at),
        approverType: invoice.approver_type as "ho" | "supervisor",
        siteId: invoice.site_id,
        status: invoice.payment_status as PaymentStatus // Added status field to match the type
      }));

      setInvoices(formattedInvoices);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      setError(error.message || 'Failed to load invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveInvoice = async (invoice: Invoice) => {
    try {
      const updatedInvoice: Invoice = {
        ...invoice,
        paymentStatus: PaymentStatus.PAID,
        status: PaymentStatus.PAID,
      };

      const { error } = await supabase
        .from('site_invoices')
        .update({ payment_status: PaymentStatus.PAID })
        .eq('id', invoice.id);

      if (error) {
        throw error;
      }

      setInvoices(prevInvoices =>
        prevInvoices.map(inv => (inv.id === invoice.id ? updatedInvoice : inv))
      );
      toast.success('Invoice approved successfully');
    } catch (error: any) {
      console.error('Error approving invoice:', error);
      toast.error(error.message || 'Failed to approve invoice');
    }
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return 'text-green-600 bg-green-100';
      case PaymentStatus.PENDING:
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return <Check className="h-4 w-4" />;
      case PaymentStatus.PENDING:
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const columns = React.useMemo(
    () => [
      {
        header: '#',
        accessorKey: 'rowNumber',
        cell: (info: any) => info.getValue(),
      },
      {
        header: 'Date',
        accessorKey: 'date',
        cell: (info: any) => format(new Date(info.getValue()), 'dd MMM yyyy'),
      },
      {
        header: 'Party Name',
        accessorKey: 'partyName',
      },
      {
        header: 'Material',
        accessorKey: 'material',
      },
      {
        header: 'Net Amount',
        accessorKey: 'netAmount',
        cell: (info: any) => info.getValue().toLocaleString(),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }: any) => {
          const status = row.original.status;
          return (
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
              {getStatusIcon(status)}
              <span className="ml-1 capitalize">{status}</span>
            </div>
          );
        },
      },
      {
        header: 'Actions',
        cell: ({ row }: any) => (
          <Button size="sm" onClick={() => handleApproveInvoice(row.original)}>
            Approve
          </Button>
        ),
      },
    ],
    [handleApproveInvoice]
  );

  const data = React.useMemo(() => {
    const filteredInvoices = invoices.filter(invoice => {
      const searchStr = `${format(invoice.date, 'dd MMM yyyy')} ${invoice.partyName} ${invoice.material} ${invoice.netAmount}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });

    return filteredInvoices.map((invoice, index) => ({
      ...invoice,
      rowNumber: index + 1,
    }));
  }, [invoices, searchQuery]);

  return (
    <div className="container mx-auto py-6">
      <CustomCard>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading invoices...</p>
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : (
            <DataTable columns={columns} data={data} />
          )}
        </CardContent>
      </CustomCard>
    </div>
  );
};

export default Invoices;
