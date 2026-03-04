import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PaymentStatus, Invoice, MaterialItem } from '@/lib/types';
import { Calendar as CalendarIcon, Upload, Loader2, Camera, Plus, Trash2, FileText, User, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_MODEL  = 'gemini-2.5-flash-lite';
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
import { useAuth } from "@/hooks/use-auth";
import { useLoadingState } from '@/hooks/use-loading-state';

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
  const [isUploading, setIsUploading] = useLoadingState(false, 30000); // 30 second timeout

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
  const [isFetchingBankDetails, setIsFetchingBankDetails] = useLoadingState(false, 30000); // 30 second timeout

  const [approverType, setApproverType] = useState<"ho" | "supervisor">("ho");
  const [isScanning, setIsScanning] = useState(false);
  const [aiScanApplied, setAiScanApplied] = useState(false);

  const { user } = useAuth();

  // ── sessionStorage persistence (survives tab kills / camera app) ──
  const STORAGE_KEY = `invoice-form-draft-${siteId || 'global'}`;
  const didRestore = useRef(false);

  // Restore saved draft on mount
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.date) setDate(new Date(saved.date));
      if (saved.partyId) setPartyId(saved.partyId);
      if (saved.partyName) { setPartyName(saved.partyName); setPartyNameFixed(true); }
      if (saved.materialItems?.length) setMaterialItems(saved.materialItems);
      if (saved.accountNumber) setAccountNumber(saved.accountNumber);
      if (saved.bankName) setBankName(saved.bankName);
      if (saved.ifscCode) setIfscCode(saved.ifscCode);
      if (saved.email) setEmail(saved.email);
      if (saved.mobile) setMobile(saved.mobile);
      if (saved.paymentStatus) setPaymentStatus(saved.paymentStatus);
      if (saved.approverType) setApproverType(saved.approverType);
    } catch { /* ignore bad data */ }
  }, []);

  // Debounced save to sessionStorage on field changes
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraft = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          date: date.toISOString(),
          partyId, partyName, materialItems,
          accountNumber, bankName, ifscCode, email, mobile,
          paymentStatus, approverType,
        }));
      } catch { /* storage full — ignore */ }
    }, 400);
  }, [date, partyId, partyName, materialItems, accountNumber, bankName, ifscCode, email, mobile, paymentStatus, approverType, STORAGE_KEY]);

  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, [STORAGE_KEY]);

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

    if (totalNet > 2000) {
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
      const file = e.target.files[0];
      setBillFile(file);
      setAiScanApplied(false);
      // Scan both images and PDFs with AI
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        scanBillWithAI(file);
      }
    }
  };

  const scanBillWithAI = async (file: File) => {
    setIsScanning(true);
    setAiScanApplied(false);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'image/jpeg';
      const docType = file.type === 'application/pdf' ? 'PDF document' : 'image';
      const prompt = `You are an invoice data extractor for a construction company. Analyse this bill/invoice ${docType} and extract data in JSON.

Return ONLY valid JSON with these exact keys (use null if not found):
{
  "vendorName": "supplier/party name string",
  "invoiceNumber": "invoice/bill number string",
  "invoiceDate": "YYYY-MM-DD or null",
  "items": [
    {
      "material": "material or service description",
      "quantity": number or null,
      "rate": number per unit or null,
      "gstPercent": one of 0,5,12,18,28 or null
    }
  ],
  "totalAmount": total amount number or null,
  "gstPercent": overall GST rate if uniform (0,5,12,18,28) or null
}

Be precise — extract pure numbers, no currency symbols. If the document has multiple pages, use the first invoice/bill you find.`;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
      });
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64 } },
      ]);
      const rawText: string = result.response.text();

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const extracted = JSON.parse(jsonMatch[0]);

      let fieldsApplied = 0;

      if (extracted.vendorName) {
        setPartyName(extracted.vendorName);
        setPartyNameFixed(false);
        fieldsApplied++;
      }
      if (extracted.invoiceNumber) {
        setPartyId(extracted.invoiceNumber);
        fieldsApplied++;
      }
      if (extracted.invoiceDate) {
        const d = new Date(extracted.invoiceDate);
        if (!isNaN(d.getTime())) { setDate(d); fieldsApplied++; }
      }

      const validGst = [0, 5, 12, 18, 28];
      if (extracted.items && extracted.items.length > 0) {
        const newItems: MaterialItem[] = extracted.items
          .filter((item: any) => item.material)
          .map((item: any) => {
            const qty = Number(item.quantity) || 1;
            const rate = Number(item.rate) || 0;
            const gst = validGst.includes(Number(item.gstPercent))
              ? Number(item.gstPercent)
              : validGst.includes(Number(extracted.gstPercent))
              ? Number(extracted.gstPercent)
              : 18;
            return {
              id: `${Date.now()}-${Math.random()}`,
              material: item.material,
              quantity: qty,
              rate,
              gstPercentage: gst,
              amount: qty * rate,
            };
          });
        if (newItems.length > 0) {
          setMaterialItems(prev => [...prev, ...newItems]);
          fieldsApplied += newItems.length;
        }
      } else if (extracted.totalAmount) {
        const gst = validGst.includes(Number(extracted.gstPercent)) ? Number(extracted.gstPercent) : 18;
        const grossAmt = Math.round(Number(extracted.totalAmount) / (1 + gst / 100));
        setMaterialItems(prev => [...prev, {
          id: Date.now().toString(),
          material: extracted.vendorName ? `Item from ${extracted.vendorName}` : 'Extracted item',
          quantity: 1,
          rate: grossAmt,
          gstPercentage: gst,
          amount: grossAmt,
        }]);
        fieldsApplied++;
      }

      setAiScanApplied(true);
      toast({
        title: `\u2713 AI extracted ${fieldsApplied} field${fieldsApplied !== 1 ? 's' : ''}`,
        description: 'Review the auto-filled data and adjust if needed.',
      });
    } catch (err) {
      console.error('Bill scan error:', err);
      toast({
        title: 'AI scan failed',
        description: 'Could not extract details automatically. Please fill the form manually.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
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
      // Get current user ID from auth
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || user?.id;
      
      if (!userId) {
        toast({
          title: "Authentication Error",
          description: "User authentication error. Please sign in again.",
          variant: "destructive"
        });
        return;
      }
      
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

      const invoiceData: Partial<Invoice> = {
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
        createdBy: userId,
        approverType: approverType,
        siteId: siteId,
        status: paymentStatus
      };

      console.log("Saving invoice data:", invoiceData);

      // Save to Supabase
      if (siteId) {
        try {
          // Try to refresh schema cache
          await supabase.from('site_invoices').select('id').limit(1);
          
          const invoiceSubmitData = {
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
            created_by: userId,
            approver_type: approverType,
            created_at: new Date().toISOString(),
            status: paymentStatus
          };

          console.log("Submitting invoice data:", invoiceSubmitData);
          
          const { data, error } = await supabase
            .from('site_invoices')
            .insert(invoiceSubmitData);

          if (error) {
            console.error('Error saving invoice:', error);
            
            // If the error is about the status column, try without it
            if (error.message.includes('status')) {
              const { status, ...dataWithoutStatus } = invoiceSubmitData;
              
              console.log("Retrying without status field:", dataWithoutStatus);
              const { error: fallbackError } = await supabase
                .from('site_invoices')
                .insert(dataWithoutStatus);
                
              if (fallbackError) {
                console.error("Error in fallback invoice insertion:", fallbackError);
                toast({
                  title: "Failed to save invoice",
                  description: fallbackError.message,
                  variant: "destructive"
                });
                return;
              } else {
                // Success with fallback
                toast({
                  title: "Invoice Created",
                  description: "Invoice saved successfully",
                  variant: "default"
                });
                
                onSubmit(invoiceData as Invoice);
                
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
                setAiScanApplied(false);
                setPaymentStatus(PaymentStatus.PENDING);
                setAccountNumber('');
                setBankName('');
                setIfscCode('');
                setEmail('');
                setMobile('');
                setApproverType("ho");
                clearDraft();
                
                if (onClose) onClose();
                return;
              }
            } else {
              toast({
                title: "Failed to save invoice",
                description: error.message,
                variant: "destructive"
              });
              return;
            }
          }

          // Primary insert succeeded — handle success
          toast({
            title: "Invoice Created",
            description: "Invoice saved successfully",
            variant: "default"
          });
          onSubmit(invoiceData as Invoice);

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
          setAiScanApplied(false);
          setPaymentStatus(PaymentStatus.PENDING);
          setAccountNumber('');
          setBankName('');
          setIfscCode('');
          setEmail('');
          setMobile('');
          setApproverType("ho");
          clearDraft();

          if (onClose) onClose();
        } catch (schemaError) {
          console.error("Schema or query error:", schemaError);
          toast({
            title: "Database Error",
            description: "Database schema error. Please contact support.",
            variant: "destructive"
          });
          return;
        }
      } else {
        toast({
          title: "Missing Site ID",
          description: "Site ID is required to save an invoice",
          variant: "destructive"
        });
        return;
      }
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
    <Dialog open={isOpen} onOpenChange={onClose ? () => { clearDraft(); onClose(); } : undefined}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {siteId ? "Add Site Invoice" : "Add Invoice"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Bill Upload (top – triggers AI scan) ──────────── */}
          <div className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  Upload Bill Photo
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                AI will auto-fill the form fields
              </span>
            </div>

            <input
              type="file"
              id="bill-top"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,image/*"
              onChange={handleFileChange}
              capture="environment"
            />
            <label
              htmlFor="bill-top"
              className="cursor-pointer flex items-center gap-3 p-3 rounded-md border border-border bg-white hover:bg-muted/40 transition-colors"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary">Scanning with AI…</p>
                    <p className="text-xs text-muted-foreground">Extracting vendor, items and amounts</p>
                  </div>
                </>
              ) : aiScanApplied ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      {billFile?.name}
                    </p>
                    <p className="text-xs text-emerald-600">AI has filled the form — review and adjust if needed</p>
                  </div>
                </>
              ) : billFile ? (
                <>
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm">{billFile.name}</p>
                </>
              ) : (
                <>
                  <div className="flex gap-2 flex-shrink-0">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <Camera className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Click to upload or take a photo</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG or PDF — AI will read the bill automatically</p>
                  </div>
                </>
              )}
            </label>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    defaultMonth={date ?? new Date()}
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
            
            <div className="p-3 sm:p-4 border rounded-md mb-4 bg-muted/30 overflow-x-hidden">
              <h4 className="font-medium mb-3">Add New Material</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
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
                {isMobile ? (
                  <div className="space-y-2">
                    {materialItems.map((item, index) => (
                      <div key={item.id} className="border rounded-md p-3 bg-white">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{index + 1}. {item.material}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Qty: {item.quantity} × ₹{item.rate?.toLocaleString()} | GST: {item.gstPercentage}%
                            </p>
                            <p className="text-sm font-semibold text-primary mt-0.5">
                              ₹{item.amount?.toLocaleString()}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={() => removeMaterialItem(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0 rounded-md border">
                  <table className="w-full min-w-[600px]">
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
                          <td className="py-3 px-2 sm:px-4"><div className="max-w-[120px] sm:max-w-none truncate">{item.material}</div></td>
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
                )}
              </div>}
            
            <div className="bg-muted p-3 sm:p-4 rounded-md mt-4">
              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <Label htmlFor="grandGross">Net Taxable Amount (₹)</Label>
                  <Input id="grandGross" value={grandGrossAmount.toLocaleString()} readOnly className="bg-muted font-medium" />
                </div>
                
                <div className="space-y-1">
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
              <RadioGroup value={approverType} onValueChange={value => setApproverType(value as "ho" | "supervisor")} className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ho" id="ho" />
                  <Label htmlFor="ho">Head Office</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="supervisor" id="supervisor" disabled={grandNetAmount > 2000} />
                  <Label htmlFor="supervisor" className={grandNetAmount > 2000 ? "text-muted-foreground" : ""}>
                    Supervisor
                  </Label>
                </div>
              </RadioGroup>
              
              {grandNetAmount > 2000 && <div className="mt-3 flex items-center text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span>Amounts over ₹2,000 must be approved by Head Office</span>
                </div>}
            </div>
          </div>

          <Separator />

          {approverType === "ho" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Bank Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t">
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
