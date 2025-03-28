import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Eye } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

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

  const handleDeleteInvoice = async () => {
    if (!selectedInvoiceId) return;
    
    try {
      const { error } = await supabase
        .from('site_invoices')
        .delete()
        .eq('id', selectedInvoiceId);
        
      if (error) throw error;
      
      toast.success('Invoice deleted successfully');
      // Refresh the invoice list
      fetchInvoices();
      // Update parent component
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice');
    } finally {
      setShowDeleteDialog(false);
      setSelectedInvoiceId(null);
    }
  };

  const showDeleteConfirmation = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setShowDeleteDialog(true);
  };

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowViewDialog(true);
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

  const showDeleteButton = userRole === UserRole.ADMIN || isAdminView;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Party Name</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
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
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                        onClick={() => handleViewInvoice(invoice)}
                        title="View Invoice Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {showDeleteButton && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => showDeleteConfirmation(invoice.id)}
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No invoices found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this invoice. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteInvoice}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Invoice Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              View complete information about this invoice
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Date</h3>
                  <p>{format(new Date(selectedInvoice.date), 'PPP')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Party Name</h3>
                  <p>{selectedInvoice.party_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Vendor Name</h3>
                  <p>{selectedInvoice.vendor_name || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Invoice Number</h3>
                  <p>{selectedInvoice.invoice_number || 'N/A'}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Material</h3>
                <p>{selectedInvoice.material}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Quantity</h3>
                  <p>{selectedInvoice.quantity}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Rate</h3>
                  <p>₹{selectedInvoice.rate.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">GST %</h3>
                  <p>{selectedInvoice.gst_percentage}%</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Gross Amount</h3>
                  <p>₹{selectedInvoice.gross_amount.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Net Amount</h3>
                  <p className="font-semibold">₹{selectedInvoice.net_amount.toLocaleString('en-IN')}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Payment Status</h3>
                <Badge className={getStatusColor(selectedInvoice.payment_status)}>
                  {selectedInvoice.payment_status}
                </Badge>
              </div>

              {/* Display invoice image if available */}
              {selectedInvoice.invoice_image_url && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Invoice Image</h3>
                  <div className="border rounded-md overflow-hidden">
                    <img 
                      src={selectedInvoice.invoice_image_url} 
                      alt="Invoice" 
                      className="max-h-[300px] object-contain w-full"
                    />
                  </div>
                </div>
              )}

              {/* Display bill image if available */}
              {selectedInvoice.bill_url && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Bill Image</h3>
                  <div className="border rounded-md overflow-hidden">
                    <img 
                      src={selectedInvoice.bill_url} 
                      alt="Bill" 
                      className="max-h-[300px] object-contain w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
