import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, ArrowLeft, CheckCircle2, Clock, AlertCircle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Site, UserRole, Expense, Advance, FundsReceived, Invoice } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import SiteDetailTransactions from './SiteDetailTransactions';
import { updateSiteFinancialSummary } from '@/integrations/supabase/client';
import { 
  SupervisorTransactionForm 
} from '@/components/transactions/SupervisorTransactionForm';
import {
  SupervisorTransactionHistory
} from '@/components/transactions/SupervisorTransactionHistory';

interface SiteDetailProps {
  site: Site;
  onBack: () => void;
  userRole: UserRole;
}

const SiteDetail: React.FC<SiteDetailProps> = ({ site, onBack, userRole }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showFormModal, setShowFormModal] = useState(false);
  const [activeModal, setActiveModal] = useState<'expense' | 'advance' | 'fundsReceived' | 'invoice' | 'supervisorTransaction' | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [localSite, setLocalSite] = useState<Site>(site);
  const [supervisor, setSupervisor] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [fundsReceived, setFundsReceived] = useState<FundsReceived[]>([]);
  const [localExpensesCount, setLocalExpensesCount] = useState(0);
  const [localAdvancesCount, setLocalAdvancesCount] = useState(0);
  const [localFundsReceivedCount, setLocalFundsReceivedCount] = useState(0);
  const [localInvoicesCount, setLocalInvoicesCount] = useState(0);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [selectedSiteForTransaction, setSelectedSiteForTransaction] = useState<string | null>(null);

  const canManageSite = userRole === UserRole.ADMIN || (userRole === UserRole.SUPERVISOR && user?.id === site.supervisorId);

  useEffect(() => {
    fetchSiteData();
  }, [site.id]);

  const fetchSiteData = async () => {
    try {
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*, users!sites_supervisor_id_fkey(name)')
        .eq('id', site.id)
        .single();

      if (siteError) {
        console.error('Error fetching site:', siteError);
        toast({
          title: 'Error fetching site',
          description: siteError.message,
          variant: 'destructive',
        });
        return;
      }

      if (siteData) {
        const transformedSite: Site = {
          id: siteData.id,
          name: siteData.name,
          jobName: siteData.job_name || '',
          posNo: siteData.pos_no || '',
          location: siteData.location || '',
          startDate: siteData.start_date ? new Date(siteData.start_date) : new Date(),
          completionDate: siteData.completion_date ? new Date(siteData.completion_date) : undefined,
          supervisorId: siteData.supervisor_id || '',
          supervisor: siteData.users?.name || 'Unassigned',
          createdAt: new Date(siteData.created_at || new Date()),
          isCompleted: siteData.is_completed || false,
          funds: siteData.funds || 0,
          totalFunds: siteData.total_funds || 0,
        };

        setLocalSite(transformedSite);
        setSupervisor(siteData.users);
      }

      // Fetch counts for transactions
      const { count: expensesCount, error: expensesError } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', site.id);

      if (expensesError) {
        console.error('Error fetching expenses count:', expensesError);
      } else {
        setLocalExpensesCount(expensesCount || 0);
      }

      const { count: advancesCount, error: advancesError } = await supabase
        .from('advances')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', site.id);

      if (advancesError) {
        console.error('Error fetching advances count:', advancesError);
      } else {
        setLocalAdvancesCount(advancesCount || 0);
      }

      const { count: fundsReceivedCount, error: fundsReceivedError } = await supabase
        .from('funds_received')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', site.id);

      if (fundsReceivedError) {
        console.error('Error fetching funds received count:', fundsReceivedError);
      } else {
        setLocalFundsReceivedCount(fundsReceivedCount || 0);
      }

      const { count: invoicesCount, error: invoicesError } = await supabase
        .from('site_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', site.id);

      if (invoicesError) {
        console.error('Error fetching invoices count:', invoicesError);
      } else {
        setLocalInvoicesCount(invoicesCount || 0);
      }
    } catch (error) {
      console.error('Error in fetchSiteData:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch site details. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditSite = () => {
    navigate(`/admin/sites/edit/${site.id}`);
  };

  const handleDeleteSite = async () => {
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase.from('sites').delete().eq('id', site.id);

      if (error) {
        console.error('Error deleting site:', error);
        toast({
          title: 'Error deleting site',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Site deleted',
        description: 'The site has been deleted successfully.',
      });

      setShowDeleteConfirmation(false);
      onBack();
    } catch (error) {
      console.error('Error in confirmDelete:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete site. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteSite = async () => {
    setIsCompleting(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update({ is_completed: true })
        .eq('id', site.id);

      if (error) {
        console.error('Error completing site:', error);
        toast({
          title: 'Error completing site',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Site completed',
        description: 'The site has been marked as completed.',
      });

      setLocalSite({ ...localSite, isCompleted: true });
    } catch (error) {
      console.error('Error in handleCompleteSite:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete site. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleReopenSite = async () => {
    setIsReopening(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update({ is_completed: false })
        .eq('id', site.id);

      if (error) {
        console.error('Error reopening site:', error);
        toast({
          title: 'Error reopening site',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Site reopened',
        description: 'The site has been reopened successfully.',
      });

      setLocalSite({ ...localSite, isCompleted: false });
    } catch (error) {
      console.error('Error in handleReopenSite:', error);
      toast({
        title: 'Error',
        description: 'Failed to reopen site. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsReopening(false);
    }
  };

  const handleAddExpense = () => {
    setActiveModal('expense');
    setShowFormModal(true);
  };

  const handleAddAdvance = () => {
    setActiveModal('advance');
    setShowFormModal(true);
  };

  const handleAddFundsReceived = () => {
    setActiveModal('fundsReceived');
    setShowFormModal(true);
  };

  const handleAddInvoice = () => {
    setActiveModal('invoice');
    setShowFormModal(true);
  };

  const handleSupervisorTransaction = () => {
    setActiveModal('supervisorTransaction');
    setShowFormModal(true);
  };

  const handleOpenTransactionDialog = (site: Site) => {
    setSelectedSiteForTransaction(site.id);
    setShowTransactionDialog(true);
  };

  const onTransactionsUpdate = async () => {
    await fetchSiteData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <PageTitle 
          title={site.name} 
          subtitle="Detailed information about the selected site" 
        />
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sites
        </Button>
      </div>

      <CustomCard>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold">{localSite.name}</h2>
            <p className="text-sm text-muted-foreground">
              {localSite.location}
            </p>
          </div>
          <Badge variant="outline" className={`flex items-center ${localSite.isCompleted
            ? 'text-green-600 bg-green-100'
            : 'text-blue-600 bg-blue-100'}`}>
            {localSite.isCompleted ? (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            ) : (
              <Clock className="h-4 w-4 mr-1" />
            )}
            {localSite.isCompleted ? 'Completed' : 'Active'}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Job Name:</span> {localSite.jobName || 'N/A'}
          </p>
          <p>
            <span className="font-medium text-foreground">POS No:</span> {localSite.posNo || 'N/A'}
          </p>
          <p>
            <span className="font-medium text-foreground">Start Date:</span>{' '}
            {format(localSite.startDate, 'dd MMM yyyy')}
          </p>
          {localSite.completionDate && (
            <p>
              <span className="font-medium text-foreground">Completion Date:</span>{' '}
              {format(localSite.completionDate, 'dd MMM yyyy')}
            </p>
          )}
          <p>
            <span className="font-medium text-foreground">Supervisor:</span>{' '}
            {supervisor?.name || 'N/A'}
          </p>
        </div>

        {canManageSite && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={handleAddExpense} className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
            <Button onClick={handleAddAdvance} className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Advance
            </Button>
            <Button onClick={handleAddFundsReceived} className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Funds Received
            </Button>
            <Button onClick={handleAddInvoice} className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Invoice
            </Button>
            <Button onClick={handleSupervisorTransaction} className="flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Advance Paid to Supervisor
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          {userRole === UserRole.ADMIN && (
            <>
              <Button variant="secondary" onClick={handleEditSite}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Site
              </Button>
              <Button variant="destructive" onClick={handleDeleteSite}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Site
              </Button>
            </>
          )}
          {!localSite.isCompleted ? (
            <Button onClick={handleCompleteSite} disabled={isCompleting}>
              {isCompleting ? (
                <>
                  Completing...
                  <Clock className="h-4 w-4 ml-2 animate-spin" />
                </>
              ) : (
                <>
                  Complete Site
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleReopenSite} disabled={isReopening}>
              {isReopening ? (
                <>
                  Reopening...
                  <Clock className="h-4 w-4 ml-2 animate-spin" />
                </>
              ) : (
                <>
                  Reopen Site
                  <ArrowLeft className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </CustomCard>

      <SiteDetailTransactions
        siteId={site.id}
        expensesCount={localExpensesCount}
        advancesCount={localAdvancesCount}
        fundsReceivedCount={localFundsReceivedCount}
        userRole={userRole}
        isAdminView={userRole === UserRole.ADMIN}
        site={localSite}
        supervisor={supervisor}
        onTransactionsUpdate={onTransactionsUpdate}
      />

      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this site? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmation(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeModal === 'expense' && (
        <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>
                Create a new expense record for this site.
              </DialogDescription>
            </DialogHeader>
            {/* ExpenseForm siteId={site.id} onSuccess={fetchSiteData} /> */}
          </DialogContent>
        </Dialog>
      )}

      {activeModal === 'advance' && (
        <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Advance</DialogTitle>
              <DialogDescription>
                Record a new advance payment for this site.
              </DialogDescription>
            </DialogHeader>
            {/* AdvanceForm siteId={site.id} onSuccess={fetchSiteData} /> */}
          </DialogContent>
        </Dialog>
      )}

      {activeModal === 'fundsReceived' && (
        <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Funds Received</DialogTitle>
              <DialogDescription>
                Log newly received funds for this site.
              </DialogDescription>
            </DialogHeader>
            {/* FundsReceivedForm siteId={site.id} onSuccess={fetchSiteData} /> */}
          </DialogContent>
        </Dialog>
      )}

      {activeModal === 'invoice' && (
        <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Invoice</DialogTitle>
              <DialogDescription>
                Create a new invoice record for this site.
              </DialogDescription>
            </DialogHeader>
            {/* InvoiceForm siteId={site.id} onSuccess={fetchSiteData} /> */}
          </DialogContent>
        </Dialog>
      )}

      {activeModal === 'supervisorTransaction' && (
        <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Advance to Supervisor</DialogTitle>
              <DialogDescription>
                Pay an advance to another supervisor from this site's balance.
              </DialogDescription>
            </DialogHeader>
            <SupervisorTransactionForm
              payerSiteId={site.id}
              onSuccess={() => {
                setShowFormModal(false);
                toast.success('Transaction added successfully');
                fetchSiteData();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SiteDetail;
