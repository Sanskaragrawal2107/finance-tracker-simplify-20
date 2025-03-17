import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Download, Filter, Search, ChevronLeft, ChevronRight, Eye, CreditCard, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase, fetchSiteInvoices } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Site, Invoice, PaymentStatus, MaterialItem, BankDetails } from '@/lib/types';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import InvoiceDetails from '@/components/invoices/InvoiceDetails';

interface SiteDetailTransactionsProps {
  site: Site;
  supervisor?: any; // Made this prop optional
}

const getStatusColor = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID:
      return 'bg-green-100 text-green-800';
    case PaymentStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const SiteDetailTransactions: React.FC<SiteDetailTransactionsProps> = ({ site, supervisor }) => {
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadInvoices = async () => {
      setIsLoading(true);
      try {
        const siteInvoices = await fetchSiteInvoices(site.id);
        setInvoices(siteInvoices);
      } catch (error) {
        console.error('Error loading invoices:', error);
        toast({
          title: "Failed to load invoices",
          description: "There was an error loading the site invoices.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInvoices();
  }, [site.id, toast]);

  const filteredInvoices = invoices.filter(invoice => 
    invoice.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.id.includes(searchTerm)
  );

  const handleCreateInvoice = async (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('site_invoices')
        .insert({
          date: invoice.date.toISOString(),
          party_id: invoice.partyId,
          party_name: invoice.partyName,
          material: invoice.material,
          quantity: invoice.quantity,
          rate: invoice.rate,
          gst_percentage: invoice.gstPercentage,
          gross_amount: invoice.grossAmount,
          net_amount: invoice.netAmount,
          material_items: JSON.stringify(invoice.materialItems),
          bank_details: JSON.stringify(invoice.bankDetails),
          bill_url: invoice.billUrl,
          payment_status: invoice.paymentStatus,
          created_by: invoice.createdBy,
          approver_type: invoice.approverType,
          site_id: site.id
        })
        .select();
        
      if (error) {
        console.error('Error creating invoice:', error);
        toast({
          title: "Invoice Creation Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      if (data && data.length > 0) {
        let materialItems: MaterialItem[] = [];
        try {
          if (typeof data[0].material_items === 'object' && data[0].material_items !== null) {
            if (Array.isArray(data[0].material_items)) {
              materialItems = (data[0].material_items as any[]).map(item => ({
                id: item.id || undefined,
                material: item.material || '',
                quantity: typeof item.quantity === 'number' ? item.quantity : null,
                rate: typeof item.rate === 'number' ? item.rate : null,
                gstPercentage: typeof item.gstPercentage === 'number' ? item.gstPercentage : null,
                amount: typeof item.amount === 'number' ? item.amount : null
              }));
            }
          } else if (data[0].material_items) {
            const parsedItems = JSON.parse(data[0].material_items as string || '[]');
            if (Array.isArray(parsedItems)) {
              materialItems = parsedItems.map(item => ({
                id: item.id || undefined,
                material: item.material || '',
                quantity: typeof item.quantity === 'number' ? item.quantity : null,
                rate: typeof item.rate === 'number' ? item.rate : null,
                gstPercentage: typeof item.gstPercentage === 'number' ? item.gstPercentage : null,
                amount: typeof item.amount === 'number' ? item.amount : null
              }));
            }
          }
        } catch (e) {
          console.error('Error parsing material items:', e);
          materialItems = [];
        }
        
        let bankDetails: BankDetails = {
          accountNumber: '',
          bankName: '',
          ifscCode: ''
        };
        
        try {
          if (typeof data[0].bank_details === 'object' && data[0].bank_details !== null) {
            const typedBankDetails = data[0].bank_details as Record<string, any>;
            bankDetails = {
              accountNumber: typedBankDetails.accountNumber || '',
              bankName: typedBankDetails.bankName || '',
              ifscCode: typedBankDetails.ifscCode || ''
            };
          } else if (data[0].bank_details) {
            const parsedDetails = JSON.parse(data[0].bank_details as string || '{}');
            bankDetails = {
              accountNumber: parsedDetails.accountNumber || '',
              bankName: parsedDetails.bankName || '',
              ifscCode: parsedDetails.ifscCode || ''
            };
          }
        } catch (e) {
          console.error('Error parsing bank details:', e);
        }
        
        const newInvoice: Invoice = {
          id: data[0].id,
          date: new Date(data[0].date),
          partyId: data[0].party_id,
          partyName: data[0].party_name,
          material: data[0].material,
          quantity: Number(data[0].quantity),
          rate: Number(data[0].rate),
          gstPercentage: Number(data[0].gst_percentage),
          grossAmount: Number(data[0].gross_amount),
          netAmount: Number(data[0].net_amount),
          materialItems: materialItems,
          bankDetails: bankDetails,
          billUrl: data[0].bill_url,
          paymentStatus: data[0].payment_status as PaymentStatus,
          createdBy: data[0].created_by || '',
          createdAt: new Date(data[0].created_at),
          approverType: data[0].approver_type as "ho" | "supervisor" || "ho",
          siteId: data[0].site_id || ''
        };
        
        setInvoices([newInvoice, ...invoices]);
        
        toast({
          title: "Invoice Created",
          description: `Invoice for ${invoice.partyName} has been created successfully.`,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive"
      });
    }
    
    setIsCreateDialogOpen(false);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handleMakePayment = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('site_invoices')
        .update({ 
          payment_status: PaymentStatus.PAID 
        })
        .eq('id', invoice.id);
        
      if (error) {
        console.error('Error updating payment status:', error);
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      const updatedInvoices = invoices.map(inv => {
        if (inv.id === invoice.id) {
          return {
            ...inv,
            paymentStatus: PaymentStatus.PAID
          };
        }
        return inv;
      });
      
      setInvoices(updatedInvoices);
      setIsViewDialogOpen(false);
      
      toast({
        title: "Payment Successful",
        description: `Payment of ₹${invoice.netAmount.toLocaleString()} has been processed successfully.`,
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    toast({
      title: "Download Started",
      description: `Download for invoice ${invoice.partyId} has started.`,
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="invoices" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="funds">Funds Received</TabsTrigger>
        </TabsList>
        
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search invoices..." 
                className="py-2 pl-10 pr-4 border rounded-md w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New Invoice
              </Button>
            </div>
          </div>
          
          <div className="bg-white rounded-md border shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading invoices...</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 pl-4 font-medium text-muted-foreground">Date</th>
                        <th className="pb-3 font-medium text-muted-foreground">Party Name</th>
                        <th className="pb-3 font-medium text-muted-foreground">Material</th>
                        <th className="pb-3 font-medium text-muted-foreground">Net Taxable Amount</th>
                        <th className="pb-3 font-medium text-muted-foreground">GST</th>
                        <th className="pb-3 font-medium text-muted-foreground">Grand Net Total</th>
                        <th className="pb-3 font-medium text-muted-foreground">Status</th>
                        <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground">
                            No invoices found for this site
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-4 pl-4 text-sm">{format(invoice.date, 'MMM dd, yyyy')}</td>
                            <td className="py-4 text-sm">{invoice.partyName}</td>
                            <td className="py-4 text-sm">{invoice.material}</td>
                            <td className="py-4 text-sm">₹{invoice.grossAmount.toLocaleString()}</td>
                            <td className="py-4 text-sm">{invoice.gstPercentage}%</td>
                            <td className="py-4 text-sm font-medium">₹{invoice.netAmount.toLocaleString()}</td>
                            <td className="py-4 text-sm">
                              <span className={`${getStatusColor(invoice.paymentStatus)} px-2 py-1 rounded-full text-xs font-medium`}>
                                {invoice.paymentStatus}
                              </span>
                            </td>
                            <td className="py-4 pr-4 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewInvoice(invoice)}>
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadInvoice(invoice)}>
                                <Download className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              {invoice.paymentStatus === PaymentStatus.PENDING && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8" 
                                  onClick={() => handleViewInvoice(invoice)}
                                >
                                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {filteredInvoices.length > 0 && (
                  <div className="flex items-center justify-between mt-4 border-t pt-4 px-4 pb-2">
                    <p className="text-sm text-muted-foreground">Showing 1-{filteredInvoices.length} of {filteredInvoices.length} entries</p>
                    <div className="flex items-center space-x-2">
                      <button className="p-1 rounded-md hover:bg-muted transition-colors" disabled>
                        <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                      </button>
                      <button className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm">1</button>
                      <button className="p-1 rounded-md hover:bg-muted transition-colors" disabled>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="expenses">
          <div className="p-8 text-center text-muted-foreground">
            Expenses functionality coming soon
          </div>
        </TabsContent>
        
        <TabsContent value="advances">
          <div className="p-8 text-center text-muted-foreground">
            Advances functionality coming soon
          </div>
        </TabsContent>
        
        <TabsContent value="funds">
          <div className="p-8 text-center text-muted-foreground">
            Funds received functionality coming soon
          </div>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Create New Invoice</DialogTitle>
          <InvoiceForm 
            onSubmit={handleCreateInvoice} 
            siteId={site.id}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Invoice Details</DialogTitle>
          {selectedInvoice && (
            <InvoiceDetails
              invoice={selectedInvoice}
              isOpen={!!selectedInvoice}
              onClose={() => setSelectedInvoice(null)}
              onMakePayment={handleMakePayment}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiteDetailTransactions;
