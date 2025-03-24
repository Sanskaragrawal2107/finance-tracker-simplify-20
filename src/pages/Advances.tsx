
import React, { useState, useEffect } from 'react';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Search, Filter, Plus, FileText, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Advance, AdvancePurpose, ApprovalStatus, RecipientType } from '@/lib/types';

const getPurposeColor = (purpose: AdvancePurpose) => {
  switch (purpose) {
    case AdvancePurpose.ADVANCE:
      return 'bg-blue-100 text-blue-800';
    case AdvancePurpose.TOOLS:
      return 'bg-green-100 text-green-800';
    case AdvancePurpose.OTHER:
      return 'bg-orange-100 text-orange-800';
    case AdvancePurpose.SAFETY_SHOES:
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: ApprovalStatus) => {
  switch (status) {
    case ApprovalStatus.APPROVED:
      return 'bg-green-100 text-green-800';
    case ApprovalStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800';
    case ApprovalStatus.REJECTED:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getRecipientTypeColor = (type: RecipientType) => {
  switch (type) {
    case RecipientType.SUBCONTRACTOR:
      return 'bg-purple-100 text-purple-800';
    case RecipientType.WORKER:
      return 'bg-indigo-100 text-indigo-800';
    case RecipientType.SUPERVISOR:
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const Advances: React.FC = () => {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdvances();
  }, []);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('advances')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        // Transform the data to match our Advance interface
        const transformedAdvances: Advance[] = data.map((item) => ({
          id: item.id,
          date: new Date(item.date),
          recipientName: item.recipient_name,
          recipientType: item.recipient_type as RecipientType,
          purpose: item.purpose as AdvancePurpose,
          amount: item.amount,
          remarks: item.remarks || undefined,
          status: item.status as ApprovalStatus,
          createdBy: item.created_by || '',
          createdAt: new Date(item.created_at),
          siteId: item.site_id,
        }));

        setAdvances(transformedAdvances);
      }
    } catch (error) {
      console.error('Error fetching advances:', error);
      toast.error('Failed to fetch advances');
    } finally {
      setLoading(false);
    }
  };

  const filteredAdvances = advances.filter((advance) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      advance.recipientName.toLowerCase().includes(query) ||
      advance.purpose.toLowerCase().includes(query) ||
      advance.recipientType.toLowerCase().includes(query) ||
      advance.amount.toString().includes(query)
    );
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <PageTitle 
        title="Advances" 
        subtitle="Manage advances given to contractors and workers"
      />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search advances..." 
            className="py-2 pl-10 pr-4 border rounded-md w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            Filter
          </button>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
            <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
            Import
          </button>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4 mr-2 text-muted-foreground" />
            Export
          </button>
          <button className="inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4 mr-2" />
            New Advance
          </button>
        </div>
      </div>
      
      <CustomCard>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 pl-4 font-medium text-muted-foreground">Date</th>
                <th className="pb-3 font-medium text-muted-foreground">Recipient</th>
                <th className="pb-3 font-medium text-muted-foreground">Type</th>
                <th className="pb-3 font-medium text-muted-foreground">Purpose</th>
                <th className="pb-3 font-medium text-muted-foreground">Amount</th>
                <th className="pb-3 font-medium text-muted-foreground">Status</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading advances...
                  </td>
                </tr>
              ) : filteredAdvances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No advances found
                  </td>
                </tr>
              ) : (
                filteredAdvances.map((advance) => (
                  <tr key={advance.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-4 pl-4 text-sm">{format(advance.date, 'MMM dd, yyyy')}</td>
                    <td className="py-4 text-sm">{advance.recipientName}</td>
                    <td className="py-4 text-sm">
                      <span className={`${getRecipientTypeColor(advance.recipientType)} px-2 py-1 rounded-full text-xs font-medium`}>
                        {advance.recipientType}
                      </span>
                    </td>
                    <td className="py-4 text-sm">
                      <span className={`${getPurposeColor(advance.purpose)} px-2 py-1 rounded-full text-xs font-medium`}>
                        {advance.purpose}
                      </span>
                    </td>
                    <td className="py-4 text-sm font-medium">₹{advance.amount.toLocaleString()}</td>
                    <td className="py-4 text-sm">
                      <span className={`${getStatusColor(advance.status)} px-2 py-1 rounded-full text-xs font-medium`}>
                        {advance.status}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <button className="p-1 rounded-md hover:bg-muted transition-colors">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-between mt-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredAdvances.length} of {advances.length} entries
          </p>
          <div className="flex items-center space-x-2">
            <button className="p-1 rounded-md hover:bg-muted transition-colors" disabled>
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <button className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm">1</button>
            <button className="p-1 rounded-md hover:bg-muted transition-colors" disabled>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CustomCard>
    </div>
  );
};

export default Advances;
