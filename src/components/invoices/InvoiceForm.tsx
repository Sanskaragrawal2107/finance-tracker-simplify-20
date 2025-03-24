import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea"
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { PaymentMethod, PaymentStatus, BankDetails, MaterialItem } from '@/lib/types';
import { InputWithButton } from '@/components/ui/input-with-button';
import { FileInput } from '@/components/ui/file-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const bankDetailsSchema = z.object({
  accountNumber: z.string().min(5, {
    message: 'Account number must be at least 5 characters.',
  }),
  bankName: z.string().min(2, {
    message: 'Bank name must be at least 2 characters.',
  }),
  ifscCode: z.string().min(5, {
    message: 'IFSC code must be at least 5 characters.',
  }),
  email: z.string().email().optional(),
  mobile: z.string().regex(/^[0-9]*$/, { message: "Mobile number must contain only numbers" }).min(10, {
    message: 'Mobile number must be at least 10 characters.',
  }).optional(),
});

const materialItemSchema = z.object({
  material: z.string().min(2, {
    message: 'Material must be at least 2 characters.',
  }),
  quantity: z.string().optional().refine((val) => val === "" || (!isNaN(Number(val)) && Number(val) > 0), {
    message: 'Quantity must be a positive number',
  }),
  rate: z.string().optional().refine((val) => val === "" || (!isNaN(Number(val)) && Number(val) > 0), {
    message: 'Rate must be a positive number',
  }),
  gstPercentage: z.string().optional().refine((val) => val === "" || (!isNaN(Number(val)) && Number(val) >= 0), {
    message: 'GST Percentage must be a non-negative number',
  }),
  amount: z.string().optional(),
});

const invoiceSchema = z.object({
  date: z.date({
    required_error: 'Date is required',
  }),
  partyId: z.string().min(2, {
    message: 'Party ID must be at least 2 characters.',
  }),
  partyName: z.string().min(2, {
    message: 'Party name must be at least 2 characters.',
  }),
  material: z.string().min(2, {
    message: 'Material must be at least 2 characters.',
  }),
  quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Quantity must be a positive number',
  }),
  rate: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Rate must be a positive number',
  }),
  gstPercentage: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'GST Percentage must be a non-negative number',
  }),
  paymentStatus: z.nativeEnum(PaymentStatus, {
    required_error: 'Please select a payment status',
  }),
  approverType: z.enum(['ho', 'supervisor'], {
    required_error: 'Please select an approver type',
  }),
  siteId: z.string({
    required_error: 'Please select a site',
  }),
  materialItems: z.array(materialItemSchema).optional(),
  bankDetails: bankDetailsSchema,
  billUrl: z.string().optional(),
  invoiceImageUrl: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  siteId?: string;
  onSuccess?: () => void;
  invoice?: any;
  isEditMode?: boolean;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  siteId,
  onSuccess,
  invoice,
  isEditMode,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billUrl, setBillUrl] = useState<string | undefined>(invoice?.billUrl);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState<string | undefined>(invoice?.invoiceImageUrl);
  const [sites, setSites] = useState<{ id: string; name: string; location: string; }[]>([]);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      date: invoice ? new Date(invoice.date) : new Date(),
      partyId: invoice ? invoice.partyId : '',
      partyName: invoice ? invoice.partyName : '',
      material: invoice ? invoice.material : '',
      quantity: invoice ? invoice.quantity : '',
      rate: invoice ? invoice.rate : '',
      gstPercentage: invoice ? invoice.gstPercentage : '',
      paymentStatus: invoice ? invoice.paymentStatus : PaymentStatus.PENDING,
      approverType: invoice ? invoice.approverType : 'ho',
      siteId: invoice ? invoice.siteId : siteId || '',
      materialItems: invoice ? invoice.materialItems : [{ material: '', quantity: '', rate: '', gstPercentage: '', amount: '' }],
      bankDetails: invoice ? invoice.bankDetails : { accountNumber: '', bankName: '', ifscCode: '', email: '', mobile: '' },
      billUrl: invoice ? invoice.billUrl : '',
      invoiceImageUrl: invoice ? invoice.invoiceImageUrl : '',
    },
  });

  useEffect(() => {
    if (siteId) {
      fetchSites();
    }
  }, [siteId]);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, location');

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load sites');
    }
  };

  const grossAmount = form.watch('quantity') && form.watch('rate') ? Number(form.watch('quantity')) * Number(form.watch('rate')) : 0;
  const gstPercentage = form.watch('gstPercentage') ? Number(form.watch('gstPercentage')) : 0;
  const netAmount = grossAmount + (grossAmount * (gstPercentage / 100));

  const handleBillUpload = async (file: File) => {
    try {
      setLoading(true);
      const filePath = `bills/${user?.id}/${file.name}`;
      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading file:', error);
        toast.error('Failed to upload bill');
      } else {
        const url = `${SUPABASE_URL}/storage/v1/object/public/${data.Key}`;
        setBillUrl(url);
        form.setValue('billUrl', url);
        toast.success('Bill uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading bill:', error);
      toast.error('Failed to upload bill');
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceImageUpload = async (file: File) => {
    try {
      setLoading(true);
      const filePath = `invoices/${user?.id}/${file.name}`;
      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading file:', error);
        toast.error('Failed to upload invoice image');
      } else {
        const url = `${SUPABASE_URL}/storage/v1/object/public/${data.Key}`;
        setInvoiceImageUrl(url);
        form.setValue('invoiceImageUrl', url);
        toast.success('Invoice image uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading invoice image:', error);
      toast.error('Failed to upload invoice image');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: InvoiceFormValues) => {
    try {
      setLoading(true);
      
      // Prepare invoice data with all required fields
      const invoiceData = {
        date: values.date.toISOString(),
        party_id: values.partyId,
        party_name: values.partyName,
        material: values.material, // Ensure this field is included as it's required
        quantity: Number(values.quantity),
        rate: Number(values.rate),
        gst_percentage: Number(values.gstPercentage),
        gross_amount: grossAmount,
        net_amount: netAmount,
        material_items: JSON.stringify(values.materialItems),
        bank_details: JSON.stringify(values.bankDetails),
        bill_url: billUrl,
        invoice_image_url: invoiceImageUrl,
        payment_status: values.paymentStatus,
        created_by: user?.id,
        approver_type: values.approverType,
        site_id: values.siteId
      };
      
      if (isEditMode && invoice) {
        // Update existing invoice
        const { error } = await supabase
          .from('site_invoices')
          .update(invoiceData)
          .eq('id', invoice.id);

        if (error) throw error;
        toast.success('Invoice updated successfully');
      } else {
        // Create new invoice
        const { error } = await supabase
          .from('site_invoices')
          .insert(invoiceData);

        if (error) throw error;
        toast.success('Invoice added successfully');
      }
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error adding/updating invoice:', error);
      toast.error('Failed to add/update invoice');
    } finally {
      setLoading(false);
    }
  };

  const renderMaterialItems = () => {
    return (
      <div>
        <FormLabel>Material Items</FormLabel>
        {form.watch('materialItems')?.map((item, index) => (
          <div key={index} className="flex space-x-2 mb-2">
            <FormField
              control={form.control}
              name={`materialItems.${index}.material` as const}
              render={({ field }) => (
                <FormItem className="w-1/4">
                  <FormLabel>Material</FormLabel>
                  <FormControl>
                    <Input placeholder="Material" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`materialItems.${index}.quantity` as const}
              render={({ field }) => (
                <FormItem className="w-1/6">
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Quantity" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`materialItems.${index}.rate` as const}
              render={({ field }) => (
                <FormItem className="w-1/6">
                  <FormLabel>Rate</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Rate" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`materialItems.${index}.gstPercentage` as const}
              render={({ field }) => (
                <FormItem className="w-1/6">
                  <FormLabel>GST (%)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="GST %" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`materialItems.${index}.amount` as const}
              render={({ field }) => (
                <FormItem className="w-1/6">
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Amount" value={(Number(form.getValues(`materialItems.${index}.quantity`)) * Number(form.getValues(`materialItems.${index}.rate`))).toString()} readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ))}
      </div>
    );
  };

  const renderBankDetails = () => {
    return (
      <div>
        <FormLabel>Bank Details</FormLabel>
        <FormField
          control={form.control}
          name="bankDetails.accountNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Number</FormLabel>
              <FormControl>
                <Input placeholder="Account Number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bankDetails.bankName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank Name</FormLabel>
              <FormControl>
                <Input placeholder="Bank Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bankDetails.ifscCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IFSC Code</FormLabel>
              <FormControl>
                <Input placeholder="IFSC Code" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bankDetails.email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Optional)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bankDetails.mobile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile (Optional)</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="Mobile" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="siteId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Site</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} - {site.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="partyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Party ID</FormLabel>
              <FormControl>
                <Input placeholder="Party ID" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="partyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Party Name</FormLabel>
              <FormControl>
                <Input placeholder="Party Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="material"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Material</FormLabel>
              <FormControl>
                <Textarea placeholder="Material" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex space-x-2">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem className="w-1/2">
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Quantity" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rate"
            render={({ field }) => (
              <FormItem className="w-1/2">
                <FormLabel>Rate</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Rate" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="gstPercentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GST Percentage</FormLabel>
              <FormControl>
                <Input type="number" placeholder="GST Percentage" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-between">
          <div>
            <p className="text-sm">Gross Amount: ₹{grossAmount.toLocaleString()}</p>
            <p className="text-sm">GST Amount: ₹{(grossAmount * (gstPercentage / 100)).toLocaleString()}</p>
          </div>
          <p className="text-lg font-semibold">Net Amount: ₹{netAmount.toLocaleString()}</p>
        </div>

        {renderMaterialItems()}
        {renderBankDetails()}

        <FormField
          control={form.control}
          name="paymentStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentStatus.PENDING}>{PaymentStatus.PENDING}</SelectItem>
                  <SelectItem value={PaymentStatus.PAID}>{PaymentStatus.PAID}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="approverType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Approver Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select approver type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ho">Head Office</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FileInput
          id="bill"
          name="bill"
          label="Upload Bill"
          onFileChange={handleBillUpload}
          initialPreview={billUrl}
        />

        <FileInput
          id="invoiceImage"
          name="invoiceImage"
          label="Upload Invoice Image"
          onFileChange={handleInvoiceImageUpload}
          initialPreview={invoiceImageUrl}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Adding Invoice...' : 'Add Invoice'}
        </Button>
      </form>
    </Form>
  );
};

export default InvoiceForm;
