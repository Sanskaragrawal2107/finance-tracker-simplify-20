
import React, { useState, useEffect } from 'react';
import { Invoice, PaymentStatus } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Download, Calendar, IndianRupee, User, MapPin, Phone, Mail, Receipt, FileText, CreditCard, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface InvoiceDetailsProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onMakePayment?: (invoice: Invoice) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const getStatusColor = (status: PaymentStatus) => {
  switch (status) {
    case PaymentStatus.PAID:
      return 'bg-green-100 text-green-800 border-green-200';
    case PaymentStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const InvoiceDetails: React.FC<InvoiceDetailsProps> = ({ invoice, isOpen, onClose, onMakePayment }) => {
  const { toast } = useToast();
  const [isImageOpen, setIsImageOpen] = useState(false);
  
  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  const materials = Array.isArray(invoice.materialItems) 
    ? invoice.materialItems 
    : invoice.material.split(', ').map((material, index) => {
        if (index === 0) {
          return {
            material,
            quantity: invoice.quantity,
            rate: invoice.rate,
            gstPercentage: invoice.gstPercentage,
            amount: invoice.quantity * invoice.rate
          };
        } else {
          return {
            material,
            quantity: null,
            rate: null,
            gstPercentage: null,
            amount: null
          };
        }
      });

  const handleDownload = () => {
    if (invoice.billUrl) {
      window.open(invoice.billUrl, '_blank');
      toast({
        title: "Download initiated",
        description: "The bill download has been initiated."
      });
    } else {
      toast({
        title: "No bill available",
        description: "There is no bill attachment available for this invoice.",
        variant: "destructive"
      });
    }
  };

  const initializeRazorpayPayment = () => {
    if (!window.Razorpay) {
      toast({
        title: "Payment gateway error",
        description: "Razorpay payment gateway is not loaded. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    // Convert amount to paise (Razorpay expects amount in smallest currency unit)
    const amountInPaise = Math.round(invoice.netAmount * 100);
    
    const options = {
      key: "rzp_live_47mpRvV2Yh9XLZ", // Your Razorpay Key ID
      amount: amountInPaise.toString(),
      currency: "INR",
      name: "Construction ERP",
      description: `Payment for Invoice #${invoice.id}`,
      image: "", // Add your company logo URL here
      order_id: "", // This would come from your backend in production
      handler: function (response: any) {
        // Update payment status in your system
        console.log("Payment successful", response);
        
        if (onMakePayment) {
          onMakePayment(invoice);
        }
        
        toast({
          title: "Payment successful",
          description: `Payment of ₹${invoice.netAmount.toLocaleString()} has been completed successfully.`,
        });
      },
      prefill: {
        name: invoice.partyName,
        email: invoice.bankDetails?.email || "",
        contact: invoice.bankDetails?.mobile || "",
      },
      notes: {
        invoice_id: invoice.id,
        party_id: invoice.partyId,
      },
      theme: {
        color: "#3B82F6", // Primary color
      },
      modal: {
        ondismiss: function() {
          toast({
            title: "Payment cancelled",
            description: "The payment process was cancelled.",
          });
        },
      },
    };

    try {
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Razorpay Error:", error);
      toast({
        title: "Payment gateway error",
        description: "There was an error initializing the payment gateway.",
        variant: "destructive"
      });
    }
  };

  const handlePayment = () => {
    if (invoice.approverType !== "ho") {
      toast({
        title: "Payment not available",
        description: "Only Head Office approved invoices can be paid through the system.",
        variant: "destructive"
      });
      return;
    }
    
    initializeRazorpayPayment();
  };

  const handleViewBill = () => {
    if (invoice.billUrl) {
      setIsImageOpen(true);
    } else {
      toast({
        title: "No bill available",
        description: "There is no bill attachment available for this invoice.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between">
            <div>
              <h3 className="text-xl font-semibold flex items-center">
                <Receipt className="mr-2 h-5 w-5 text-primary" />
                Invoice #{invoice.id}
              </h3>
              <p className="text-muted-foreground flex items-center mt-1">
                <Calendar className="mr-1 h-4 w-4" />
                {format(new Date(invoice.date), 'MMMM dd, yyyy')}
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <div 
                className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(invoice.paymentStatus)}`}
              >
                {invoice.paymentStatus}
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="font-medium mb-2">Party Details</h4>
            <div className="bg-muted rounded-md p-4">
              <p className="font-medium">{invoice.partyName}</p>
              <p className="text-sm mt-1 flex items-center">
                <FileText className="h-4 w-4 mr-1 text-muted-foreground" />
                Invoice Number: {invoice.partyId}
              </p>
              {invoice.approverType && (
                <p className="text-sm mt-1">
                  Approved by: <span className="font-medium capitalize">{invoice.approverType}</span>
                </p>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Materials & Amounts</h4>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="py-2 px-4 font-medium">#</th>
                    <th className="py-2 px-4 font-medium">Material</th>
                    <th className="py-2 px-4 font-medium text-right">Quantity</th>
                    <th className="py-2 px-4 font-medium text-right">Rate (₹)</th>
                    <th className="py-2 px-4 font-medium text-right">GST %</th>
                    <th className="py-2 px-4 font-medium text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material, index) => (
                    <tr key={index} className="border-t">
                      <td className="py-3 px-4">{index + 1}</td>
                      <td className="py-3 px-4">{material.material}</td>
                      <td className="py-3 px-4 text-right">{material.quantity !== null ? material.quantity : '-'}</td>
                      <td className="py-3 px-4 text-right">{material.rate !== null ? material.rate.toLocaleString() : '-'}</td>
                      <td className="py-3 px-4 text-right">{material.gstPercentage !== null ? `${material.gstPercentage}%` : '-'}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {material.amount !== null ? material.amount.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-medium">
                  <tr className="border-t">
                    <td colSpan={5} className="py-3 px-4 text-right">Net Taxable Amount:</td>
                    <td className="py-3 px-4 text-right">₹{invoice.grossAmount.toLocaleString()}</td>
                  </tr>
                  <tr className="border-t">
                    <td colSpan={5} className="py-3 px-4 text-right">GST Amount:</td>
                    <td className="py-3 px-4 text-right">₹{(invoice.netAmount - invoice.grossAmount).toLocaleString()}</td>
                  </tr>
                  <tr className="border-t">
                    <td colSpan={5} className="py-3 px-4 text-right font-bold">Grand Net Total:</td>
                    <td className="py-3 px-4 text-right font-bold text-primary">₹{invoice.netAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          {invoice.approverType === "ho" && (
            <div>
              <h4 className="font-medium mb-2">Bank Details</h4>
              <div className="bg-muted rounded-md p-4 space-y-2">
                <p><span className="font-medium">Account Number:</span> {invoice.bankDetails.accountNumber}</p>
                <p><span className="font-medium">Bank & Branch:</span> {invoice.bankDetails.bankName}</p>
                <p><span className="font-medium">IFSC Code:</span> {invoice.bankDetails.ifscCode}</p>
                {invoice.bankDetails.email && (
                  <p className="flex items-center">
                    <Mail className="h-4 w-4 mr-1" />
                    <span className="font-medium mr-1">Email:</span> {invoice.bankDetails.email}
                  </p>
                )}
                {invoice.bankDetails.mobile && (
                  <p className="flex items-center">
                    <Phone className="h-4 w-4 mr-1" />
                    <span className="font-medium mr-1">Mobile:</span> {invoice.bankDetails.mobile}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {invoice.billUrl && (
            <div>
              <h4 className="font-medium mb-2">Attached Bill</h4>
              <div className="bg-muted/50 border rounded-md p-4 flex items-center justify-between">
                <span>Bill attachment</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleViewBill}>
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
              
              {isImageOpen && (
                <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Invoice Bill</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center">
                      <img 
                        src={invoice.billUrl} 
                        alt="Invoice Bill" 
                        className="max-h-[70vh] object-contain rounded-md border"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
          
          <div className="flex justify-between pt-2">
            <div>
              {invoice.paymentStatus === PaymentStatus.PENDING && invoice.approverType === "ho" && (
                <Button 
                  variant="default" 
                  size="sm" 
                  className="gap-1.5"
                  onClick={handlePayment}
                >
                  <CreditCard className="h-4 w-4" />
                  Make Payment
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              Export Invoice
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground mt-6 pt-4 border-t">
            <p className="mb-1">Created by: {invoice.createdBy}</p>
            <p>Created on: {format(new Date(invoice.createdAt), 'MMMM dd, yyyy, h:mm a')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetails;
