import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PaymentStatus, Invoice, MaterialItem } from '@/lib/types';
import { Calendar as CalendarIcon, Upload, Loader2, Camera, Plus, Trash2, FileText, User, AlertTriangle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

type InvoiceFormProps = {
  isOpen?: boolean;
  onClose?: () => void;
  onSubmit: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  initialData?: Partial<Invoice>;
  siteId?: string;
};

const gstRates = [0, 5, 12, 18, 28];

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  isOpen = true,
  onClose,
  onSubmit,
  initialData,
  siteId
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [date, setDate] = useState<Date>(initialData?.date || new Date());
  const [partyId, setPartyId] = useState<string>(initialData?.partyId || '');
  const [partyName, setPartyName] = useState<string>(initialData?.partyName || '');
  const [partyNameFixed, setPartyNameFixed] = useState<boolean>(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [materialInput, setMaterialInput] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<number>(0);
  const [rateInput, setRateInput] = useState<number>(0);
  const [gstPercentageInput, setGstPercentageInput] = useState<number>(18);

  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [grandGrossAmount, setGrandGrossAmount] = useState<number>(0);
  const [grandNetAmount, setGrandNetAmount] = useState<number>(0);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billUrl, setBillUrl] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialData?.paymentStatus || PaymentStatus.PENDING);

  const [accountNumber, setAccountNumber] = useState<string>(initialData?.bankDetails?.accountNumber || '');
  const [bankName, setBankName] = useState<string>(initialData?.bankDetails?.bankName || '');
  const [ifscCode, setIfscCode] = useState<string>(initialData?.bankDetails?.ifscCode || '');
  const [email, setEmail] = useState<string>(initialData?.bankDetails?.email || '');
  const [mobile, setMobile] = useState<string>(initialData?.bankDetails?.mobile || '');
  const [ifscValidationMessage, setIfscValidationMessage] = useState<string>('');
  const [isFetchingBankDetails, setIsFetchingBankDetails] = useState<boolean>(false);

  const [approverType, setApproverType] = useState<"ho" | "supervisor">("ho");

  const handlePartyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!partyNameFixed) {
      setPartyName(e.target.value);
    }
  };
  const handlePartyNameBlur = () => {
    if (partyName.trim() !== '') {
      setPartyNameFixed(true);
    }
  };

  useEffect(() => {
    let totalGross = 0;
    let totalNet = 0;
    materialItems.forEach(item => {
      if (item.amount !== null) {
        totalGross += item.amount;
        if (item.gstPercentage !== null) {
          totalNet += item.amount + item.amount * (item.gstPercentage / 100);
        }
      }
    });
    setGrandGrossAmount(totalGross);
    setGrandNetAmount(totalNet);

    if (totalNet > 5000) {
      setApproverType("ho");
    }
  }, [materialItems]);

  const addMaterialItem = () => {
    if (!materialInput.trim()) {
      toast({
        title: "Material name is required",
        description: "Please enter a material name",
        variant: "destructive"
      });
      return;
    }
    if (quantityInput <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Quantity must be greater than zero",
        variant: "destructive"
      });
      return;
    }
    if (rateInput <= 0) {
      toast({
        title: "Invalid rate",
        description: "Rate must be greater than zero",
        variant: "destructive"
      });
      return;
    }
    const grossAmount = quantityInput * rateInput;
    const newItem: MaterialItem = {
      id: Date.now().toString(),
      material: materialInput,
      quantity: quantityInput,
      rate: rateInput,
      gstPercentage: gstPercentageInput,
      amount: grossAmount
    };
    setMaterialItems([...materialItems, newItem]);

    setMaterialInput('');
    setQuantityInput(0);
    setRateInput(0);
  };

  const removeMaterialItem = (index: number) => {
    const updatedItems = [...materialItems];
    updatedItems.splice(index, 1);
    setMaterialItems(updatedItems);
  };

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 16) {
      setAccountNumber(value);
    }
  };

  const validateIfsc = (code: string) => {
    if (code.length !== 11) {
      return false;
    }
    return code[4] === '0';
  };

  const handleIfscChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setIfscCode(value);

    if (value.length < 11) {
      setIfscValidationMessage('');
    }
  };

  const handleIfscBlur = async () => {
    if (ifscCode.length !== 11) {
      setIfscValidationMessage('IFSC code must be 11 characters');
      return;
    }

    if (ifscCode[4] !== '0') {
      setIfscValidationMessage('5th digit of IFSC code must be 0');
      setBankName('');
      return;
    }

    setIfscValidationMessage('');

    try {
      setIsFetchingBankDetails(true);
      const response = await fetch(`https://ifsc.razorpay.com/${ifscCode}`);
      if (response.ok) {
        const data = await response.json();
        setBankName(`${data.BANK}, ${data.BRANCH}, ${data.CITY}`);
        toast({
          title: "Bank details fetched",
          description: "Bank details have been automatically filled"
        });
      } else {
        setIfscValidationMessage('Invalid IFSC code');
        setBankName('');
      }
    } catch (error) {
      setIfscValidationMessage('Failed to fetch bank details');
      console.error('Error fetching bank details:', error);
    } finally {
      setIsFetchingBankDetails(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBillFile(e.target.files[0]);
    }
  };

  const resetPartyName = () => {
    setPartyNameFixed(false);
    setPartyName('');
  };

  const handleCalendarSelect = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate);
      setIsCalendarOpen(false);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from('invoice-images')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('invoice-images')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Could not upload file. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!partyId.trim()) {
      toast({
        title: "Missing Invoice Number",
        description: "Please provide an Invoice Number",
        variant: "destructive"
      });
      return;
    }

    if (materialItems.length === 0) {
      toast({
        title: "No materials added",
        description: "Please add at least one material item",
        variant: "destructive"
      });
      return;
    }

    if (approverType === "ho" && !validateIfsc(ifscCode)) {
      toast({
        title: "Invalid IFSC code",
        description: "Please provide a valid IFSC code with 5th digit as '0'",
        variant: "destructive"
      });
      return;
    }

    try {
      let fileUrl = '';
      if (billFile) {
        fileUrl = await uploadFile(billFile) || '';
      }

      const primaryMaterial = materialItems[0];

      const bankDetails = {
        accountNumber: approverType === "ho" ? accountNumber : "",
        bankName: approverType === "ho" ? bankName : "",
        ifscCode: approverType === "ho" ? ifscCode : "",
        email: approverType === "ho" ? email : "",
        mobile: approverType === "ho" ? mobile : "",
      };

      const invoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
        date,
        partyId,
        partyName,
        material: materialItems.map(item => item.material).join(', '),
        quantity: primaryMaterial.quantity || 0,
        rate: primaryMaterial.rate || 0,
        gstPercentage: primaryMaterial.gstPercentage || 18,
        grossAmount: grandGrossAmount,
        netAmount: grandNetAmount,
        materialItems: materialItems,
        bankDetails: bankDetails,
        billUrl: fileUrl,
        paymentStatus,
        createdBy: 'Current User',
        approverType: approverType,
        siteId: siteId
      };

      // Save to Supabase
      if (siteId) {
        const { data, error } = await supabase
          .from('site_invoices')
          .insert({
            site_id: siteId,
            date: date.toISOString(),
            party_id: partyId,
            party_name: partyName,
            material: materialItems.map(item => item.material).join(', '),
            quantity: primaryMaterial.quantity || 0,
            rate: primaryMaterial.rate || 0,
            gst_percentage: primaryMaterial.gstPercentage || 18,
            gross_amount: grandGrossAmount,
            net_amount: grandNetAmount,
            material_items: JSON.stringify(materialItems),
            bank_details: JSON.stringify(bankDetails),
            bill_url: fileUrl,
            payment_status: paymentStatus,
            created_by: 'Current User',
            approver_type: approverType
          });

        if (error) {
          console.error('Error saving invoice:', error);
          toast({
            title: "Failed to save invoice",
            description: error.message,
            variant: "destructive"
          });
          return;
        }
      }

      onSubmit(invoiceData);
      
      // Reset form after submission
      setDate(new Date());
      setPartyId('');
      setPartyName('');
      setPartyNameFixed(false);
      setMaterialItems([]);
      setGrandGrossAmount(0);
      setGrandNetAmount(0);
      setBillFile(null);
      setBillUrl('');
      setPaymentStatus(PaymentStatus.PENDING);
      setAccountNumber('');
      setBankName('');
      setIfscCode('');
      setEmail('');
      setMobile('');
      setApproverType("ho");
      
      if (onClose) onClose();
    } catch (error) {
      console.error('Error in form submission:', error);
      toast({
        title: "Error",
        description: "Failed to submit the invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  return isOpen ? (
    <Dialog open={isOpen} onOpenChange={onClose ? () => onClose() : undefined}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle>
            {siteId ? "Add Site Invoice" : "Add Invoice"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Invoice Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar 
                    mode="single" 
                    selected={date} 
                    onSelect={handleCalendarSelect} 
                    initialFocus 
                    className={cn("p-3 pointer-events-auto")} 
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="party" className="flex items-center">
                <User className="h-4 w-4 mr-1 text-muted-foreground" />
                Party Name
              </Label>
              <div className="flex gap-2">
                <Input id="party" value={partyName} onChange={handlePartyNameChange} onBlur={handlePartyNameBlur} placeholder="Enter party name" required disabled={partyNameFixed} className={partyNameFixed ? "bg-muted" : ""} />
                {partyNameFixed && <Button type="button" variant="outline" size="icon" onClick={resetPartyName} className="flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partyId" className="flex items-center">
                <FileText className="h-4 w-4 mr-1 text-muted-foreground" />
                Invoice Number
              </Label>
              <Input id="partyId" value={partyId} onChange={e => setPartyId(e.target.value)} placeholder="Enter invoice number" required />
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Materials</h3>
            </div>
            
            <div className="p-3 sm:p-4 border rounded-md mb-4 bg-muted/30">
              <h4 className="font-medium mb-3">Add New Material</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="material-input">Material Name</Label>
                  <Input id="material-input" value={materialInput} onChange={e => setMaterialInput(e.target.value)} placeholder="e.g., TMT Steel Bars" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="quantity-input">Quantity</Label>
                  <Input id="quantity-input" type="number" value={quantityInput || ''} onChange={e => setQuantityInput(Number(e.target.value))} min="0" step="0.01" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rate-input">Rate (₹)</Label>
                  <Input id="rate-input" type="number" value={rateInput || ''} onChange={e => setRateInput(Number(e.target.value))} min="0" step="0.01" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gst-input">GST Percentage (%)</Label>
                  <Select value={gstPercentageInput.toString()} onValueChange={value => setGstPercentageInput(Number(value))}>
                    <SelectTrigger id="gst-input">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {gstRates.map(rate => <SelectItem key={rate} value={rate.toString()}>
                          {rate}%
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button type="button" onClick={addMaterialItem} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Material
              </Button>
            </div>
            
            {materialItems.length > 0 && <div className="mb-4">
                <h4 className="font-medium mb-2">Material Items List</h4>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full">
                    <thead className="bg-muted text-left">
                      <tr>
                        <th className="py-2 px-2 sm:px-4 font-medium">#</th>
                        <th className="py-2 px-2 sm:px-4 font-medium">Material</th>
                        <th className="py-2 px-2 sm:px-4 font-medium text-right">Qty</th>
                        <th className="py-2 px-2 sm:px-4 font-medium text-right">Rate (₹)</th>
                        <th className="py-2 px-2 sm:px-4 font-medium text-right">GST %</th>
                        <th className="py-2 px-2 sm:px-4 font-medium text-right">Amount (₹)</th>
                        <th className="py-2 px-2 sm:px-4 font-medium text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialItems.map((item, index) => <tr key={item.id} className="border-t">
                          <td className="py-3 px-2 sm:px-4">{index + 1}</td>
                          <td className="py-3 px-2 sm:px-4 max-w-[120px] sm:max-w-none truncate">{item.material}</td>
                          <td className="py-3 px-2 sm:px-4 text-right">{item.quantity}</td>
                          <td className="py-3 px-2 sm:px-4 text-right">{item.rate?.toLocaleString()}</td>
                          <td className="py-3 px-2 sm:px-4 text-right">{item.gstPercentage}%</td>
                          <td className="py-3 px-2 sm:px-4 text-right">{item.amount?.toLocaleString()}</td>
                          <td className="py-3 px-2 sm:px-4 text-center">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterialItem(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>}
            
            <div className="bg-muted p-3 sm:p-4 rounded-md mt-4">
              <div className="flex flex-col md:flex-row md:justify-end md:items-center gap-4">
                <div className="space-y-2 md:w-1/4">
                  <Label htmlFor="grandGross">Net Taxable Amount (₹)</Label>
                  <Input id="grandGross" value={grandGrossAmount.toLocaleString()} readOnly className="bg-muted font-medium" />
                </div>
                
                <div className="space-y-2 md:w-1/4">
                  <Label htmlFor="grandNet" className="font-medium">Grand Net Total (₹)</Label>
                  <Input id="grandNet" value={grandNetAmount.toLocaleString()} readOnly className="bg-muted font-bold text-primary" />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-medium mb-4">Payment made by</h3>
            <div className="bg-muted/30 p-3 sm:p-4 rounded-md">
              <RadioGroup value={approverType} onValueChange={value => setApproverType(value as "ho" | "supervisor")} className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ho" id="ho" />
                  <Label htmlFor="ho">Head Office</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="supervisor" id="supervisor" disabled={grandNetAmount > 5000} />
                  <Label htmlFor="supervisor" className={grandNetAmount > 5000 ? "text-muted-foreground" : ""}>
                    Supervisor
                  </Label>
                </div>
              </RadioGroup>
              
              {grandNetAmount > 5000 && <div className="mt-3 flex items-center text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span>Amounts over ₹5,000 must be approved by Head Office</span>
                </div>}
            </div>
          </div>

          <Separator />

          {approverType === "ho" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number (max 16 digits)</Label>
                  <Input id="accountNumber" value={accountNumber} onChange={handleAccountNumberChange} placeholder="Enter Account Number (max 16 digits)" required maxLength={16} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <div className="relative">
                    <Input id="ifscCode" value={ifscCode} onChange={handleIfscChange} onBlur={handleIfscBlur} placeholder="Enter IFSC Code (11 characters)" maxLength={11} required className={ifscValidationMessage ? "border-red-500" : ""} />
                    {isFetchingBankDetails && <div className="absolute top-0 right-0 h-full flex items-center pr-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>}
                    {ifscValidationMessage && <p className="text-red-500 text-sm mt-1">{ifscValidationMessage}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be 11 characters and 5th digit must be '0'
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name & Branch</Label>
                  <Input id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank Name (auto-filled from IFSC)" required readOnly={bankName !== ''} className={bankName ? "bg-muted" : ""} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number (Optional)</Label>
                  <Input id="mobile" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="Mobile Number" maxLength={10} />
                </div>
              </div>
              <Separator className="mt-6" />
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bill">Upload Bill</Label>
              <div className="border border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <input type="file" id="bill" className="hidden" accept=".pdf,.jpg,.jpeg,.png,image/*" onChange={handleFileChange} capture="environment" />
                <label htmlFor="bill" className="cursor-pointer flex flex-col items-center">
                  <div className="flex gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground mt-2">
                    {billFile ? billFile.name : "Click to upload or take a photo"}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Payment Status</Label>
              <Select value={paymentStatus} onValueChange={value => setPaymentStatus(value as PaymentStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={PaymentStatus.PAID}>Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : initialData ? "Update Invoice" : "Create Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  ) : null;
};

export default InvoiceForm;
