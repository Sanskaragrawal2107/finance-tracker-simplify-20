import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Download, Filter, Search, ChevronLeft, ChevronRight, Eye, CreditCard, Loader2, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase, fetchSiteInvoices } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Site, Invoice, PaymentStatus, MaterialItem, BankDetails, UserRole, ApprovalStatus } from '@/lib/types';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import InvoiceDetails from '@/components/invoices/InvoiceDetails';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';

interface SiteDetailTransactionsProps {
  site: Site;
  supervisor?: any;
  isAdminView?: boolean;
  expenses?: Expense[];
  advances?: Advance[];
  fundsReceived?: FundsReceived[];
}

interface Expense {
  id: string;
  date: Date;
  description: string;
  category: string;
  amount: number;
  status: ApprovalStatus;
}

interface Advance {
  id: string;
  date: Date;
  recipientName: string;
  purpose: string;
  amount: number;
  status: ApprovalStatus;
}

interface FundsReceived {
  id: string;
  date: Date;
  amount: number;
  method?: string;
  reference?: string;
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

const SiteDetailTransactions: React.FC<SiteDetailTransactionsProps> = ({ 
  site, 
  supervisor, 
  isAdminView,
  expenses = [],
  advances = [],
  fundsReceived = []
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { toast } = useToast();
  
  // Check if the current user is an admin
  const isAdmin = user?.role === UserRole.ADMIN || isAdminView === true;

  // Function to load invoices with real-time updates
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

    // Subscribe to real-time updates for this site's invoices
    const channel = supabase
      .channel('public:site_invoices')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'site_invoices',
        filter: `site_id=eq.${site.id}`
      }, () => {
        // Reload invoices when there's any change
        loadInvoices();
      })
      .subscribe();

    return () => {
      // Unsubscribe when component unmounts
      supabase.removeChannel(channel);
    };
  }, [site.id]);

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
      
      toast({
        title: "Invoice Created",
        description: `Invoice for ${invoice.partyName} has been created successfully.`,
      });
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

  const handleUpdateInvoice = async (invoice: Omit<Invoice, 'createdAt'>) => {
    try {
      const { error } = await supabase
        .from('site_invoices')
        .update({
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
          approver_type: invoice.approverType
        })
        .eq('id', invoice.id);
        
      if (error) {
        console.error('Error updating invoice:', error);
        toast({
          title: "Invoice Update Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Invoice Updated",
        description: `Invoice for ${invoice.partyName} has been updated successfully.`,
      });
      
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;
    
    try {
      const { error } = await supabase
        .from('site_invoices')
        .delete()
        .eq('id', selectedInvoice.id);
        
      if (error) {
        console.error('Error deleting invoice:', error);
        toast({
          title: "Invoice Deletion Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Invoice Deleted",
        description: `Invoice for ${selectedInvoice.partyName} has been deleted successfully.`,
      });
      
      setIsDeleteConfirmOpen(false);
      setSelectedInvoice(null);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsEditDialogOpen(true);
  };

  const confirmDeleteInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDeleteConfirmOpen(true);
  };

  const handleMakePayment = async (invoice: Invoice) => {
    try {
      // Update payment status in Supabase
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
    // Implementation for downloading invoice
    toast({
      title: "Download Started",
      description: `Download for invoice ${invoice.partyId} has started.`,
    });
  };

  // Add formatCurrency utility
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString()}`;
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
              {isAdmin && (
                <Button size="sm" className="gap-1.5" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Invoice
                </Button>
              )}
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
                            <td className="py-4 text-right">
                              <div className="flex justify-end">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewInvoice(invoice)}>
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                
                                {isAdmin && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditInvoice(invoice)}>
                                      <Edit className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => confirmDeleteInvoice(invoice)}>
                                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </>
                                )}
                                
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadInvoice(invoice)}>
                                  <Download className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                
                                {invoice.paymentStatus === PaymentStatus.PENDING && isAdmin && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8" 
                                    onClick={() => handleViewInvoice(invoice)}
                                  >
                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
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
        
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search expenses..." 
                className="py-2 pl-10 pr-4 border rounded-md w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            {isAdmin && (
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Expense
              </Button>
            )}
          </div>
          
          {expenses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No expenses found for this site
            </div>
          ) : (
            <div className="bg-white rounded-md border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pl-4 font-medium text-muted-foreground">Date</th>
                      <th className="pb-3 font-medium text-muted-foreground">Description</th>
                      <th className="pb-3 font-medium text-muted-foreground">Category</th>
                      <th className="pb-3 font-medium text-muted-foreground">Amount</th>
                      <th className="pb-3 font-medium text-muted-foreground">Status</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-4 pl-4 text-sm">{format(expense.date, 'MMM dd, yyyy')}</td>
                        <td className="py-4 text-sm">{expense.description}</td>
                        <td className="py-4 text-sm">{expense.category}</td>
                        <td className="py-4 text-sm font-medium">{formatCurrency(expense.amount)}</td>
                        <td className="py-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${expense.status === ApprovalStatus.APPROVED ? 'bg-green-100 text-green-800' : 
                              expense.status === ApprovalStatus.REJECTED ? 'bg-red-100 text-red-800' : 
                              'bg-yellow-100 text-yellow-800'}`}
                          >
                            {expense.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="advances" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search advances..." 
                className="py-2 pl-10 pr-4 border rounded-md w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            {isAdmin && (
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Advance
              </Button>
            )}
          </div>
          
          {advances.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No advances found for this site
            </div>
          ) : (
            <div className="bg-white rounded-md border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pl-4 font-medium text-muted-foreground">Date</th>
                      <th className="pb-3 font-medium text-muted-foreground">Recipient</th>
                      <th className="pb-3 font-medium text-muted-foreground">Purpose</th>
                      <th className="pb-3 font-medium text-muted-foreground">Amount</th>
                      <th className="pb-3 font-medium text-muted-foreground">Status</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advances.map((advance) => (
                      <tr key={advance.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-4 pl-4 text-sm">{format(advance.date, 'MMM dd, yyyy')}</td>
                        <td className="py-4 text-sm">{advance.recipientName}</td>
                        <td className="py-4 text-sm">{advance.purpose}</td>
                        <td className="py-4 text-sm font-medium">{formatCurrency(advance.amount)}</td>
                        <td className="py-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${advance.status === ApprovalStatus.APPROVED ? 'bg-green-100 text-green-800' : 
                              advance.status === ApprovalStatus.REJECTED ? 'bg-red-100 text-red-800' : 
                              'bg-yellow-100 text-yellow-800'}`}
                          >
                            {advance.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="funds" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search funds..." 
                className="py-2 pl-10 pr-4 border rounded-md w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            {isAdmin && (
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Funds
              </Button>
            )}
          </div>
          
          {fundsReceived.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No funds received for this site
            </div>
          ) : (
            <div className="bg-white rounded-md border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pl-4 font-medium text-muted-foreground">Date</th>
                      <th className="pb-3 font-medium text-muted-foreground">Amount</th>
                      <th className="pb-3 font-medium text-muted-foreground">Method</th>
                      <th className="pb-3 font-medium text-muted-foreground">Reference</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundsReceived.map((fund) => (
                      <tr key={fund.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-4 pl-4 text-sm">{format(fund.date, 'MMM dd, yyyy')}</td>
                        <td className="py-4 text-sm font-medium">{formatCurrency(fund.amount)}</td>
                        <td className="py-4 text-sm">{fund.method || 'N/A'}</td>
                        <td className="py-4 text-sm">{fund.reference || 'N/A'}</td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Create Invoice Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Create New Invoice</DialogTitle>
          <InvoiceForm 
            onSubmit={handleCreateInvoice} 
            siteId={site.id}
          />
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
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

      {/* Edit Invoice Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Edit Invoice</DialogTitle>
          {selectedInvoice && (
            <InvoiceForm 
              onSubmit={handleUpdateInvoice} 
              siteId={site.id}
              initialData={selectedInvoice}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Invoice Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SiteDetailTransactions;
