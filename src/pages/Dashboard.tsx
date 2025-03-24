import React from 'react';
import PageTitle from '@/components/common/PageTitle';
import BalanceCard from '@/components/dashboard/BalanceCard';
import StatCard from '@/components/dashboard/StatCard';
import HODebitsCard from '@/components/dashboard/HODebitsCard';
import ExpenseChart from '@/components/dashboard/ExpenseChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { BarChart3, IndianRupee, FileText, Wallet, Building2, ArrowRight } from 'lucide-react';
import { Activity, ActivityType, BalanceSummary, ChartDataPoint } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const balanceData: BalanceSummary = {
  totalBalance: 1254850,
  fundsReceived: 2500000,
  totalExpenditure: 850000,
  totalAdvances: 395150,
  debitsToWorker: 0,
  invoicesPaid: 0,
  pendingInvoices: 250000,
};

const hoDebitsTotal = 750000;

const expenseChartData: ChartDataPoint[] = [
  { name: 'Jan', value: 45000 },
  { name: 'Feb', value: 52000 },
  { name: 'Mar', value: 48000 },
  { name: 'Apr', value: 61000 },
  { name: 'May', value: 55000 },
  { name: 'Jun', value: 67000 },
  { name: 'Jul', value: 72000 },
];

const categoryChartData: ChartDataPoint[] = [
  { name: 'Material', value: 42 },
  { name: 'Labor', value: 28 },
  { name: 'Transport', value: 15 },
  { name: 'Office', value: 8 },
  { name: 'Misc', value: 7 },
];

const recentActivities: Activity[] = [
  {
    id: '1',
    type: ActivityType.FUNDS,
    description: 'Funds received from Head Office',
    amount: 500000,
    date: new Date('2023-07-05'),
    user: 'Admin',
  },
  {
    id: '2',
    type: ActivityType.EXPENSE,
    description: 'Purchased cement and sand',
    amount: 85000,
    date: new Date('2023-07-04'),
    user: 'Supervisor',
  },
  {
    id: '3',
    type: ActivityType.ADVANCE,
    description: 'Advance to Raj Construction',
    amount: 150000,
    date: new Date('2023-07-03'),
    user: 'Admin',
  },
  {
    id: '4',
    type: ActivityType.INVOICE,
    description: 'Invoice from Steel Suppliers Ltd',
    amount: 245000,
    date: new Date('2023-07-02'),
    user: 'Supervisor',
  },
  {
    id: '5',
    type: ActivityType.PAYMENT,
    description: 'Payment to United Cement',
    amount: 120000,
    date: new Date('2023-07-01'),
    user: 'Admin',
  },
];

const Dashboard: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <PageTitle 
          title="Dashboard" 
          subtitle="Overview of your financial data and recent activities"
          className="mb-0"
        />
        
        <Button 
          onClick={() => navigate('/expenses')}
          className="self-start sm:self-center"
        >
          Go to Sites & Expenses
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <BalanceCard 
          balanceData={balanceData} 
          className="md:col-span-1"
        />
        
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <StatCard 
            title="Total Expenditure" 
            value={balanceData.totalExpenditure} 
            icon={BarChart3}
            valuePrefix="₹"
            trend={{ value: 12, isPositive: false, label: "from last month" }}
          />
          <StatCard 
            title="Total Advances" 
            value={balanceData.totalAdvances || 0} 
            icon={Wallet}
            valuePrefix="₹"
            trend={{ value: 5, isPositive: true, label: "from last month" }}
          />
          <StatCard 
            title="Pending Invoices" 
            value={balanceData.pendingInvoices || 0} 
            icon={FileText}
            valuePrefix="₹"
            trend={{ value: 3, isPositive: false, label: "from last month" }}
          />
          <HODebitsCard 
            totalDebits={hoDebitsTotal}
            trend={{ value: 8, isPositive: false, label: "from last month" }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <ExpenseChart 
          data={expenseChartData} 
          title="Monthly Expenses"
          className="md:col-span-2"
        />
        <RecentActivity 
          activities={recentActivities} 
          className="md:col-span-1"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <ExpenseChart 
          data={categoryChartData} 
          title="Expense Categories (%)"
        />
      </div>
    </div>
  );
};

export default Dashboard;
