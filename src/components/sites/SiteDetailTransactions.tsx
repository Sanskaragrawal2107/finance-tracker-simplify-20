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

// Add new recipient type enum
enum RecipientType {
  WORKER = 'worker',
  SUBCONTRACTOR = 'subcontractor',
  SUPERVISOR = 'supervisor'
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
  
  // Debug logs for transaction data
  console.log('SiteDetailTransactions props:', { 
    siteId: site.id,
    expensesCount: expenses.length,
    advancesCount: advances.length,
    fundsReceivedCount: fundsReceived.length,
    userRole: user?.role,
    isAdminView
  });
  
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // Separate loading states for each tab
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(true);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);
  const [isAdvancesLoading, setIsAdvancesLoading] = useState(false);
  const [isFundsLoading, setIsFundsLoading] = useState(false);
  
  // Invoice dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // Expense dialog states
  const [isCreateExpenseDialogOpen, setIsCreateExpenseDialogOpen] = useState(false);
  const [isEditExpenseDialogOpen, setIsEditExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDeleteExpenseConfirmOpen, setIsDeleteExpenseConfirmOpen] = useState(false);
  
  // Advance dialog states
  const [isCreateAdvanceDialogOpen, setIsCreateAdvanceDialogOpen] = useState(false);
  const [isEditAdvanceDialogOpen, setIsEditAdvanceDialogOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [isDeleteAdvanceConfirmOpen, setIsDeleteAdvanceConfirmOpen] = useState(false);
  
  // Funds dialog states
  const [isCreateFundsDialogOpen, setIsCreateFundsDialogOpen] = useState(false);
  const [isEditFundsDialogOpen, setIsEditFundsDialogOpen] = useState(false);
  const [selectedFunds, setSelectedFunds] = useState<FundsReceived | null>(null);
  const [isDeleteFundsConfirmOpen, setIsDeleteFundsConfirmOpen] = useState(false);
  
  const { toast } = useToast();
  
  // Permission checks
  const isAdmin = user?.role === UserRole.ADMIN;
  const isSupervisor = user?.role === UserRole.SUPERVISOR;
  const canEdit = isAdmin || (isSupervisor && site.supervisorId === user?.id);
  const canDelete = isAdmin; // Only admins can delete transactions

  // Function to load invoices with real-time updates
  useEffect(() => {
    const loadInvoices = async () => {
      if (activeTab !== 'invoices') return;
      
      setIsInvoicesLoading(true);
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
        setIsInvoicesLoading(false);
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
  }, [site.id, activeTab]);

  // Handle tab loading states
  useEffect(() => {
    const handleTabChange = () => {
      if (activeTab === 'expenses') {
        setIsExpensesLoading(true);
        // Simulate loading - in real app, you'd load data here
        setTimeout(() => setIsExpensesLoading(false), 500);
      } else if (activeTab === 'advances') {
        setIsAdvancesLoading(true);
        // Simulate loading - in real app, you'd load data here
        setTimeout(() => setIsAdvancesLoading(false), 500);
      } else if (activeTab === 'funds') {
        setIsFundsLoading(true);
        // Simulate loading - in real app, you'd load data here
        setTimeout(() => setIsFundsLoading(false), 500);
      }
    };
    
    handleTabChange();
  }, [activeTab]);

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

  // Expense handlers
  const handleAddExpense = () => {
    setIsCreateExpenseDialogOpen(true);
  };
  
  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsEditExpenseDialogOpen(true);
  };
  
  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    // You can add view dialog logic here if needed
  };
  
  const confirmDeleteExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDeleteExpenseConfirmOpen(true);
  };
  
  const handleCreateExpense = async (expense: Partial<Expense>) => {
    // Implementation for creating expense in Supabase
    toast({
      title: "Expense Created",
      description: "The expense has been created successfully.",
    });
    setIsCreateExpenseDialogOpen(false);
  };
  
  // Advance form state
  const [advanceDate, setAdvanceDate] = useState<Date | null>(null);
  const [recipientType, setRecipientType] = useState<RecipientType>(RecipientType.WORKER);
  const [recipientName, setRecipientName] = useState('');
  const [advancePurpose, setAdvancePurpose] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  
  // Lists for dropdowns
  const [supervisors, setSupervisors] = useState<Array<{id: string, name: string}>>([]);
  const [subcontractors, setSubcontractors] = useState<Array<{id: string, name: string}>>([]);
  const [purposes, setPurposes] = useState([
    'Salary Advance',
    'Material Purchase',
    'Equipment Rental',
    'Travel Expense',
    'Miscellaneous'
  ]);
  
  // Fetch supervisors and subcontractors
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch supervisors
        const { data: supervisorsData, error: supervisorsError } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('role', UserRole.SUPERVISOR);
          
        if (supervisorsError) throw supervisorsError;
        
        if (supervisorsData) {
          setSupervisors(supervisorsData.map(s => ({ 
            id: s.id, 
            name: s.name || s.email 
          })));
        }
        
        // Fetch contractors (not subcontractors)
        const { data: contractorsData, error: contractorsError } = await supabase
          .from('contractors')
          .select('id, name');
          
        if (contractorsError) throw contractorsError;
        
        if (contractorsData) {
          setSubcontractors(contractorsData);
        }
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
        toast({
          title: "Failed to load data",
          description: "Could not load supervisors and contractors.",
          variant: "destructive"
        });
      }
    };
    
    fetchDropdownData();
  }, []);
  
  // Reset advance form
  const resetAdvanceForm = () => {
    setAdvanceDate(null);
    setRecipientType(RecipientType.WORKER);
    setRecipientName('');
    setAdvancePurpose('');
    setAdvanceAmount(0);
  };
  
  // Handle advance form submit
  const handleCreateAdvance = async () => {
    if (!advanceDate) {
      toast({
        title: "Missing Date",
        description: "Please select a date for the advance",
        variant: "destructive"
      });
      return;
    }
    
    if (!recipientName) {
      toast({
        title: "Missing Recipient",
        description: "Please enter a recipient name",
        variant: "destructive"
      });
      return;
    }
    
    if (!advancePurpose) {
      toast({
        title: "Missing Purpose",
        description: "Please select a purpose",
        variant: "destructive"
      });
      return;
    }
    
    if (!advanceAmount || advanceAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Determine recipient_id based on type
      let recipient_id = null;
      if (recipientType === RecipientType.SUPERVISOR) {
        recipient_id = supervisors.find(s => s.name === recipientName)?.id || null;
      } else if (recipientType === RecipientType.SUBCONTRACTOR) {
        recipient_id = subcontractors.find(s => s.name === recipientName)?.id || null;
      }
      
      // Prepare the data for insertion
      const advanceData = {
        date: advanceDate.toISOString(),
        recipient_type: recipientType,
        recipient_name: recipientName,
        purpose: advancePurpose,
        amount: advanceAmount,
        status: ApprovalStatus.PENDING, // Default status
        created_by: user?.id,
        site_id: site.id,
        recipient_id: recipient_id // Set ID for both supervisors and subcontractors
      };
      
      console.log('Submitting advance data:', advanceData);
      
      const { data, error } = await supabase
        .from('advances')
        .insert(advanceData)
        .select();
        
      if (error) {
        console.error('Error creating advance:', error);
        toast({
          title: "Advance Creation Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Advance Created",
        description: `Advance for ${recipientName} has been created successfully.`,
      });
      
      setIsCreateAdvanceDialogOpen(false);
      resetAdvanceForm();
      
      // Refresh the advances list (in a real implementation, you'd update your state)
      // This would typically call a function to refresh the advances list
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to create advance. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Funds handlers
  const handleAddFunds = () => {
    setIsCreateFundsDialogOpen(true);
  };
  
  const handleEditFunds = (funds: FundsReceived) => {
    setSelectedFunds(funds);
    setIsEditFundsDialogOpen(true);
  };
  
  const handleViewFunds = (funds: FundsReceived) => {
    setSelectedFunds(funds);
    // You can add view dialog logic here if needed
  };
  
  const confirmDeleteFunds = (funds: FundsReceived) => {
    setSelectedFunds(funds);
    setIsDeleteFundsConfirmOpen(true);
  };
  
  const handleCreateFunds = async (funds: Partial<FundsReceived>) => {
    // Implementation for creating funds in Supabase
    toast({
      title: "Funds Added",
      description: "The funds have been added successfully.",
    });
    setIsCreateFundsDialogOpen(false);
  };

  // Advance handlers
  const handleAddAdvance = () => {
    setIsCreateAdvanceDialogOpen(true);
  };

  const handleEditAdvance = (advance: Advance) => {
    setSelectedAdvance(advance);
    setIsEditAdvanceDialogOpen(true);
  };

  const handleViewAdvance = (advance: Advance) => {
    setSelectedAdvance(advance);
    // You can add view dialog logic here if needed
  };

  const confirmDeleteAdvance = (advance: Advance) => {
    setSelectedAdvance(advance);
    setIsDeleteAdvanceConfirmOpen(true);
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
              {canEdit && (
                <Button size="sm" className="gap-1.5" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Invoice
                </Button>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-md border shadow-sm">
            {isInvoicesLoading ? (
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
                                
                                {canEdit && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditInvoice(invoice)}>
                                      <Edit className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    {canDelete && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => confirmDeleteInvoice(invoice)}>
                                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadInvoice(invoice)}>
                                  <Download className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                
                                {invoice.paymentStatus === PaymentStatus.PENDING && canEdit && (
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
            
            {canEdit && (
              <Button size="sm" className="gap-1.5" onClick={handleAddExpense}>
                <Plus className="h-4 w-4" />
                New Expense
              </Button>
            )}
          </div>
          
          {isExpensesLoading ? (
            <div className="flex items-center justify-center p-12 bg-white rounded-md border shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading expenses...</span>
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-white rounded-md border shadow-sm">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewExpense(expense)}>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {canEdit && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditExpense(expense)}>
                                  <Edit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => confirmDeleteExpense(expense)}>
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
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
            
            {canEdit && (
              <Button size="sm" className="gap-1.5" onClick={() => setIsCreateAdvanceDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New Advance
              </Button>
            )}
          </div>
          
          {isAdvancesLoading ? (
            <div className="flex items-center justify-center p-12 bg-white rounded-md border shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading advances...</span>
            </div>
          ) : advances.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-white rounded-md border shadow-sm">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewAdvance(advance)}>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {canEdit && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAdvance(advance)}>
                                  <Edit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => confirmDeleteAdvance(advance)}>
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
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
            
            {canEdit && (
              <Button size="sm" className="gap-1.5" onClick={handleAddFunds}>
                <Plus className="h-4 w-4" />
                Add Funds
              </Button>
            )}
          </div>
          
          {isFundsLoading ? (
            <div className="flex items-center justify-center p-12 bg-white rounded-md border shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading funds...</span>
            </div>
          ) : fundsReceived.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-white rounded-md border shadow-sm">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewFunds(fund)}>
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {canEdit && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFunds(fund)}>
                                  <Edit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => confirmDeleteFunds(fund)}>
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
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

      {/* Expense Dialogs */}
      <Dialog open={isCreateExpenseDialogOpen} onOpenChange={setIsCreateExpenseDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Add New Expense</DialogTitle>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="date" className="text-sm font-medium">Date</label>
                <input 
                  type="date" 
                  id="date" 
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="category" className="text-sm font-medium">Category</label>
                <select 
                  id="category" 
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select category</option>
                  <option value="materials">Materials</option>
                  <option value="labor">Labor</option>
                  <option value="transport">Transport</option>
                  <option value="equipment">Equipment</option>
                  <option value="miscellaneous">Miscellaneous</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="description" className="text-sm font-medium">Description</label>
              <textarea 
                id="description" 
                rows={3}
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Enter expense description..."
              ></textarea>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="amount" className="text-sm font-medium">Amount (₹)</label>
              <input 
                type="number" 
                id="amount" 
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateExpenseDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => handleCreateExpense({})}>Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteExpenseConfirmOpen} onOpenChange={setIsDeleteExpenseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Expense Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Advance Dialogs */}
      <Dialog open={isCreateAdvanceDialogOpen} onOpenChange={setIsCreateAdvanceDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogTitle>New Advance</DialogTitle>
          <DialogDescription>
            Enter the details for the new advance payment.
          </DialogDescription>
          
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="advanceDate" className="text-sm font-medium">Date</label>
              <input 
                type="date" 
                id="advanceDate" 
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                onChange={(e) => setAdvanceDate(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Recipient Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="recipientType" 
                    checked={recipientType === RecipientType.WORKER}
                    onChange={() => setRecipientType(RecipientType.WORKER)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Worker
                  </span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="recipientType" 
                    checked={recipientType === RecipientType.SUBCONTRACTOR}
                    onChange={() => setRecipientType(RecipientType.SUBCONTRACTOR)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    Subcontractor
                  </span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="recipientType" 
                    checked={recipientType === RecipientType.SUPERVISOR}
                    onChange={() => setRecipientType(RecipientType.SUPERVISOR)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Supervisor
                  </span>
                </label>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="recipientName" className="text-sm font-medium">Recipient Name</label>
              {recipientType === RecipientType.WORKER ? (
                <input 
                  type="text" 
                  id="recipientName" 
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter worker name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              ) : recipientType === RecipientType.SUBCONTRACTOR ? (
                <select 
                  id="recipientName" 
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                >
                  <option value="">Select subcontractor</option>
                  {subcontractors.map((sc) => (
                    <option key={sc.id} value={sc.name}>{sc.name}</option>
                  ))}
                </select>
              ) : (
                <select 
                  id="recipientName" 
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                >
                  <option value="">Select supervisor</option>
                  {supervisors.map((sv) => (
                    <option key={sv.id} value={sv.name}>{sv.name}</option>
                  ))}
                </select>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="purpose" className="text-sm font-medium">Purpose</label>
              <select 
                id="purpose" 
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={advancePurpose}
                onChange={(e) => setAdvancePurpose(e.target.value)}
              >
                <option value="">Select purpose</option>
                {purposes.map((purpose) => (
                  <option key={purpose} value={purpose}>{purpose}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="advanceAmount" className="text-sm font-medium">Amount (₹)</label>
              <input 
                type="number" 
                id="advanceAmount" 
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={advanceAmount || ''}
                onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateAdvanceDialogOpen(false);
                resetAdvanceForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateAdvance}>
              Add Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAdvanceConfirmOpen} onOpenChange={setIsDeleteAdvanceConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Advance Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this advance? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Funds Dialogs */}
      <Dialog open={isCreateFundsDialogOpen} onOpenChange={setIsCreateFundsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Add Received Funds</DialogTitle>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="fundsDate" className="text-sm font-medium">Date</label>
                <input 
                  type="date" 
                  id="fundsDate" 
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="method" className="text-sm font-medium">Payment Method</label>
                <select 
                  id="method" 
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select method</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="fundsAmount" className="text-sm font-medium">Amount (₹)</label>
              <input 
                type="number" 
                id="fundsAmount" 
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="reference" className="text-sm font-medium">Reference Number</label>
              <input 
                type="text" 
                id="reference" 
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Enter transaction reference"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFundsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => handleCreateFunds({})}>Add Funds</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteFundsConfirmOpen} onOpenChange={setIsDeleteFundsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Funds Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this funds entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SiteDetailTransactions;
