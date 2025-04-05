import React, { useState, useEffect, useRef } from 'react';
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
import { CalendarIcon } from 'lucide-react';
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

export default function SiteForm({ isOpen, onClose, onSubmit, supervisorId }: SiteFormProps) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [completionDateOpen, setCompletionDateOpen] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Add a ref to capture the supervisorId to preserve it during tab switching
  const supervisorIdRef = useRef<string | undefined>(supervisorId);
  // Create lastActiveTimestamp ref at component level, not inside useEffect
  const lastActiveTimestampRef = useRef(Date.now());
  
  // Update the ref whenever the prop changes
  useEffect(() => {
    supervisorIdRef.current = supervisorId;
  }, [supervisorId]);
  
  // Single combined visibility change handler to avoid multiple listeners
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Check how long the tab was hidden
        const currentTime = Date.now();
        const inactiveTime = currentTime - lastActiveTimestampRef.current;
        
        // Reset loading state if a form submission was in progress
        if (isLoading) {
          console.log('Tab visible again while form was loading, resetting state');
          setIsLoading(false);
          toast.error('Form submission interrupted by tab switch. Please try again.');
        }
        
        // Check if we need to refresh the session (only if tab was hidden for >5 minutes)
        if (inactiveTime > 300000) { // 5 minutes
          console.log('Tab was hidden for over 5 minutes, checking session...');
          try {
            // Try to refresh the session
            const { data, error } = await supabase.auth.refreshSession();
            
            if (error || !data?.session) {
              console.warn('Session expired during inactivity:', error);
              toast.error('Your session expired during inactivity. Please refresh the page to continue.');
            } else {
              console.log('Session refreshed successfully after inactivity');
            }
          } catch (err) {
            console.error('Error refreshing session after inactivity:', err);
          }
        }
        
        lastActiveTimestampRef.current = currentTime;
      } else if (document.visibilityState === 'hidden') {
        lastActiveTimestampRef.current = Date.now();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading]);
  
  // Default form values
  const defaultValues: Partial<SiteFormValues> = {
    startDate: new Date(),
    completionDate: null,
    supervisorId: supervisorId || '',
  };
  
  // Define form
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues,
  });
  
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
  
  // Improved form submission with timeout handling and session verification
  const onFormSubmit = async (values: SiteFormValues) => {
    // Reset any previous errors
    setIsLoading(true);
    
    // Ensure we have the current supervisorId value
    const currentSupervisorId = values.supervisorId || supervisorIdRef.current || '';
    
    console.log('Creating site with supervisorId:', currentSupervisorId);
    
    // Create an AbortController to handle request timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Site creation request timed out after 15 seconds');
      abortController.abort();
    }, 15000); // 15 second timeout
    
    try {
      // Check if session is still valid before submitting
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error('Your session has expired. Please refresh the page to log in again.');
        console.error('Session error:', sessionError);
        return;
      }
      
      // Convert values to uppercase
      const uppercaseValues = {
        ...values,
        name: values.name.toUpperCase(),
        jobName: values.jobName.toUpperCase(),
        posNo: values.posNo.toUpperCase(),
        location: values.location.toUpperCase(),
        supervisorId: currentSupervisorId
      };
      
      // Use the AbortController signal with the request
      // Check if abortSignal is supported, otherwise fall back to regular request
      let response;
      try {
        // First try with abort signal
        response = await supabase
          .from('sites')
          .insert([{
            name: uppercaseValues.name,
            job_name: uppercaseValues.jobName,
            pos_no: uppercaseValues.posNo,
            location: uppercaseValues.location,
            start_date: uppercaseValues.startDate.toISOString(),
            completion_date: uppercaseValues.completionDate ? uppercaseValues.completionDate.toISOString() : null,
            supervisor_id: currentSupervisorId,
            created_by: user?.id || null,
            is_completed: false,
            funds: 0,
            total_funds: 0
          }])
          .select()
          .abortSignal(abortController.signal);
      } catch (signalError) {
        console.warn('AbortSignal not supported, falling back to standard request', signalError);
        // Fall back to standard request without abort signal
        response = await supabase
          .from('sites')
          .insert([{
            name: uppercaseValues.name,
            job_name: uppercaseValues.jobName,
            pos_no: uppercaseValues.posNo,
            location: uppercaseValues.location,
            start_date: uppercaseValues.startDate.toISOString(),
            completion_date: uppercaseValues.completionDate ? uppercaseValues.completionDate.toISOString() : null,
            supervisor_id: currentSupervisorId,
            created_by: user?.id || null,
            is_completed: false,
            funds: 0,
            total_funds: 0
          }])
          .select();
      }
      
      const { data, error } = response;
      
      // Handle errors
      if (error) {
        console.error('Error creating site:', error);
        
        // Handle auth errors specifically
        if (error.code === 'PGRST301' || error.code === '401' || error.message?.includes('JWT')) {
          toast.error('Your session has expired. Please refresh the page to log in again.');
        }
        // Handle constraint violations
        else if (error.code === '23505') {
          if (error.message?.includes('name')) {
            toast.error(`A site with the name "${uppercaseValues.name}" already exists`);
          } else if (error.message?.includes('pos_no')) {
            toast.error(`A site with the P.O. number "${uppercaseValues.posNo}" already exists`);
          } else {
            toast.error('A site with these details already exists');
          }
        } else {
          // Generic error
          toast.error('Failed to create site: ' + error.message);
        }
        
        return;
      }
      
      // Success - close form and notify user
      if (data) {
        console.log('Site created successfully:', data);
        
        // Close form and reset
        onClose();
        form.reset();
        
        // Callback
        onSubmit(uppercaseValues);
        
        toast.success('Site created successfully');
      }
    } catch (error: any) {
      console.error('Exception in site creation:', error);
      
      // Handle AbortError from timeout
      if (error.name === 'AbortError') {
        toast.error('Site creation timed out. Please check your connection and try again.');
      } 
      // Handle other fetch errors
      else if (error.message?.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } 
      // Handle session errors
      else if (error.message?.includes('auth') || error.message?.includes('session')) {
        toast.error('Your session has expired. Please refresh the page to log in again.');
      } 
      // Generic error
      else {
        toast.error('Failed to create site: ' + (error.message || 'Unknown error'));
      }
    } finally {
      // Always turn off loading state and clean up
      setIsLoading(false);
      clearTimeout(timeoutId);
    }
  };

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
              >
                {isLoading ? "Creating..." : "Create Site"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
