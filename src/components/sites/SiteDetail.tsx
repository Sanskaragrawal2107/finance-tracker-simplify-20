import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Edit, CheckCircle, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { Expense, Site, UserRole, Advance, FundsReceived, Invoice } from '@/lib/types';
import { TransactionHistory } from '@/components/transactions/TransactionHistory';
import { SupervisorTransactionHistory } from '@/components/transactions/SupervisorTransactionHistory';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import AdvanceForm from '@/components/advances/AdvanceForm';
import FundsReceivedForm from '@/components/funds/FundsReceivedForm';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import StatsCard from '@/components/dashboard/StatsCard';

interface SiteDetailProps {
  siteId: string;
  onBack: () => void;
  userRole: UserRole;
}

const SiteDetail: React.FC<SiteDetailProps> = ({ siteId, onBack, userRole }) => {
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [fundsReceived, setFundsReceived] = useState<FundsReceived[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [siteSummary, setSiteSummary] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionDate, setCompletionDate] = useState<Date | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [showFundsForm, setShowFundsForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  const fetchSiteDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();
        
      if (siteError) {
        console.error('Error fetching site details:', siteError);
        toast.error('Failed to load site details');
        return;
      }
      
      if (siteData) {
        const transformedSite: Site = {
          id: siteData.id,
          name: siteData.name,
          jobName: siteData.job_name,
          posNo: siteData.pos_no,
          location: siteData.location,
          startDate: new Date(siteData.start_date),
          completionDate: siteData.completion_date ? new Date(siteData.completion_date) : undefined,
          supervisorId: siteData.supervisor_id,
          supervisor: siteData.supervisor_id || 'Unassigned',
          createdAt: new Date(siteData.created_at),
          isCompleted: siteData.is_completed,
          funds: siteData.funds || 0,
          totalFunds: siteData.total_funds || 0
        };
        setSite(transformedSite);
      } else {
        setSite(null);
      }

      const { data: summaryData, error: summaryError } = await supabase
        .from('site_financial_summary')
        .select('*')
        .eq('site_id', siteId)
        .single();

      if (summaryError) {
        console.error('Error fetching site financial summary:', summaryError);
        toast.error('Failed to load site financial summary');
      }

      setSiteSummary(summaryData || null);
    } catch (error) {
      console.error('Error fetching site details:', error);
      toast.error('Failed to load site details');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchSiteDetails();
  }, [fetchSiteDetails]);

  const handleCompleteSite = async () => {
    if (!completionDate) {
      toast.error("Please select a completion date");
      return;
    }

    setIsCompleting(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update({ 
          is_completed: true, 
          completion_date: completionDate.toISOString() 
        })
        .eq('id', siteId);
        
      if (error) throw error;
      
      toast.success("Site marked as completed");
      setShowCompleteDialog(false);
      fetchSiteDetails();
    } catch (error: any) {
      console.error('Error completing site:', error);
      toast.error('Failed to mark site as completed: ' + error.message);
    } finally {
      setIsCompleting(false);
    }
  };

  const refreshData = async (dataType: string) => {
    fetchSiteDetails();
  };

  if (isLoading) {
    return <div>Loading site details...</div>;
  }

  if (!site) {
    return <div>Site not found</div>;
  }

  const financialData = {
    totalExpenses: siteSummary ? siteSummary.total_expenses_paid : 0,
    totalAdvances: siteSummary ? siteSummary.total_advances_paid : 0,
    fundsReceived: siteSummary ? siteSummary.funds_received : 0,
    fundsReceivedFromSupervisor: siteSummary ? siteSummary.funds_received_from_supervisor : 0,
    advancePaidToSupervisor: siteSummary ? siteSummary.advance_paid_to_supervisor : 0,
    invoicesPaid: siteSummary ? siteSummary.invoices_paid : 0,
    pendingInvoices: 0, // You might need to calculate this from site invoices
    currentBalance: siteSummary ? siteSummary.current_balance : 0
  };

  return (
    <div className="container py-6 space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Sites
      </Button>
      
      <Card className="space-y-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{site.name}</CardTitle>
          <CardDescription>
            {site.jobName} - {site.location}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium leading-none">Site Information</h4>
            <Separator className="my-2" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                <strong>POS No:</strong> {site.posNo}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Start Date:</strong> {format(site.startDate, 'PPP')}
              </p>
              {site.completionDate && (
                <p className="text-sm text-muted-foreground">
                  <strong>Completion Date:</strong> {format(site.completionDate, 'PPP')}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                <strong>Supervisor:</strong> {site.supervisor}
              </p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium leading-none">Financial Summary</h4>
            <Separator className="my-2" />
            <div className="space-y-2">
              <StatsCard
                title="Funds Received"
                value={`₹${financialData.fundsReceived.toLocaleString()}`}
              />
              <StatsCard
                title="Total Expenses"
                value={`₹${financialData.totalExpenses.toLocaleString()}`}
              />
              <StatsCard
                title="Total Advances"
                value={`₹${financialData.totalAdvances.toLocaleString()}`}
              />
              <StatsCard
                title="Invoices Paid"
                value={`₹${financialData.invoicesPaid.toLocaleString()}`}
              />
              <StatsCard
                title="Current Balance"
                value={`₹${financialData.currentBalance.toLocaleString()}`}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          {site.isCompleted ? (
            <Badge variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Completed
            </Badge>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isCompleting}>
                  {isCompleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <Circle className="mr-2 h-4 w-4" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark Site as Complete?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to mark this site as complete? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Form>
                  <FormField
                    control={{}}
                    name="completionDate"
                    render={() => (
                      <FormItem>
                        <FormLabel>Completion Date</FormLabel>
                        <DatePicker
                          selected={completionDate}
                          onSelect={setDate => setCompletionDate(setDate)}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Form>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCompleteSite} disabled={isCompleting}>
                    {isCompleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      "Complete"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {userRole === UserRole.ADMIN && (
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Site
            </Button>
          )}
        </CardFooter>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>View and manage site transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border">
              <TransactionHistory siteId={siteId} />
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={() => setShowExpenseForm(true)}>Add Expense</Button>
            <Button onClick={() => setShowAdvanceForm(true)}>Add Advance</Button>
            <Button onClick={() => setShowFundsForm(true)}>Add Funds</Button>
            <Button onClick={() => setShowInvoiceForm(true)}>Add Invoice</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supervisor Transactions</CardTitle>
            <CardDescription>View supervisor transactions for this site</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border">
              <SupervisorTransactionHistory siteId={siteId} />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {showExpenseForm && (
        <ExpenseForm 
          siteId={site.id} 
          onSuccess={() => {
            setShowExpenseForm(false);
            refreshData('expense');
          }}
          onClose={() => setShowExpenseForm(false)} 
        />
      )}

      {showAdvanceForm && (
        <AdvanceForm 
          siteId={site.id} 
          onSuccess={() => {
            setShowAdvanceForm(false);
            refreshData('advance');
          }}
          onClose={() => setShowAdvanceForm(false)} 
        />
      )}

      {showFundsForm && (
        <FundsReceivedForm 
          siteId={site.id} 
          onSuccess={() => {
            setShowFundsForm(false);
            refreshData('funds');
          }}
          onClose={() => setShowFundsForm(false)} 
        />
      )}

      {showInvoiceForm && (
        <InvoiceForm 
          siteId={site.id} 
          onSuccess={() => {
            setShowInvoiceForm(false);
            refreshData('invoice');
          }} 
          onClose={() => setShowInvoiceForm(false)}
        />
      )}
    </div>
  );
};

export default SiteDetail;
