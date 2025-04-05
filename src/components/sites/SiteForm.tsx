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
  // Add a ref to track form submission status
  const isSubmittingRef = useRef(false);
  
  // Update the ref whenever the prop changes
  useEffect(() => {
    supervisorIdRef.current = supervisorId;
  }, [supervisorId]);
  
  // Single combined visibility change handler to avoid multiple listeners
  useEffect(() => {
    // Minimum time (in ms) tab needs to be hidden before we consider it a "real" tab switch
    // This prevents copy-paste operations from triggering the visibility change handler
    const MIN_HIDDEN_TIME = 1000; // 1 second threshold
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Check how long the tab was hidden
        const currentTime = Date.now();
        const inactiveTime = currentTime - lastActiveTimestampRef.current;
        
        // Remove the loading state reset to allow form submission to continue
        // Only consider it a real tab switch if it was hidden for longer than the threshold
        // AND the form is not currently submitting
        if (inactiveTime > MIN_HIDDEN_TIME && !isSubmittingRef.current) {
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
  }, []);
  
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
  
  // Update form when supervisorId prop changes
  useEffect(() => {
    if (supervisorId) {
      console.log('Updating form with supervisorId:', supervisorId);
      form.setValue('supervisorId', supervisorId);
    }
  }, [supervisorId, form]);
  
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
  
  // Improved form submission with better timeout handling
  const onFormSubmit = async (values: SiteFormValues) => {
    // Set our submission tracking ref to true
    isSubmittingRef.current = true;
    
    try {
      setIsLoading(true);
      console.log('Form submission started with values:', values);
      
      // Get supervisor ID from form or ref
      const currentSupervisorId = values.supervisorId || supervisorIdRef.current || '';
      console.log('Using supervisorId:', currentSupervisorId);
      
      // Ensure the Supabase connection is active before submitting
      try {
        // Quick connection check
        await supabase.from('users').select('count').limit(1);
      } catch (connectionError) {
        console.error('Connection error before form submission:', connectionError);
        // Try to refresh the connection
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // First check if session is valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error or no session:', sessionError);
        toast.error('Your session has expired. Please refresh the page and try again.');
        return;
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
        created_by: user?.id || null,
        is_completed: false,
        funds: 0,
        total_funds: 0
      };
      
      console.log('Submitting site data to Supabase:', siteData);
      
      // Use a more robust approach with timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      
      try {
        // Insert the site with abort signal for timeout handling
        const { data, error } = await supabase
          .from('sites')
          .insert([siteData])
          .select()
          .abortSignal(controller.signal);
          
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('Error creating site:', error);
          
          if (error.code === '23505') { // Unique constraint violation
            if (error.message?.includes('name')) {
              toast.error(`A site with the name "${values.name.toUpperCase()}" already exists`);
            } else if (error.message?.includes('pos_no')) {
              toast.error(`A site with the P.O. number "${values.posNo.toUpperCase()}" already exists`);
            } else {
              toast.error('A site with these details already exists');
            }
          } else {
            toast.error('Failed to create site: ' + error.message);
          }
          
          return;
        }
        
        if (!data || data.length === 0) {
          console.warn('No data returned from site creation');
          toast.error('No data returned from site creation. Please try again.');
          return;
        }
        
        console.log('Site created successfully:', data);
        
        // Create uppercase version of values for parent component
        const uppercaseValues = {
          ...values,
          name: values.name.toUpperCase(),
          jobName: values.jobName.toUpperCase(),
          posNo: values.posNo.toUpperCase(),
          location: values.location.toUpperCase(),
          supervisorId: currentSupervisorId
        };
        
        // First call onSubmit to notify parent component 
        onSubmit(uppercaseValues);
        
        // Show success message
        toast.success('Site created successfully');
        
        // Close the dialog and reset form
        onClose();
      } catch (abortError) {
        clearTimeout(timeoutId);
        if (abortError.name === 'AbortError') {
          console.error('Site creation request timed out');
          toast.error('Request timed out. Please try again.');
        } else {
          throw abortError; // Re-throw for the outer catch
        }
      }
    } catch (error: any) {
      console.error('Exception in site creation:', error);
      
      // Show appropriate error message
      if (error.message?.includes('timeout') || error.message?.includes('network')) {
        toast.error('Network error or timeout. Please check your connection and try again.');
      } else {
        toast.error('Error creating site: ' + (error.message || 'Unknown error'));
      }
    } finally {
      // Always reset loading state and submission tracking
      setIsLoading(false);
      isSubmittingRef.current = false;
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
