import React from 'react';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Search, Filter, Plus, FileText, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Advance, AdvancePurpose, ApprovalStatus, RecipientType } from '@/lib/types';

// Mock data for demonstration
const advances: Advance[] = [
  {
    id: '1',
    date: new Date('2023-07-05'),
    recipientId: '101',
    recipientName: 'Raj Construction',
    recipientType: RecipientType.SUBCONTRACTOR,
    purpose: AdvancePurpose.ADVANCE,
    amount: 150000,
    status: ApprovalStatus.APPROVED,
    createdBy: 'Admin',
    createdAt: new Date('2023-07-05'),
  },
  {
    id: '2',
    date: new Date('2023-07-04'),
    recipientId: '102',
    recipientName: 'Suresh Electrical',
    recipientType: RecipientType.SUBCONTRACTOR,
    purpose: AdvancePurpose.ADVANCE,
    amount: 75000,
    status: ApprovalStatus.APPROVED,
    createdBy: 'Supervisor',
    createdAt: new Date('2023-07-04'),
  },
  {
    id: '3',
    date: new Date('2023-07-03'),
    recipientId: '201',
    recipientName: 'Labor Group A',
    recipientType: RecipientType.WORKER,
    purpose: AdvancePurpose.TOOLS,
    amount: 45000,
    status: ApprovalStatus.APPROVED,
    createdBy: 'Admin',
    createdAt: new Date('2023-07-03'),
  },
  {
    id: '4',
    date: new Date('2023-07-02'),
    recipientId: '103',
    recipientName: 'Premium Transport',
    recipientType: RecipientType.SUBCONTRACTOR,
    purpose: AdvancePurpose.OTHER,
    amount: 35000,
    status: ApprovalStatus.PENDING,
    createdBy: 'Supervisor',
    createdAt: new Date('2023-07-02'),
  },
  {
    id: '5',
    date: new Date('2023-07-01'),
    recipientId: '202',
    recipientName: 'Labor Group B',
    recipientType: RecipientType.WORKER,
    purpose: AdvancePurpose.TOOLS,
    amount: 30000,
    status: ApprovalStatus.PENDING,
    createdBy: 'Supervisor',
    createdAt: new Date('2023-07-01'),
  },
];

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
                <th className="pb-3 font-medium text-muted-foreground">Created By</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((advance) => (
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
                  <td className="py-4 text-sm">{advance.createdBy}</td>
                  <td className="py-4 pr-4 text-right">
                    <button className="p-1 rounded-md hover:bg-muted transition-colors">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-between mt-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">Showing 1-5 of 5 entries</p>
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
