import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { ExpenseCategory, Invoice, BankDetails, MaterialItem, PaymentStatus } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox"
import { IndianRupee } from 'lucide-react';

interface InvoiceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (invoice: Partial<Invoice>) => void;
  siteId?: string;
  editInvoice?: Invoice;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ isOpen, onClose, onSubmit, siteId, editInvoice }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<Invoice>>({
    date: new Date(),
    partyId: '',
    partyName: '',
    material: '',
    quantity: 1,
    rate: 1,
    gstPercentage: 0,
    grossAmount: 0,
    netAmount: 0,
    materialItems: [],
    bankDetails: {
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      email: '',
      mobile: ''
    },
    billUrl: '',
    invoiceImageUrl: '',
    paymentStatus: PaymentStatus.PENDING,
    vendorName: '',
    invoiceNumber: '',
    amount: 0,
    status: PaymentStatus.PENDING
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaterialItemsEnabled, setIsMaterialItemsEnabled] = useState(false);
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [newMaterialItem, setNewMaterialItem] = useState<Omit<MaterialItem, 'id'>>({
    material: '',
    quantity: 1,
    rate: 1,
    gstPercentage: 0,
    amount: 0,
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItemToDelete, setSelectedItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (editInvoice) {
      setIsEditMode(true);
      setFormData({
        id: editInvoice.id,
        date: editInvoice.date,
        partyId: editInvoice.partyId,
        partyName: editInvoice.partyName,
        material: editInvoice.material,
        quantity: editInvoice.quantity,
        rate: editInvoice.rate,
        gstPercentage: editInvoice.gstPercentage,
        grossAmount: editInvoice.grossAmount,
        netAmount: editInvoice.netAmount,
        materialItems: editInvoice.materialItems,
        bankDetails: editInvoice.bankDetails,
        billUrl: editInvoice.billUrl,
        invoiceImageUrl: editInvoice.invoiceImageUrl,
        paymentStatus: editInvoice.paymentStatus,
        vendorName: editInvoice.vendorName,
        invoiceNumber: editInvoice.invoiceNumber,
        amount: editInvoice.amount,
        status: editInvoice.status
      });
      setMaterialItems(editInvoice.materialItems || []);
      setIsMaterialItemsEnabled(editInvoice.materialItems && editInvoice.materialItems.length > 0);
    } else {
      setIsEditMode(false);
      setFormData({
        date: new Date(),
        partyId: '',
        partyName: '',
        material: '',
        quantity: 1,
        rate: 1,
        gstPercentage: 0,
        grossAmount: 0,
        netAmount: 0,
        materialItems: [],
        bankDetails: {
          accountNumber: '',
          bankName: '',
          ifscCode: '',
          email: '',
          mobile: ''
        },
        billUrl: '',
        invoiceImageUrl: '',
        paymentStatus: PaymentStatus.PENDING,
        vendorName: '',
        invoiceNumber: '',
        amount: 0,
        status: PaymentStatus.PENDING
      });
      setMaterialItems([]);
      setIsMaterialItemsEnabled(false);
    }
  }, [editInvoice]);

  useEffect(() => {
    // Calculate gross amount whenever quantity, rate, or GST changes
    const calculateAmounts = () => {
      const itemAmount = (formData.quantity || 0) * (formData.rate || 0);
      const gstAmount = itemAmount * ((formData.gstPercentage || 0) / 100);
      const gross = itemAmount + gstAmount;
      setFormData(prev => ({
        ...prev,
        grossAmount: gross,
        netAmount: gross,
        amount: gross
      }));
    };

    calculateAmounts();
  }, [formData.quantity, formData.rate, formData.gstPercentage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBankDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        [name]: value
      }
    }));
  };

  const handleMaterialItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewMaterialItem(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addMaterialItem = () => {
    const newItem: MaterialItem = {
      id: uuidv4(),
      material: newMaterialItem.material,
      quantity: newMaterialItem.quantity,
      rate: newMaterialItem.rate,
      gstPercentage: newMaterialItem.gstPercentage,
      amount: (newMaterialItem.quantity || 0) * (newMaterialItem.rate || 0) * (1 + (newMaterialItem.gstPercentage || 0) / 100),
    };
    setMaterialItems(prev => [...prev, newItem]);
    setNewMaterialItem({
      material: '',
      quantity: 1,
      rate: 1,
      gstPercentage: 0,
      amount: 0,
    });
  };

  const confirmDeleteItem = (id: string) => {
    setSelectedItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const deleteMaterialItem = async () => {
    if (!selectedItemToDelete) return;
    setMaterialItems(prev => prev.filter(item => item.id !== selectedItemToDelete));
    setSelectedItemToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const toggleMaterialItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsMaterialItemsEnabled(e.target.checked);
    if (!e.target.checked) {
      setMaterialItems([]);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.date || !formData.partyId || !formData.partyName || !formData.material) {
        toast.error('Please fill in all required fields.');
        return;
      }

      const invoice: Partial<Invoice> = {
        date: formData.date,
        partyId: formData.partyId,
        partyName: formData.partyName,
        material: formData.material,
        quantity: formData.quantity || 1,
        rate: formData.rate || 1,
        gstPercentage: formData.gstPercentage || 0,
        grossAmount: formData.grossAmount || 0,
        netAmount: formData.netAmount || 0,
        materialItems: isMaterialItemsEnabled ? materialItems : [],
        bankDetails: formData.bankDetails || {
          accountNumber: '',
          bankName: '',
          ifscCode: '',
          email: '',
          mobile: ''
        },
        billUrl: formData.billUrl,
        invoiceImageUrl: formData.invoiceImageUrl,
        paymentStatus: PaymentStatus.PENDING,
        createdBy: user?.id || '',
        siteId: siteId,
        vendorName: formData.vendorName,
        invoiceNumber: formData.invoiceNumber,
        amount: formData.amount,
        status: PaymentStatus.PENDING
      };

      onSubmit(invoice);
      onClose();
      toast.success('Invoice submitted successfully!');
    } catch (error) {
      console.error('Error submitting invoice:', error);
      toast.error('Failed to submit invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/50">
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-2xl p-4">
          <CardHeader>
            <CardTitle>{isEditMode ? 'Edit Invoice' : 'Add Invoice'}</CardTitle>
            <CardDescription>Enter invoice details below:</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date ? (formData.date as Date).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: new Date(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="vendorName">Vendor Name</Label>
                <Input
                  type="text"
                  id="vendorName"
                  name="vendorName"
                  value={formData.vendorName || ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input
                  type="text"
                  id="invoiceNumber"
                  name="invoiceNumber"
                  value={formData.invoiceNumber || ''}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="partyId">Party ID</Label>
                <Input
                  type="text"
                  id="partyId"
                  name="partyId"
                  value={formData.partyId || ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <Label htmlFor="partyName">Party Name</Label>
                <Input
                  type="text"
                  id="partyName"
                  name="partyName"
                  value={formData.partyName || ''}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="material">Material</Label>
              <Input
                type="text"
                id="material"
                name="material"
                value={formData.material || ''}
                onChange={handleChange}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="materialItemsEnabled"
                checked={isMaterialItemsEnabled}
                onCheckedChange={toggleMaterialItems}
              />
              <Label htmlFor="materialItemsEnabled">Enable Material Items</Label>
            </div>

            {isMaterialItemsEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="material">Material</Label>
                    <Input
                      type="text"
                      id="material"
                      name="material"
                      value={newMaterialItem.material}
                      onChange={handleMaterialItemChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={newMaterialItem.quantity || ''}
                      onChange={handleMaterialItemChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rate">Rate</Label>
                    <Input
                      type="number"
                      id="rate"
                      name="rate"
                      value={newMaterialItem.rate || ''}
                      onChange={handleMaterialItemChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gstPercentage">GST (%)</Label>
                    <Input
                      type="number"
                      id="gstPercentage"
                      name="gstPercentage"
                      value={newMaterialItem.gstPercentage || ''}
                      onChange={handleMaterialItemChange}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" size="sm" onClick={addMaterialItem}>Add Item</Button>
                  </div>
                </div>

                {materialItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Material</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Quantity</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Rate</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">GST (%)</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialItems.map((item) => (
                          <tr key={item.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 text-sm">{item.material}</td>
                            <td className="px-4 py-3 text-sm">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {item.rate?.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{item.gstPercentage}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {item.amount?.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Button type="button" variant="destructive" size="xs" onClick={() => confirmDeleteItem(item.id || '')}>Delete</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {!isMaterialItemsEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity || ''}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="rate">Rate</Label>
                  <Input
                    type="number"
                    id="rate"
                    name="rate"
                    value={formData.rate || ''}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="gstPercentage">GST (%)</Label>
                  <Input
                    type="number"
                    id="gstPercentage"
                    name="gstPercentage"
                    value={formData.gstPercentage || ''}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="grossAmount">Gross Amount</Label>
                <Input
                  type="number"
                  id="grossAmount"
                  name="grossAmount"
                  value={formData.grossAmount || ''}
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="netAmount">Net Amount</Label>
                <Input
                  type="number"
                  id="netAmount"
                  name="netAmount"
                  value={formData.netAmount || ''}
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount || ''}
                  readOnly
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">Bank Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    type="text"
                    id="accountNumber"
                    name="accountNumber"
                    value={formData.bankDetails?.accountNumber || ''}
                    onChange={handleBankDetailsChange}
                  />
                </div>
                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    type="text"
                    id="bankName"
                    name="bankName"
                    value={formData.bankDetails?.bankName || ''}
                    onChange={handleBankDetailsChange}
                  />
                </div>
                <div>
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input
                    type="text"
                    id="ifscCode"
                    name="ifscCode"
                    value={formData.bankDetails?.ifscCode || ''}
                    onChange={handleBankDetailsChange}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.bankDetails?.email || ''}
                    onChange={handleBankDetailsChange}
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    type="tel"
                    id="mobile"
                    name="mobile"
                    value={formData.bankDetails?.mobile || ''}
                    onChange={handleBankDetailsChange}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="billUrl">Bill URL</Label>
              <Input
                type="url"
                id="billUrl"
                name="billUrl"
                value={formData.billUrl || ''}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="invoiceImageUrl">Invoice Image URL</Label>
              <Input
                type="url"
                id="invoiceImageUrl"
                name="invoiceImageUrl"
                value={formData.invoiceImageUrl || ''}
                onChange={handleChange}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isEditMode ? 'Update Invoice' : 'Submit Invoice'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMaterialItem}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InvoiceForm;
