import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Popover, PopoverContent, PopoverTrigger 
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// Schema definition with uppercase transformation
const siteFormSchema = z.object({
  name: z.string().min(2, "Site name must be at least 2 characters").max(100),
  jobName: z.string().min(2, "Job name must be at least 2 characters").max(100),
  posNo: z.string().min(2, "P.O. number must be at least 2 characters").max(50),
  location: z.string().min(2, "Location must be at least 2 characters").max(100),
  startDate: z.date({
    required_error: "Start date is required",
  }),
  completionDate: z.date().nullable().optional(),
  supervisorId: z.string().min(2, "You must select a supervisor"),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

interface SiteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: SiteFormValues) => void;
  supervisorId?: string; // Optional supervisor ID to pre-select
}

// Simplified supervisor interface
interface Supervisor {
  id: string;
  name?: string;
}

// Increase timeouts to better tolerate tab-throttle/network spin-up after returning
const SUBMIT_TIMEOUT_MS = 45000;
const AUTH_OP_TIMEOUT_MS = 15000;
async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise as Promise<T>,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Submission timed out')), ms)),
  ]);
}

// Soft helpers that never throw — they resolve fallback values on timeout/error
async function softGetSession(timeoutMs: number): Promise<any | null> {
  try {
    const result = await Promise.race([
      (supabase.auth.getSession() as unknown as Promise<any>),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    // result could be null (timeout) or { data: { session } }
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
    // If race returned false (timeout), treat as no-op; otherwise consider success
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
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [submissionStartTime, setSubmissionStartTime] = useState<number | null>(null);
  const { user } = useAuth();
  
  // Refs for tab switching resilience
  const supervisorIdRef = useRef<string | undefined>(supervisorId);
  const submissionInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submissionDataRef = useRef<SiteFormValues | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update the ref whenever the prop changes
  useEffect(() => {
    supervisorIdRef.current = supervisorId;
  }, [supervisorId]);
  
  // Page Visibility API - Handle tab switching during form submission
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      setIsTabHidden(isHidden);
      
      if (submissionInProgressRef.current) {
        if (isHidden) {
          console.log('Tab became hidden during form submission - implementing background processing');
          // Store current time when tab becomes hidden
          const hiddenTime = Date.now();
          localStorage.setItem('siteFormHiddenTime', hiddenTime.toString());
          
          // Set a longer timeout for background processing
          if (visibilityTimeoutRef.current) {
            clearTimeout(visibilityTimeoutRef.current);
          }
          
          visibilityTimeoutRef.current = setTimeout(() => {
            console.log('Background processing timeout - checking submission status');
            checkSubmissionStatus();
          }, 30000); // 30 second timeout for background processing
          
        } else {
          console.log('Tab became visible during form submission - resuming normal processing');
          const hiddenTimeStr = localStorage.getItem('siteFormHiddenTime');
          if (hiddenTimeStr) {
            const hiddenTime = parseInt(hiddenTimeStr);
            const hiddenDuration = Date.now() - hiddenTime;
            console.log(`Tab was hidden for ${hiddenDuration}ms during submission`);
            
            // If tab was hidden for more than 10 seconds, check submission status
            if (hiddenDuration > 10000) {
              checkSubmissionStatus();
            }
            
            localStorage.removeItem('siteFormHiddenTime');
          }
          
          // Clear background processing timeout
          if (visibilityTimeoutRef.current) {
            clearTimeout(visibilityTimeoutRef.current);
            visibilityTimeoutRef.current = null;
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, []);
  

  
  // Default form values - ensure all fields have defined values to prevent controlled/uncontrolled warnings
  const defaultValues = useMemo(() => ({
    name: '',
    jobName: '',
    posNo: '',
    location: '',
    startDate: new Date(),
    completionDate: null,
    supervisorId: supervisorId || '',
  }), [supervisorId]);
  
  // Define form
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues,
  });
  
  // Update form when supervisorId prop changes
  useEffect(() => {
    if (supervisorId) {
      console.log('Updating form with supervisorId:', supervisorId);
      form.setValue('supervisorId', supervisorId);
    }
  }, [supervisorId, form]);
  
  // Reset form when dialog closes to prevent stale data
  useEffect(() => {
    if (!isOpen) {
      form.reset(defaultValues);
    }
  }, [isOpen, form, supervisorId]);
  
  // Simple fetch supervisors function - no connection checks
  const fetchSupervisors = async () => {
    try {
      setLoadingError(null);
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor')
        .order('name');
      
      if (error) {
        console.error('Error fetching supervisors:', error);
        setLoadingError('Failed to load supervisors');
        return;
      }
      
      if (data && data.length > 0) {
        setSupervisors(data);
      } else {
        setSupervisors([]);
      }
    } catch (error) {
      console.error('Exception fetching supervisors:', error);
      setLoadingError('Error loading supervisors');
    }
  };
  
  // Load supervisors on mount - once only
  useEffect(() => {
    if (isOpen) {
      fetchSupervisors();
    }
  }, [isOpen]);
  
  // Check submission status - used when tab becomes visible after being hidden
  const checkSubmissionStatus = useCallback(async () => {
    if (!submissionDataRef.current || !user) {
      console.log('No submission data to check or user not available');
      return;
    }
    
    try {
      // Check if site was already created by searching for it
      const { data: existingSites, error } = await supabase
        .from('sites')
        .select('id, name')
        .eq('name', submissionDataRef.current.name.toUpperCase())
        .eq('supervisor_id', submissionDataRef.current.supervisorId || user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error checking submission status:', error);
        return;
      }
      
      if (existingSites && existingSites.length > 0) {
        // Site was successfully created
        console.log('Site was successfully created during background processing:', existingSites[0]);
        toast.success('Site created successfully!');
        
        // Capture values before clearing refs
        const prevValues = submissionDataRef.current;
        
        // Reset form and state
        form.reset();
        submissionInProgressRef.current = false;
        setIsLoading(false);
        setSubmissionStartTime(null);
        submissionDataRef.current = null;
        
        // Notify parent using uppercased values if we have them
        if (prevValues) {
          const uppercaseValues = {
            ...prevValues,
            name: prevValues.name.toUpperCase(),
            jobName: prevValues.jobName.toUpperCase(),
            posNo: prevValues.posNo.toUpperCase(),
            location: prevValues.location.toUpperCase(),
            supervisorId: prevValues.supervisorId || user.id,
          };
          onSubmit(uppercaseValues);
        }
        onClose();
      } else {
        // Site was not created, retry submission
        console.log('Site was not created, retrying submission');
        await retrySubmission();
      }
    } catch (error) {
      console.error('Error in checkSubmissionStatus:', error);
      await retrySubmission();
    }
  }, [user, form, onSubmit, onClose]);
  
  // Retry submission with exponential backoff
  const retrySubmission = useCallback(async () => {
    if (!submissionDataRef.current || retryCount >= 3) {
      console.log('Max retries reached or no submission data');
      setIsLoading(false);
      submissionInProgressRef.current = false;
      setSubmissionStartTime(null);
      toast.error('Failed to create site after multiple attempts. Please try again.');
      return;
    }
    
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
    console.log(`Retrying submission in ${delay}ms (attempt ${retryCount + 1}/3)`);
    
    setRetryCount(prev => prev + 1);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    retryTimeoutRef.current = setTimeout(async () => {
      try {
        await performSubmission(submissionDataRef.current!);
      } catch (error) {
        console.error('Retry submission failed:', error);
        await retrySubmission(); // Recursive retry
      }
    }, delay);
  }, [retryCount]);
  
  // Core submission function that works in background
  const performSubmission = useCallback(async (values: SiteFormValues): Promise<boolean> => {
    const currentSupervisorId = values.supervisorId || supervisorIdRef.current || '';
    
    try {
      // Offline guard
      if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
        toast.error('You appear to be offline. Please check your connection and try again.');
        return false;
      }
      
      // Store submission data for persistence
      const submissionId = Date.now().toString();
      const submissionData = {
        id: submissionId,
        values,
        timestamp: Date.now(),
        userId: user?.id,
        status: 'pending'
      };
      
      // Store in localStorage for persistence across tab switches
      localStorage.setItem(`siteSubmission_${submissionId}`, JSON.stringify(submissionData));
      
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      // Do not block on auth ops before submit; just attempt insert
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
      
      console.log('Creating site with data:', siteData);
      
      const doInsert = () => supabase
        .from('sites')
        .insert([siteData])
        .select()
        .abortSignal(abortControllerRef.current?.signal);
      
      // First attempt
      try {
        const data = await withTimeout(doInsert(), SUBMIT_TIMEOUT_MS);
        if (!data || (Array.isArray(data) && data.length === 0)) {
          console.warn('No data returned from site creation');
          toast.error('No data returned from site creation. Please try again.');
          return false;
        }
        console.log('Site created successfully (first attempt):', data);
        localStorage.removeItem(`siteSubmission_${submissionId}`);
        return true;
      } catch (firstErr: any) {
        const msg = String(firstErr?.message || '');
        const status = (firstErr?.status || firstErr?.code || '').toString();
        const looksAuth = msg.includes('JWT') || msg.includes('token') || status === '401' || msg.includes('401');
        console.warn('First insert attempt failed:', firstErr);
        
        if (looksAuth) {
          // Soft-refresh session and retry once
          await softRefreshSession(AUTH_OP_TIMEOUT_MS);
          const sessionAfter = await softGetSession(AUTH_OP_TIMEOUT_MS);
          if (!sessionAfter) {
            console.warn('Session still not available after soft refresh; proceeding with retry anyway');
          }
          try {
            const data = await withTimeout(doInsert(), SUBMIT_TIMEOUT_MS);
            if (!data || (Array.isArray(data) && data.length === 0)) {
              console.warn('No data returned from site creation (after retry)');
              toast.error('No data returned from site creation. Please try again.');
              return false;
            }
            console.log('Site created successfully (after retry):', data);
            localStorage.removeItem(`siteSubmission_${submissionId}`);
            return true;
          } catch (retryErr: any) {
            console.error('Retry after soft session refresh failed:', retryErr);
            throw retryErr;
          }
        }
        
        throw firstErr;
      }
      
    } catch (error: any) {
      console.error('Exception in performSubmission:', error);
      
      if (error.name === 'AbortError') {
        console.log('Site creation was cancelled');
        return false;
      }
      
      if (error.message === 'Submission timed out') {
        toast.error('Request timed out. Please check your connection and try again.');
        return false;
      }
      
      // Handle specific error types
      if (error.code === '23505') {
        toast.error('A site with this name already exists. Please choose a different name.');
      } else if (error.message?.includes('violates foreign key constraint')) {
        toast.error('Invalid supervisor selected. Please refresh and try again.');
      } else if (String(error?.status || error?.code) === '401' || String(error?.message || '').includes('JWT')) {
        toast.error('Your session looks expired. Please reload the page to re-authenticate.');
      } else {
        toast.error('Failed to create site: ' + (error.message || 'Unknown error'));
      }
      return false;
    }
  }, [user]);

  // SIMPLIFIED AND ROBUST FORM SUBMISSION HANDLER
  // This handles browser tab throttling by using a different approach
  const onFormSubmit = async (values: SiteFormValues) => {
    // Prevent double submission
    if (submissionInProgressRef.current) {
      console.log('Submission already in progress, ignoring duplicate request');
      return;
    }
    
    try {
      console.log('=== FORM SUBMISSION START ===');
      console.log('Tab hidden:', document.hidden);
      console.log('Values:', values);
      
      setIsLoading(true);
      submissionInProgressRef.current = true;
      setSubmissionStartTime(Date.now());
      
      // Store submission data for persistence
      submissionDataRef.current = values;
      
      // Use performSubmission which has background processing capabilities
      const success = await performSubmission(values);
      
      console.log('=== FORM SUBMISSION RESULT ===', success);
      
      if (success) {
        // Create uppercase version of values for parent component
        const uppercaseValues = {
          ...values,
          name: values.name.toUpperCase(),
          jobName: values.jobName.toUpperCase(),
          posNo: values.posNo.toUpperCase(),
          location: values.location.toUpperCase(),
          supervisorId: values.supervisorId || supervisorIdRef.current || ''
        };
        
        console.log('Calling onSubmit with:', uppercaseValues);
        
        // First call onSubmit to notify parent component
        onSubmit(uppercaseValues);
        
        // Show success message
        toast.success('Site created successfully');
        
        // Reset retry count on success
        setRetryCount(0);
        
        // Close the dialog and reset form
        onClose();
        form.reset();
        
        console.log('=== FORM SUBMISSION COMPLETE ===');
      } else {
        console.log('Submission failed, staying in form');
      }
    } catch (error: any) {
      console.error('Exception in site creation:', error);
      
      // Don't show error for aborted requests
      if (error.name !== 'AbortError') {
        toast.error('Error creating site: ' + (error.message || 'Unknown error'));
      }
    } finally {
      // Always reset states
      console.log('Resetting loading state');
      setIsLoading(false);
      submissionInProgressRef.current = false;
      submissionDataRef.current = null;
      setSubmissionStartTime(null);
      
      // Clear abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      
      // Clear any retry timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    }
  };
  
  // Clean up abort controller when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[95vw] max-w-[95vw] sm:w-auto overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Site</DialogTitle>
          <DialogDescription>
            Enter the details for the new construction site.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter site name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="jobName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter job name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="posNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>P.O. Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter P.O. number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter site location" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Select a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setStartDateOpen(false);
                        }}
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
              name="completionDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expected Completion Date <span className="text-muted-foreground text-xs">(Optional)</span></FormLabel>
                  <Popover open={completionDateOpen} onOpenChange={setCompletionDateOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Select a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={(date) => {
                          field.onChange(date);
                          setCompletionDateOpen(false);
                        }}
                        initialFocus
                        fromDate={form.getValues("startDate")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="supervisorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supervisor</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a supervisor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingError ? (
                        <div className="p-2 text-center text-destructive text-sm">
                          {loadingError}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2 w-full" 
                            onClick={(e) => {
                              e.preventDefault();
                              fetchSupervisors();
                            }}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : supervisors.length === 0 ? (
                        <div className="p-2 text-center text-muted-foreground text-sm">
                          No supervisors found
                        </div>
                      ) : (
                        supervisors.map((supervisor) => (
                          <SelectItem 
                            key={supervisor.id} 
                            value={supervisor.id}
                          >
                            {supervisor.name || 'Unknown'}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {retryCount > 0 ? (
                      `Retrying... (${retryCount}/2)`
                    ) : (
                      'Creating...'
                    )}
                  </>
                ) : (
                  'Create Site'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
