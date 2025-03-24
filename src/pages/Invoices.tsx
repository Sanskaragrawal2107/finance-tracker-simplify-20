import React, { useState, useEffect } from 'react';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Search, Filter, Plus, Eye, Download, ChevronLeft, ChevronRight, CreditCard, Building, AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Invoice, PaymentStatus, MaterialItem, BankDetails } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import InvoiceDetails from '@/components/invoices/InvoiceDetails';
import { useToast } from '@/hooks/use-toast';
import { supabase, fetchSiteInvoices } from '@/integrations/supabase/client';
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormDescription, 
  FormMessage 
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { BankRadioGroup, BankRadioGroupItem } from "@/components/ui/radio-group";

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

const paymentFormSchema = z.object({
  bankOption: z.enum(["sbi", "hdfc", "icici", "axis"]),
  rememberChoice: z.boolean().optional()
});

const bankDetails = {
  sbi: {
    name: "State Bank of India",
    logo: "SBI",
    color: "#2d76b7",
    website: "https://www.onlinesbi.sbi/",
  },
  hdfc: {
    name: "HDFC Bank",
    logo: "HDFC",
    color: "#004c8f",
    website: "https://www.hdfcbank.com/",
  },
  icici: {
    name: "ICICI Bank",
    logo: "ICICI",
    color: "#F58220",
    website: "https://www.icicibank.com/",
  },
  axis: {
    name: "Axis Bank",
    logo: "AXIS",
    color: "#97144d",
    website: "https://www.axisbank.com/",
  }
};

const Invoices: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isBankPageOpen, setIsBankPageOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [bankPageStep, setBankPageStep] = useState(1);
  
  const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      bankOption: "sbi",
      rememberChoice: false
    },
  });

  const mapInvoices = (data: any[]) => {
    return data.map(invoice => ({
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
      materialItems: invoice.material_items ? JSON.parse(invoice.material_items) : [],
      bankDetails: invoice.bank_details ? JSON.parse(invoice.bank_details) : {},
      billUrl: invoice.bill_url || '',
      invoiceImageUrl: invoice.invoice_image_url || '',
      paymentStatus: invoice.payment_status,
      createdBy: invoice.created_by || '',
      createdAt: new Date(invoice.created_at),
      approverType: invoice.approver_type || "ho",
      siteId: invoice.site_id,
      status: invoice.payment_status
    }));
  };

  useEffect(() => {
    const fetchInvoices = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('site_invoices')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching invoices:', error);
          toast({
            title: "Failed to fetch invoices",
            description: error.message,
            variant: "destructive"
          });
          return;
        }
        
        if (data) {
          const mappedInvoices = mapInvoices(data);
          setInvoices(mappedInvoices);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInvoices();
  }, [toast]);

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
          site_id: invoice.siteId
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
          materialItems: JSON.parse(data[0].material_items),
          bankDetails: JSON.parse(data[0].bank_details),
          billUrl: data[0].bill_url,
          paymentStatus: data[0].payment_status,
          createdBy: data[0].created_by || '',
          createdAt: new Date(data[0].created_at),
          approverType: data[0].approver_type || "ho",
          siteId: data[0].site_id
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

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    toast({
      title: "Download Started",
      description: `Download for invoice ${invoice.partyId} has started.`,
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageTitle 
        title="Invoices" 
        subtitle="Manage invoices from vendors and suppliers"
      />
      
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
      
      <CustomCard>
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
                  {filteredInvoices.map((invoice) => (
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
                        {invoice.paymentStatus === PaymentStatus.PENDING && invoice.approverType === "ho" && (
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
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex items-center justify-between mt-4 border-t pt-4">
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
          </>
        )}
      </CustomCard>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>
            Fill out the form below to create a new invoice
          </DialogDescription>
          <InvoiceForm onSubmit={handleCreateInvoice} />
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

export default Invoices;
