import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// Schema
const siteFormSchema = z.object({
  name: z.string().min(2, "Site name must be at least 2 characters").max(100),
  jobName: z.string().min(2, "Job name must be at least 2 characters").max(100),
  posNo: z.string().min(2, "P.O. number must be at least 2 characters").max(50),
  location: z.string().min(2, "Location must be at least 2 characters").max(100),
  startDate: z.date({ required_error: "Start date is required" }),
  completionDate: z.date().nullable().optional(),
  supervisorId: z.string().min(2, "You must select a supervisor"),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;
interface SiteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: SiteFormValues) => void;
  supervisorId?: string;
}
interface Supervisor { id: string; name?: string }

const SUBMIT_TIMEOUT_MS = 45000;
const AUTH_OP_TIMEOUT_MS = 15000;

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise as Promise<T>,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Submission timed out')), ms)),
  ]);
}
async function softGetSession(timeoutMs: number): Promise<any | null> {
  try {
    const result = await Promise.race([
      (supabase.auth.getSession() as unknown as Promise<any>),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return result && result.data ? result.data.session : null;
  } catch {
    return null;
  }
}
async function softRefreshSession(timeoutMs: number): Promise<boolean> {
  try {
    const result = await Promise.race([
      (supabase.auth.refreshSession() as unknown as Promise<any>),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    return result !== false;
  } catch {
    return false;
  }
}

export default function SiteForm({ isOpen, onClose, onSubmit, supervisorId }: SiteFormProps) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [completionDateOpen, setCompletionDateOpen] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { user } = useAuth();

  const supervisorIdRef = useRef<string | undefined>(supervisorId);
  const submissionInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submissionDataRef = useRef<SiteFormValues | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { supervisorIdRef.current = supervisorId; }, [supervisorId]);

  // Removed extra visibility listener here; global handlers already refresh session

  const defaultValues = useMemo(() => ({
    name: '',
    jobName: '',
    posNo: '',
    location: '',
    startDate: new Date(),
    completionDate: null,
    supervisorId: supervisorId || '',
  }), [supervisorId]);
  const form = useForm<SiteFormValues>({ resolver: zodResolver(siteFormSchema), defaultValues });

  useEffect(() => { if (supervisorId) form.setValue('supervisorId', supervisorId); }, [supervisorId, form]);
  useEffect(() => { if (!isOpen) form.reset(defaultValues); }, [isOpen, form, supervisorId]);

  const fetchSupervisors = async () => {
    try {
      setLoadingError(null);
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor')
        .order('name');
      if (error) { setLoadingError('Failed to load supervisors'); return; }
      setSupervisors(data || []);
    } catch {
      setLoadingError('Error loading supervisors');
    }
  };
  useEffect(() => { if (isOpen) fetchSupervisors(); }, [isOpen]);

  const retrySubmission = useCallback(async () => {
    if (!submissionDataRef.current || retryCount >= 3) {
      setIsLoading(false);
      submissionInProgressRef.current = false;
      toast.error('Failed after multiple attempts.');
      return;
    }
    const delay = Math.pow(2, retryCount) * 1000;
    setRetryCount(prev => prev + 1);
    retryTimeoutRef.current = setTimeout(async () => {
      try { await performSubmission(submissionDataRef.current!); }
      catch { await retrySubmission(); }
    }, delay);
  }, [retryCount]);

  const performSubmission = useCallback(async (values: SiteFormValues): Promise<boolean> => {
    const currentSupervisorId = values.supervisorId || supervisorIdRef.current || '';
    if (!currentSupervisorId) { toast.error("Supervisor is required"); return false; }
    try {
      if (navigator.onLine === false) { toast.error('You are offline.'); return false; }
      abortControllerRef.current = new AbortController();
      const siteData = {
        name: values.name.toUpperCase(),
        job_name: values.jobName.toUpperCase(),
        pos_no: values.posNo.toUpperCase(),
        location: values.location.toUpperCase(),
        start_date: values.startDate.toISOString().split('T')[0],
        completion_date: values.completionDate ? values.completionDate.toISOString().split('T')[0] : null,
        supervisor_id: currentSupervisorId,
        is_completed: false,
      };
      const { data: insertData, error: insertError } = await withTimeout(
        supabase.from('sites').insert([siteData]).select(),
        SUBMIT_TIMEOUT_MS
      );
      if (insertError) throw insertError;
      if (!insertData || insertData.length === 0) { toast.error('No data returned from site creation.'); return false; }
      return true;
    } catch (firstErr: any) {
      const looksAuth = String(firstErr?.message).includes('JWT') || String(firstErr?.status) === '401';
      if (looksAuth) {
        await softRefreshSession(AUTH_OP_TIMEOUT_MS);
        const { data: retryData, error: retryErr } = await withTimeout(
          supabase.from('sites').insert([{
            ...values,
            name: values.name.toUpperCase(),
            job_name: values.jobName.toUpperCase(),
            pos_no: values.posNo.toUpperCase(),
            location: values.location.toUpperCase(),
            start_date: values.startDate.toISOString().split('T')[0],
            completion_date: values.completionDate ? values.completionDate.toISOString().split('T')[0] : null,
            supervisor_id: currentSupervisorId,
            is_completed: false,
          }]).select(),
          SUBMIT_TIMEOUT_MS
        );
        if (retryErr) throw retryErr;
        return retryData && retryData.length > 0;
      }
      throw firstErr;
    }
  }, []);

  const onFormSubmit = async (values: SiteFormValues) => {
    if (submissionInProgressRef.current) return;
    try {
      setIsLoading(true);
      submissionInProgressRef.current = true;
      submissionDataRef.current = values;
      setRetryCount(0);
      const success = await performSubmission(values);
      if (success) {
        const uppercaseValues = {
          ...values,
          name: values.name.toUpperCase(),
          jobName: values.jobName.toUpperCase(),
          posNo: values.posNo.toUpperCase(),
          location: values.location.toUpperCase(),
          supervisorId: values.supervisorId || supervisorIdRef.current || ''
        };
        onSubmit(uppercaseValues);
        toast.success('Site created successfully');
        onClose();
        form.reset();
        submissionDataRef.current = null;
      } else {
        await retrySubmission();
      }
    } catch (error: any) {
      toast.error('Error creating site: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
      submissionInProgressRef.current = false;
      abortControllerRef.current = null;
    }
  };
  useEffect(() => () => { if (abortControllerRef.current) abortControllerRef.current.abort(); }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[95vw] max-w-[95vw] sm:w-auto overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Site</DialogTitle>
          <DialogDescription>Enter the details for the new construction site.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Site Name</FormLabel><FormControl><Input placeholder="Enter site name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="jobName" render={({ field }) => (
              <FormItem><FormLabel>Job Name</FormLabel><FormControl><Input placeholder="Enter job name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="posNo" render={({ field }) => (
              <FormItem><FormLabel>P.O. Number</FormLabel><FormControl><Input placeholder="Enter P.O. number" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Enter site location" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="startDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Select a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setStartDateOpen(false); }} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="completionDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Expected Completion Date <span className="text-muted-foreground text-xs">(Optional)</span></FormLabel>
                <Popover open={completionDateOpen} onOpenChange={setCompletionDateOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Select a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value || undefined}
                      onSelect={(date) => { field.onChange(date); setCompletionDateOpen(false); }}
                      initialFocus
                      fromDate={form.getValues("startDate")}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="supervisorId" render={({ field }) => (
              <FormItem>
                <FormLabel>Supervisor</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a supervisor" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {loadingError ? (
                      <div className="p-2 text-center text-destructive text-sm">{loadingError}
                        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={(e) => { e.preventDefault(); fetchSupervisors(); }}>Retry</Button>
                      </div>
                    ) : supervisors.length === 0 ? (
                      <div className="p-2 text-center text-muted-foreground text-sm">No supervisors found</div>
                    ) : (
                      supervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>{supervisor.name || 'Unknown'}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Creating...'}</>) : 'Create Site'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
