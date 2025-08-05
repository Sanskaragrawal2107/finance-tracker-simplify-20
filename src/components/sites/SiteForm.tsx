import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
// Removed useLoadingState import as we're using regular useState for better control

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

export default function SiteForm({ isOpen, onClose, onSubmit, supervisorId }: SiteFormProps) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Use regular state instead of useLoadingState to avoid interference
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [completionDateOpen, setCompletionDateOpen] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { user } = useAuth();
  
  // Add a ref to capture the supervisorId to preserve it during tab switching
  const supervisorIdRef = useRef<string | undefined>(supervisorId);
  // Track if submission is in progress
  const submissionInProgressRef = useRef(false);
  // Store abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Update the ref whenever the prop changes
  useEffect(() => {
    supervisorIdRef.current = supervisorId;
  }, [supervisorId]);
  
  // The useLoadingState hook now handles timeout logic automatically
  // No need for manual timeout management
  
  // Default form values - ensure all fields have defined values to prevent controlled/uncontrolled warnings
  const defaultValues: SiteFormValues = {
    name: '',
    jobName: '',
    posNo: '',
    location: '',
    startDate: new Date(),
    completionDate: null,
    supervisorId: supervisorId || '',
  };
  
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
  }, [isOpen, form, defaultValues]);
  
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
    fetchSupervisors();
  }, []);
  
  // Robust form submission that bypasses auth system interference
  const submitSiteData = async (values: SiteFormValues): Promise<boolean> => {
    const currentSupervisorId = values.supervisorId || supervisorIdRef.current || '';
    
    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      // Get the current session token directly - bypass auth system
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No valid session found');
        toast.error('Authentication required. Please log in again.');
        return false;
      }
      
      // Prepare site data
      const siteData = {
        name: values.name.toUpperCase(),
        job_name: values.jobName.toUpperCase(),
        pos_no: values.posNo.toUpperCase(),
        location: values.location.toUpperCase(),
        start_date: values.startDate.toISOString(),
        completion_date: values.completionDate ? values.completionDate.toISOString() : null,
        supervisor_id: currentSupervisorId,
        created_by: session.user.id, // Use session user ID directly
        is_completed: false,
        funds: 0,
        total_funds: 0
      };
      
      console.log('Submitting site data to Supabase:', siteData);
      
      // Create a new supabase client instance with the current session
      // This bypasses any auth state management interference
      const { data, error } = await supabase
        .from('sites')
        .insert([siteData])
        .select()
        .abortSignal(abortControllerRef.current.signal);
      
      if (error) {
        console.error('Error creating site:', error);
        
        // Handle abort signal
        if (error.name === 'AbortError') {
          console.log('Site creation was cancelled');
          return false;
        }
        
        // Handle specific error types
        if (error.code === '23505') { // Unique constraint violation
          if (error.message?.includes('name')) {
            toast.error(`A site with the name "${values.name.toUpperCase()}" already exists`);
          } else if (error.message?.includes('pos_no')) {
            toast.error(`A site with the P.O. number "${values.posNo.toUpperCase()}" already exists`);
          } else {
            toast.error('A site with these details already exists');
          }
          return false;
        }
        
        toast.error('Failed to create site: ' + error.message);
        return false;
      }
      
      if (!data || data.length === 0) {
        console.warn('No data returned from site creation');
        toast.error('No data returned from site creation. Please try again.');
        return false;
      }
      
      console.log('Site created successfully:', data);
      return true;
      
    } catch (error: any) {
      console.error('Exception in submitSiteData:', error);
      
      if (error.name === 'AbortError') {
        console.log('Site creation was cancelled');
        return false;
      }
      
      toast.error('Failed to create site: ' + (error.message || 'Unknown error'));
      return false;
    }
  };

  // Main form submission handler - with proper tab switching support
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
      
      // Create a promise that resolves regardless of tab visibility
      const submissionPromise = new Promise<boolean>(async (resolve) => {
        try {
          const success = await submitSiteData(values);
          console.log('Submission result:', success);
          resolve(success);
        } catch (error) {
          console.error('Submission error:', error);
          resolve(false);
        }
      });
      
      // Wait for submission to complete
      const success = await submissionPromise;
      
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
      
      // Clear abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
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
