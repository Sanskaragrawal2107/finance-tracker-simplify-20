
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { IndianRupee, CalendarIcon, User } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SupervisorTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  transactionType: 'funds_received' | 'advance_paid';
  siteId: string;
}

interface FormData {
  supervisorId: string;
  siteId: string;
  amount: number;
  date: Date;
}

const SupervisorTransactionForm: React.FC<SupervisorTransactionFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  transactionType,
  siteId
}) => {
  const { user } = useAuth();
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  const [supervisorSites, setSupervisorSites] = useState<any[]>([]);
  const [selectedSupervisorSite, setSelectedSupervisorSite] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formReady, setFormReady] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      date: new Date(),
      amount: 0,
    }
  });

  useEffect(() => {
    if (isOpen) {
      // Fetch all supervisors from the database
      fetchSupervisors();
      reset({
        date: new Date(),
        amount: 0
      });
    }
  }, [isOpen]);

  const fetchSupervisors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor');
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        // If current user is a supervisor, filter out their own ID
        const filteredSupervisors = user?.role === 'supervisor' 
          ? data.filter(sup => sup.id !== user.id)
          : data;
          
        setSupervisors(filteredSupervisors);
        setFormReady(true);
      } else {
        setFormReady(false);
        toast.error('No supervisors found in the system');
      }
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      toast.error('Failed to load supervisors');
      setFormReady(false);
    }
  };

  const fetchSupervisorSites = async (supervisorId: string) => {
    if (!supervisorId) return;
    
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, location')
        .eq('supervisor_id', supervisorId)
        .eq('is_completed', false);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        setSupervisorSites(data);
        // Don't auto-select a site
        setSelectedSupervisorSite('');
      } else {
        setSupervisorSites([]);
        setSelectedSupervisorSite('');
        toast.error('No active sites found for this supervisor');
      }
    } catch (error) {
      console.error('Error fetching supervisor sites:', error);
      toast.error('Failed to load supervisor sites');
      setSupervisorSites([]);
    }
  };

  const onFormSubmit = async (data: FormData) => {
    if (!user) {
      toast.error('You must be logged in to perform this action');
      return;
    }
    
    if (!selectedSupervisor) {
      toast.error('Please select a supervisor');
      return;
    }
    
    if (!selectedSupervisorSite && transactionType === 'funds_received') {
      toast.error('Please select a site');
      return;
    }
    
    if (data.amount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      let payerSupervisorId, receiverSupervisorId, payerSiteId, receiverSiteId;
      
      if (transactionType === 'funds_received') {
        // Current user is sending funds to selected supervisor
        payerSupervisorId = user.id;
        receiverSupervisorId = selectedSupervisor;
        payerSiteId = siteId;
        receiverSiteId = selectedSupervisorSite;
      } else { // 'advance_paid'
        // Current user is paying an advance to selected supervisor
        payerSupervisorId = user.id;
        receiverSupervisorId = selectedSupervisor;
        payerSiteId = siteId;
        receiverSiteId = selectedSupervisorSite || ''; // If no site is selected, use empty string
      }
      
      const { error } = await supabase
        .from('supervisor_transactions')
        .insert({
          date: data.date.toISOString(),
          payer_supervisor_id: payerSupervisorId,
          receiver_supervisor_id: receiverSupervisorId,
          payer_site_id: payerSiteId,
          receiver_site_id: receiverSiteId,
          amount: data.amount,
          transaction_type: transactionType
        });
        
      if (error) throw error;
      
      toast.success(`Transaction recorded successfully`);
      reset();
      onSubmit();
      onClose();
    } catch (error) {
      console.error('Error submitting transaction:', error);
      toast.error('Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupervisorChange = (value: string) => {
    setSelectedSupervisor(value);
    fetchSupervisorSites(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {transactionType === 'funds_received' 
              ? 'Funds Received from Supervisor' 
              : 'Advance Paid to Supervisor'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supervisorId">Supervisor</Label>
              <Select onValueChange={handleSupervisorChange} value={selectedSupervisor}>
                <SelectTrigger id="supervisorId" className="w-full">
                  <SelectValue placeholder="Select a supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supervisorId && <p className="text-sm text-red-600">{errors.supervisorId.message}</p>}
            </div>
            
            {transactionType === 'funds_received' && (
              <div className="space-y-2">
                <Label htmlFor="siteId">Supervisor Site</Label>
                <Select onValueChange={setSelectedSupervisorSite} value={selectedSupervisorSite}>
                  <SelectTrigger id="siteId" className="w-full">
                    <SelectValue placeholder="Select supervisor's site" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisorSites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} - {site.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.siteId && <p className="text-sm text-red-600">{errors.siteId.message}</p>}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="amount"
                  className="pl-8"
                  type="number"
                  step="0.01"
                  {...register('amount', { 
                    required: 'Amount is required',
                    min: { value: 0.01, message: 'Amount must be greater than 0' } 
                  })}
                />
              </div>
              {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !register('date') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {register('date') ? (
                      format(new Date(), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    initialFocus
                    selected={new Date()}
                    onSelect={(date) => date && setValue('date', date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formReady}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SupervisorTransactionForm;
