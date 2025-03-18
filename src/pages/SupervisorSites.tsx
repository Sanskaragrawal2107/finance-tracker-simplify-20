import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  PlusCircle,
  Edit,
  Trash,
  Eye,
  Download,
  ChevronsUpDown,
  AlertTriangle,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import {
  Site,
  Expense,
  Advance,
  FundsReceived,
  Invoice,
  UserRole,
  ExpenseCategory,
  AdvancePurpose,
  ApprovalStatus,
  PaymentStatus,
  RecipientType,
  BalanceSummary,
} from '@/lib/types';
import PageTitle from '@/components/common/PageTitle';
import SiteDetail from '@/components/sites/SiteDetail';

interface DataTableProps<TData, TValue> {
  columns: any[];
  data: TData[];
  searchKey?: string;
}

const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'jobName',
    header: 'Job Name',
  },
  {
    accessorKey: 'posNo',
    header: 'PO Number',
  },
  {
    accessorKey: 'location',
    header: 'Location',
  },
  {
    accessorKey: 'startDate',
    header: 'Start Date',
    cell: ({ row }) => format(new Date(row.startDate), 'dd/MM/yyyy'),
  },
  {
    accessorKey: 'completionDate',
    header: 'Completion Date',
    cell: ({ row }) => row.completionDate ? format(new Date(row.completionDate), 'dd/MM/yyyy') : 'N/A',
  },
];

const SupervisorSites: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [fundsReceived, setFundsReceived] = useState<FundsReceived[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSite, setNewSite] = useState<Omit<Site, 'id' | 'createdAt' | 'isCompleted'>>({
    name: '',
    jobName: '',
    posNo: '',
    location: '',
    startDate: new Date(),
    supervisorId: user?.id || '',
    supervisor: user?.name || '',
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [siteToEdit, setSiteToEdit] = useState<Site | null>(null);
  const [editedSite, setEditedSite] = useState<Partial<Site>>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  });
  const [isFilteringByDate, setIsFilteringByDate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

  useEffect(() => {
    const fetchSites = async () => {
      setIsLoading(true);
      try {
        if (!user) {
          console.error('User not found');
          return;
        }

        let query = supabase
          .from('sites')
          .select('*')
          .eq('supervisor_id', user.id);

        if (isFilteringByDate && dateRange?.from && dateRange?.to) {
          query = query.gte('start_date', format(dateRange.from, 'yyyy-MM-dd'))
            .lte('start_date', format(dateRange.to, 'yyyy-MM-dd'));
        }

        const { data: sitesData, error: sitesError } = await query;

        if (sitesError) {
          console.error('Error fetching sites:', sitesError);
          toast.error(`Error fetching sites: ${sitesError.message}`);
          return;
        }

        if (sitesData) {
          setSites(sitesData as Site[]);
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        toast.error(`Error fetching sites: ${error}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSites();
  }, [user, isFilteringByDate, dateRange]);

  const handleAddSite = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert([
          {
            ...newSite,
            start_date: format(newSite.startDate, 'yyyy-MM-dd'),
          },
        ]);

      if (error) {
        console.error('Error adding site:', error);
        toast.error(`Error adding site: ${error.message}`);
        return;
      }

      setSites([...sites, { id: data[0].id, createdAt: new Date(), isCompleted: false, ...newSite }]);
      setIsAddingSite(false);
      setNewSite({
        name: '',
        jobName: '',
        posNo: '',
        location: '',
        startDate: new Date(),
        supervisorId: user?.id || '',
        supervisor: user?.name || '',
      });
      toast.success('Site added successfully!');
    } catch (error) {
      console.error('Error adding site:', error);
      toast.error(`Error adding site: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!siteToDelete) return;

    setIsDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('sites')
        .delete()
        .eq('id', siteToDelete);

      if (error) {
        console.error('Error deleting site:', error);
        toast.error(`Error deleting site: ${error.message}`);
        return;
      }

      setSites(sites.filter(site => site.id !== siteToDelete));
      setSiteToDelete(null);
      setIsDeleteDialogOpen(false);
      toast.success('Site deleted successfully!');
    } catch (error) {
      console.error('Error deleting site:', error);
      toast.error(`Error deleting site: ${error}`);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const handleEditSite = async () => {
    if (!siteToEdit) return;

    setIsEditLoading(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update(editedSite)
        .eq('id', siteToEdit.id);

      if (error) {
        console.error('Error editing site:', error);
        toast.error(`Error editing site: ${error.message}`);
        return;
      }

      setSites(sites.map(site => site.id === siteToEdit.id ? { ...site, ...editedSite } : site));
      setSiteToEdit(null);
      setEditedSite({});
      setIsEditingSite(false);
      toast.success('Site updated successfully!');
    } catch (error) {
      console.error('Error editing site:', error);
      toast.error(`Error editing site: ${error}`);
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleTransactionsUpdate = useCallback(async () => {
    if (!selectedSiteId) return;

    try {
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
        toast.error(`Error fetching expenses: ${expensesError.message}`);
        return;
      }

      const { data: advancesData, error: advancesError } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (advancesError) {
        console.error('Error fetching advances:', advancesError);
        toast.error(`Error fetching advances: ${advancesError.message}`);
        return;
      }

      const { data: fundsData, error: fundsError } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (fundsError) {
        console.error('Error fetching funds:', fundsError);
        toast.error(`Error fetching funds: ${fundsError.message}`);
        return;
      }

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('site_invoices')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        toast.error(`Error fetching invoices: ${invoicesError.message}`);
        return;
      }

      setExpenses(expensesData as Expense[]);
      setAdvances(advancesData as Advance[]);
      setFundsReceived(fundsData as FundsReceived[]);
      setInvoices(invoicesData as Invoice[]);
    } catch (error) {
      console.error('Error updating transactions:', error);
      toast.error(`Error updating transactions: ${error}`);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (selectedSiteId) {
      handleTransactionsUpdate();
    }
  }, [selectedSiteId, handleTransactionsUpdate]);

  const handleAddExpense = async (expense: Partial<Expense>) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([
          {
            ...expense,
            date: format(new Date(expense.date as Date), 'yyyy-MM-dd'),
            site_id: selectedSiteId,
            supervisor_id: user?.id,
            created_by: user?.id,
          },
        ]);

      if (error) {
        console.error('Error adding expense:', error);
        toast.error(`Error adding expense: ${error.message}`);
        return;
      }

      setExpenses([...expenses, { id: data[0].id, createdAt: new Date(), createdBy: user?.id || '', status: ApprovalStatus.PENDING, supervisorId: user?.id || '', ...expense }]);
      toast.success('Expense added successfully!');
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error(`Error adding expense: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAdvance = async (advance: Partial<Advance>) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('advances')
        .insert([
          {
            ...advance,
            date: format(new Date(advance.date as Date), 'yyyy-MM-dd'),
            site_id: selectedSiteId,
            created_by: user?.id,
          },
        ]);

      if (error) {
        console.error('Error adding advance:', error);
        toast.error(`Error adding advance: ${error.message}`);
        return;
      }

      setAdvances([...advances, { id: data[0].id, createdAt: new Date(), createdBy: user?.id || '', status: ApprovalStatus.PENDING, ...advance }]);
      toast.success('Advance added successfully!');
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding advance:', error);
      toast.error(`Error adding advance: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFunds = async (fund: Partial<FundsReceived>) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('funds_received')
        .insert([
          {
            ...fund,
            date: format(new Date(fund.date as Date), 'yyyy-MM-dd'),
            site_id: selectedSiteId,
          },
        ]);

      if (error) {
        console.error('Error adding funds:', error);
        toast.error(`Error adding funds: ${error.message}`);
        return;
      }

      setFundsReceived([...fundsReceived, { id: data[0].id, createdAt: new Date(), ...fund }]);
      toast.success('Funds added successfully!');
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding funds:', error);
      toast.error(`Error adding funds: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddInvoice = async (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('site_invoices')
        .insert([
          {
            ...invoice,
            date: format(new Date(invoice.date), 'yyyy-MM-dd'),
            site_id: selectedSiteId,
            created_by: user?.id,
          },
        ]);

      if (error) {
        console.error('Error adding invoice:', error);
        toast.error(`Error adding invoice: ${error.message}`);
        return;
      }

      setInvoices([...invoices, { id: data[0].id, createdAt: new Date(), ...invoice }]);
      toast.success('Invoice added successfully!');
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding invoice:', error);
      toast.error(`Error adding invoice: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSite = async (siteId: string, completionDate: Date) => {
    setSites(
      sites.map((site) =>
        site.id === siteId ? { ...site, isCompleted: true, completionDate: completionDate } : site
      )
    );
  };

  const calculateSiteFinancials = (siteId: string): BalanceSummary => {
    const siteExpenses = expenses.filter(expense => expense.siteId === siteId);
    const siteAdvances = advances.filter(advance => advance.siteId === siteId);
    const siteFundsReceived = fundsReceived.filter(fund => fund.siteId === siteId);
    const siteInvoices = invoices.filter(invoice => invoice.siteId === siteId);

    const totalExpenditure = siteExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalAdvances = siteAdvances.reduce((sum, advance) => sum + advance.amount, 0);
    const fundsReceivedTotal = siteFundsReceived.reduce((sum, fund) => sum + fund.amount, 0);
    const invoicesPaid = siteInvoices.reduce((sum, invoice) => (invoice.paymentStatus === PaymentStatus.PAID ? sum + invoice.netAmount : sum), 0);
    const pendingInvoices = siteInvoices.reduce((sum, invoice) => (invoice.paymentStatus === PaymentStatus.PENDING ? sum + invoice.netAmount : sum), 0);
    const debitsToWorker = siteAdvances.reduce((sum, advance) => (advance.purpose === AdvancePurpose.OTHER ? sum + advance.amount : sum), 0);

    const totalBalance = fundsReceivedTotal - totalExpenditure - totalAdvances - invoicesPaid;

    return {
      fundsReceived: fundsReceivedTotal,
      totalExpenditure,
      totalAdvances,
      debitsToWorker,
      invoicesPaid,
      pendingInvoices,
      totalBalance,
    };
  };

  const selectedSite = sites.find(site => site.id === selectedSiteId);
  const siteExpenses = expenses.filter(expense => expense.siteId === selectedSiteId);
  const siteAdvances = advances.filter(advance => advance.siteId === selectedSiteId);
  const siteFunds = fundsReceived.filter(fund => fund.siteId === selectedSiteId);
  const siteInvoices = invoices.filter(invoice => invoice.siteId === selectedSiteId);

  const renderInvoiceContent = (invoice: Invoice) => (
    <div className="flex flex-col space-y-1">
      <div className="flex justify-between">
        <span className="text-sm font-medium">{invoice.partyName}</span>
        <Badge 
          variant="outline" 
          className={`text-xs ${
            invoice.paymentStatus === 'paid' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-orange-100 text-orange-600'
          }`}
        >
          {invoice.paymentStatus}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{invoice.material}</p>
      <div className="flex justify-between text-sm">
        <span>₹{invoice.netAmount?.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">
          {invoice.approverType === 'ho' ? 'HO Approval' : 'Supervisor Approval'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <PageTitle title="Sites" subtitle="Manage your construction sites" />
        <Button onClick={() => setIsAddingSite(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </div>

      <div className="mb-4 flex items-center space-x-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "justify-start text-left font-normal",
                !dateRange?.from || !dateRange.to
                  ? "text-muted-foreground"
                  : undefined
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from && dateRange.to ? (
                <>
                  {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                  {format(dateRange.to, "dd/MM/yyyy")}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              onMonthChange={() => { }}
              numberOfMonths={2}
            />
            <div className="flex justify-end p-2">
              <Button size="sm" variant="ghost" onClick={() => {
                setDateRange({
                  from: new Date(new Date().getFullYear(), 0, 1),
                  to: new Date(),
                });
                setIsFilteringByDate(false);
              }}>Reset</Button>
              <Button size="sm" onClick={() => setIsFilteringByDate(true)}>Apply</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : selectedSiteId ? (
        selectedSite && (
          <div className="animate-fade-in">
            <SiteDetail 
              site={selectedSite} 
              onBack={() => setSelectedSiteId(null)} 
              userRole={user?.role || UserRole.VIEWER}
              expenses={siteExpenses}
              advances={siteAdvances}
              fundsReceived={siteFunds}
              invoices={siteInvoices}
              onAddExpense={handleAddExpense}
              onAddAdvance={handleAddAdvance}
              onAddFunds={handleAddFunds}
              onAddInvoice={handleAddInvoice}
              onCompleteSite={handleCompleteSite}
              balanceSummary={calculateSiteFinancials(selectedSiteId || '')}
              onUpdateTransactions={handleTransactionsUpdate}
            />
          </div>
        )
      ) : (
        sites.length > 0 ? (
          <DataTable columns={columns} data={sites} />
        ) : (
          <Card className="w-full">
            <CardContent>
              <p className="text-center text-muted-foreground">No sites found. Add a new site to get started.</p>
            </CardContent>
          </Card>
        )
      )}

      <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>
              Create a new construction site to manage expenses and track progress.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                type="text"
                id="name"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="jobName" className="text-right">
                Job Name
              </Label>
              <Input
                type="text"
                id="jobName"
                value={newSite.jobName}
                onChange={(e) => setNewSite({ ...newSite, jobName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="posNo" className="text-right">
                PO Number
              </Label>
              <Input
                type="text"
                id="posNo"
                value={newSite.posNo}
                onChange={(e) => setNewSite({ ...newSite, posNo: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                type="text"
                id="location"
                value={newSite.location}
                onChange={(e) => setNewSite({ ...newSite, location: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right">
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newSite.startDate
                        ? "text-muted-foreground"
                        : undefined
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newSite.startDate ? (
                      format(newSite.startDate, "dd/MM/yyyy")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={newSite.startDate}
                    onSelect={(date) => setNewSite({ ...newSite, startDate: date || new Date() })}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2020-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsAddingSite(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleAddSite} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the site and all
              associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSite} disabled={isDeleteLoading}>
              {isDeleteLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditingSite} onOpenChange={setIsEditingSite}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Make changes to the selected construction site.
            </DialogDescription>
          </DialogHeader>
          {siteToEdit && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  type="text"
                  id="name"
                  defaultValue={siteToEdit.name}
                  onChange={(e) => setEditedSite({ ...editedSite, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="jobName" className="text-right">
                  Job Name
                </Label>
                <Input
                  type="text"
                  id="jobName"
                  defaultValue={siteToEdit.jobName}
                  onChange={(e) => setEditedSite({ ...editedSite, jobName: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="posNo" className="text-right">
                  PO Number
                </Label>
                <Input
                  type="text"
                  id="posNo"
                  defaultValue={siteToEdit.posNo}
                  onChange={(e) => setEditedSite({ ...editedSite, posNo: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <Input
                  type="text"
                  id="location"
                  defaultValue={siteToEdit.location}
                  onChange={(e) => setEditedSite({ ...editedSite, location: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsEditingSite(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleEditSite} disabled={isEditLoading}>
              {isEditLoading ? "Updating..." : "Update Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorSites;
