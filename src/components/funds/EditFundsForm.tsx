import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../integrations/supabase/client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import PageTitle from '../common/PageTitle';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../lib/utils';
import SearchableDropdown from '../expenses/SearchableDropdown';

const EditFundsForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const returnPath = location.state?.returnPath || '/head-office';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fundsReceived, setFundsReceived] = useState<any>({
    amount: '',
    method: '',
    reference: '',
    date: new Date(),
    site_id: '',
  });
  const [sites, setSites] = useState<any[]>([]);
  const [date, setDate] = useState<Date>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    fetchSites();
    if (id) {
      fetchFundsReceived();
    }
  }, [id]);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSites(data || []);
    } catch (error: any) {
      console.error('Error fetching sites:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load sites',
        variant: 'destructive',
      });
    }
  };

  const fetchFundsReceived = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('funds_received')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (data) {
        setFundsReceived(data);
        if (data.date) {
          setDate(new Date(data.date));
        }
      }
    } catch (error: any) {
      console.error('Error fetching funds received:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load funds received',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFundsReceived((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSiteChange = (siteId: string) => {
    setFundsReceived((prev: any) => ({ ...prev, site_id: siteId }));
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
      setFundsReceived((prev: any) => ({ ...prev, date: selectedDate }));
      setIsCalendarOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Form validation
      if (!fundsReceived.amount || !fundsReceived.site_id) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }
      
      const { error } = await supabase
        .from('funds_received')
        .update({
          amount: parseFloat(fundsReceived.amount),
          method: fundsReceived.method,
          reference: fundsReceived.reference,
          date: fundsReceived.date,
          site_id: fundsReceived.site_id,
        })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Funds received entry updated successfully',
      });
      
      navigate(returnPath);
    } catch (error: any) {
      console.error('Error updating funds received:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update funds received',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this funds received entry?')) {
      return;
    }
    
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('funds_received')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Funds received entry deleted successfully',
      });
      
      navigate(returnPath);
    } catch (error: any) {
      console.error('Error deleting funds received:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete funds received',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoBack = () => {
    navigate(returnPath);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <div className="flex items-center mb-6 space-x-4">
            <Button 
              variant="ghost" 
              onClick={handleGoBack}
              className="p-2 hover:bg-gray-100 transition-colors rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <PageTitle title="Edit Funds Received" />
          </div>
          
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="site_id">Site (Required)</Label>
                  <SearchableDropdown
                    options={sites.map(site => ({
                      value: site.id,
                      label: site.name
                    }))}
                    value={fundsReceived.site_id}
                    onChange={handleSiteChange}
                    placeholder="Select a site"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="date">Date</Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        {date ? format(date, "PPP") : "Select a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="amount">Amount (Required)</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    value={fundsReceived.amount}
                    onChange={handleChange}
                    placeholder="Enter amount"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="method">Payment Method</Label>
                  <Input
                    id="method"
                    name="method"
                    value={fundsReceived.method || ''}
                    onChange={handleChange}
                    placeholder="Enter payment method"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="reference">Reference</Label>
                  <Input
                    id="reference"
                    name="reference"
                    value={fundsReceived.reference || ''}
                    onChange={handleChange}
                    placeholder="Enter reference"
                  />
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDelete}
                    disabled={submitting}
                    className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {submitting ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditFundsForm;
