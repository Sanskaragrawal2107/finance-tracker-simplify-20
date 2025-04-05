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
import { useConnection, pingSupabase } from '@/hooks/use-connection';

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

// Updated supervisor interface to match the actual database columns
interface Supervisor {
  id: string;
  // Using optional fields since column names might vary
  username?: string;
  full_name?: string;
  name?: string; // Fallback if full_name doesn't exist
}

export default function SiteForm({ isOpen, onClose, onSubmit, supervisorId }: SiteFormProps) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [completionDateOpen, setCompletionDateOpen] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const { user } = useAuth();
  const { withConnectionCheck } = useConnection();
  const lastHiddenTimeRef = useRef<number | null>(null);

  // Default form values
  const defaultValues: Partial<SiteFormValues> = {
    startDate: new Date(),
    completionDate: null,
    supervisorId: supervisorId || '',
  };
  
  // Handle visibility changes
  useEffect(() => {
    // Use a proper ref for the submission state to avoid closure issues
    const isSubmittingRef = useRef(false);
    
    // Use a safer approach than direct DOM access for event handlers
    const handleVisibilityChange = () => {
      // Skip visibility handling during form submission
      if (isLoading || isSubmittingRef.current) {
        console.log('Ignoring visibility change during form submission or loading');
        return;
      }
      
      if (document.visibilityState === 'hidden') {
        lastHiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === 'visible' && lastHiddenTimeRef.current) {
        const hiddenDuration = Date.now() - lastHiddenTimeRef.current;
        
        // Longer duration to avoid any unnecessary refreshes (5 minutes)
        if (hiddenDuration > 300000) {
          console.log('Tab was hidden for more than 5 minutes, refreshing supervisors');
          refreshSupervisors();
        }
        
        lastHiddenTimeRef.current = null;
      }
    };
    
    // Track form submission state through the isLoading state
    useEffect(() => {
      isSubmittingRef.current = isLoading;
    }, [isLoading]);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading]);
  
  // Define form
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues,
  });
  
  // Fetch supervisors with connection check
  const fetchSupervisors = async () => {
    setLoadingError(null);
    
    try {
      // Query for name which is the actual column in the database
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor')
        .order('name');
      
      if (error) {
        console.error('Error fetching supervisors:', error);
        setLoadingError('Failed to load supervisors. Please try again.');
        toast.error('Failed to load supervisors');
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception fetching supervisors:', error);
      setLoadingError('Connection error. Please refresh the page.');
      toast.error('Connection error loading supervisors');
      
      // Try to ping Supabase
      const connected = await pingSupabase();
      if (!connected) {
        toast.error('Connection to the server lost. Please refresh the page.');
      }
      
      return [];
    }
  };
  
  // Function to refresh supervisors
  const refreshSupervisors = async () => {
    const supervisorData = await withConnectionCheck(fetchSupervisors, {
      onConnectionError: () => {
        toast.error('Connection failed. Please refresh the page.');
      },
      maxRetries: 2
    });
    
    if (supervisorData && supervisorData.length > 0) {
      setSupervisors(supervisorData);
      setLoadingError(null);
    }
  };
  
  // Load supervisors on mount
  useEffect(() => {
    refreshSupervisors();
  }, []);
  
  // Handle form submission with connection check - fixed type issues
  const onFormSubmit = async (values: SiteFormValues) => {
    setIsLoading(true);
    
    try {
      // Convert all string values to uppercase for consistency
      const uppercaseValues = {
        ...values,
        name: values.name.toUpperCase(),
        jobName: values.jobName.toUpperCase(),
        posNo: values.posNo.toUpperCase(),
        location: values.location.toUpperCase(),
      };
      
      // Use withConnectionCheck to handle potential connection issues
      await withConnectionCheck(async () => {
        let siteData = null;
        let lastError: any = null;
        let retryCount = 0;
        
        // Implementation with retry logic
        while (retryCount < 3) {
          try {
            console.log(`Attempting to create site (attempt ${retryCount + 1})`);
            
            // Create abort controller with a reasonable timeout (12 seconds)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log('Site creation request timed out, aborting');
              controller.abort();
            }, 12000);
            
            try {
              const { data, error } = await supabase
                .from('sites')
                .insert([{
                  name: uppercaseValues.name,
                  job_name: uppercaseValues.jobName,
                  pos_no: uppercaseValues.posNo,
                  location: uppercaseValues.location,
                  start_date: uppercaseValues.startDate.toISOString(),
                  completion_date: uppercaseValues.completionDate ? uppercaseValues.completionDate.toISOString() : null,
                  supervisor_id: uppercaseValues.supervisorId,
                  created_by: user?.id || null,
                  is_completed: false,
                  funds: 0,
                  total_funds: 0
                }])
                .select()
                .abortSignal(controller.signal);
              
              // Clear the timeout since the request completed
              clearTimeout(timeoutId);
              
              if (error) {
                console.error(`Error creating site (attempt ${retryCount + 1}):`, error);
                lastError = error;
                retryCount++;
                
                // Provide more user-friendly error messages for specific error cases
                if (error.code === '23505') {
                  if (error.message.includes('name')) {
                    toast.error(`A site with the name "${uppercaseValues.name}" already exists`);
                  } else if (error.message.includes('pos_no')) {
                    toast.error(`A site with the P.O. number "${uppercaseValues.posNo}" already exists`);
                  } else {
                    toast.error('A site with these details already exists');
                  }
                  // Don't retry uniqueness constraint violations
                  break;
                }
                
                // Simple connection check without additional timeouts
                const connected = await pingSupabase();
                if (!connected) {
                  toast.error('Connection issues detected. Please try again.');
                  break;
                }
                
                // Add delay before retry
                if (retryCount < 3) {
                  toast.info(`Retrying... (${retryCount}/3)`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              } else {
                siteData = data;
                break;
              }
            } catch (innerError: any) {
              clearTimeout(timeoutId);
              throw innerError; // Rethrow to be caught by the outer catch
            }
          } catch (error: any) {
            console.error(`Exception creating site (attempt ${retryCount + 1}):`, error);
            
            // Handle AbortError specially
            if (error.name === 'AbortError') {
              toast.error('Request timed out. Please check your network and try again.');
              lastError = new Error('Request timed out');
              break;
            }
            
            lastError = error;
            retryCount++;
            
            // Simple connection check
            const connected = await pingSupabase();
            if (!connected) {
              toast.error('Connection issues detected. Please try again.');
              break;
            }
            
            if (retryCount < 3) {
              toast.info(`Retrying... (${retryCount}/3)`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        }
        
        if (!siteData) {
          throw lastError || new Error('Failed to create site');
        }
        
        console.log('Site created successfully:', siteData);
        
        // Close the form first for better UX
        onClose();
        form.reset();
        
        // Then trigger onSubmit callback
        onSubmit(uppercaseValues);
        
        toast.success('Site created successfully');
      }, {
        onConnectionError: () => {
          toast.error('Connection failed. Please check your network and try again.');
        },
        maxRetries: 1
      });
    } catch (error: any) {
      // Handle any uncaught errors
      console.error('Unhandled error in site creation:', error);
      toast.error(error.message || 'Failed to create site. Please try again.');
    } finally {
      // Always ensure loading state is reset
      setIsLoading(false);
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
                              refreshSupervisors();
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
                            {supervisor.full_name || supervisor.name || supervisor.username || 'Unknown'}
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
