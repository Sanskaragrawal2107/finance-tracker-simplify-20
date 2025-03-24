import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Expense, Site, Invoice, UserRole, MaterialItem, PaymentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomCard from '@/components/ui/CustomCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface ExpensesProps {
  userRole: UserRole;
}

const Expenses: React.FC<ExpensesProps> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState('expenses');
  const [isMobile, setIsMobile] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [siteInvoices, setSiteInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (activeSite) {
      fetchExpenses(activeSite.id);
    }
  }, [activeSite]);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!activeSite) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('site_invoices')
          .select('*')
          .eq('site_id', activeSite.id);

        if (error) {
          throw error;
        }

        if (!data) {
          setSiteInvoices([]);
          return;
        }

        const formattedInvoices: Invoice[] = data.map((invoice: any) => ({
          id: invoice.id,
          date: new Date(invoice.date),
          partyId: invoice.party_id,
          partyName: invoice.party_name,
          vendorName: invoice.vendor_name || invoice.party_name,
          invoiceNumber: invoice.invoice_number || '',
          material: invoice.material,
          quantity: invoice.quantity,
          rate: invoice.rate,
          gstPercentage: invoice.gst_percentage,
          grossAmount: invoice.gross_amount,
          netAmount: invoice.net_amount,
          materialItems: invoice.material_items as MaterialItem[] || [],
          bankDetails: invoice.bank_details || {
            accountNumber: '',
            bankName: '',
            ifscCode: '',
            email: '',
            mobile: ''
          },
          billUrl: invoice.bill_url,
          invoiceImageUrl: invoice.invoice_image_url || '',
          paymentStatus: invoice.payment_status as PaymentStatus,
          createdBy: invoice.created_by,
          createdAt: new Date(invoice.created_at),
          approverType: invoice.approver_type as "ho" | "supervisor",
          siteId: invoice.site_id,
          status: invoice.payment_status as PaymentStatus,
          paymentBy: invoice.payment_by || ''
        }));

        setSiteInvoices(formattedInvoices);
      } catch (error: any) {
        console.error('Error fetching invoices:', error);
        setError(error.message || 'Failed to load invoices');
        toast.error(error.message || 'Failed to load invoices');
      } finally {
        setLoading(false);
      }
    };

    if (activeSite) {
      fetchInvoices();
    }
  }, [activeSite]);

  const fetchSites = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data) {
        setSites([]);
        return;
      }

      const formattedSites: Site[] = data.map(site => ({
        id: site.id,
        name: site.name,
        jobName: site.job_name,
        posNo: site.pos_no,
        location: site.location,
        startDate: new Date(site.start_date),
        completionDate: site.completion_date ? new Date(site.completion_date) : undefined,
        supervisorId: site.supervisor_id,
        supervisor: site.supervisor,
        createdAt: new Date(site.created_at),
        isCompleted: site.is_completed,
        funds: site.funds,
        totalFunds: site.total_funds,
      }));

      setSites(formattedSites);
      if (formattedSites.length > 0) {
        setActiveSite(formattedSites[0]);
      }
    } catch (error: any) {
      console.error('Error fetching sites:', error);
      setError(error.message || 'Failed to load sites');
      toast.error(error.message || 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async (siteId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data) {
        setExpenses([]);
        return;
      }

      const formattedExpenses: Expense[] = data.map(expense => ({
        id: expense.id,
        date: new Date(expense.date),
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        status: expense.status,
        createdBy: expense.created_by,
        createdAt: new Date(expense.created_at),
        siteId: expense.site_id,
        supervisorId: expense.supervisor_id
      }));

      setExpenses(formattedExpenses);
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      setError(error.message || 'Failed to load expenses');
      toast.error(error.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleSiteChange = (siteId: string) => {
    const site = sites.find(site => site.id === siteId);
    if (site) {
      setActiveSite(site);
    }
  };

  const handleApproveInvoice = async (invoice: Invoice) => {
    if (!user?.id) {
      toast.error('You must be logged in to approve invoices.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updatedInvoice: Invoice = {
        ...invoice,
        paymentStatus: PaymentStatus.PAID,
        status: PaymentStatus.PAID,
      };

      const { error } = await supabase
        .from('site_invoices')
        .update({
          payment_status: PaymentStatus.PAID,
        })
        .eq('id', invoice.id);

      if (error) {
        throw error;
      }

      setSiteInvoices(prevInvoices =>
        prevInvoices.map(inv =>
          inv.id === invoice.id ? updatedInvoice : inv
        )
      );

      toast.success('Invoice approved successfully');
    } catch (error: any) {
      console.error('Error approving invoice:', error);
      setError(error.message || 'Failed to approve invoice');
      toast.error(error.message || 'Failed to approve invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Expenses</h1>
        {userRole === UserRole.ADMIN && (
          <Button onClick={() => navigate('/sites/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Site
          </Button>
        )}
      </div>

      <CustomCard className="mb-6">
        <CardHeader>
          <CardTitle>Select Site</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {loading ? (
              <p className="text-center text-muted-foreground">Loading sites...</p>
            ) : error ? (
              <p className="text-center text-red-500">{error}</p>
            ) : sites.length === 0 ? (
              <p className="text-center text-muted-foreground">No sites found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sites.map((site) => (
                  <Button
                    key={site.id}
                    variant={activeSite?.id === site.id ? 'default' : 'outline'}
                    onClick={() => handleSiteChange(site.id)}
                  >
                    {site.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </CustomCard>

      {activeSite && (
        <CustomCard>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">
              {activeSite.name} - Expenses & Invoices
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage expenses and invoices for the selected site.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="expenses">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses" className="pt-4">
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Loading expenses...</p>
                ) : error ? (
                  <p className="text-center text-red-500 py-8">{error}</p>
                ) : expenses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No expenses found for this site.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              {format(new Date(expense.date), 'dd MMM yyyy')}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {expense.description}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant="outline" className="bg-gray-100 text-gray-800">
                                {expense.category}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {expense.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant="secondary">{expense.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="invoices" className="pt-4">
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Loading invoices...</p>
                ) : error ? (
                  <p className="text-center text-red-500 py-8">{error}</p>
                ) : siteInvoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No invoices found for this site.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Vendor</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                          {userRole === UserRole.ADMIN && (
                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {siteInvoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              {format(new Date(invoice.date), 'dd MMM yyyy')}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {invoice.vendorName || invoice.partyName}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {invoice.netAmount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant="secondary">{invoice.status}</Badge>
                            </td>
                            {userRole === UserRole.ADMIN && (
                              <td className="px-4 py-3 text-sm">
                                {invoice.paymentStatus !== PaymentStatus.PAID ? (
                                  <Button size="sm" onClick={() => handleApproveInvoice(invoice)}>
                                    Approve
                                  </Button>
                                ) : (
                                  <Badge variant="outline">Approved</Badge>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </CustomCard>
      )}
    </div>
  );
};

export default Expenses;
