
import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, ActivityType } from '@/lib/types';
import { ClockIcon, ArrowUpRight, ArrowDownRight, Banknote, FileText, Wallet, Receipt } from 'lucide-react';
import { format } from 'date-fns';

interface RecentActivityProps {
  activities: Activity[];
  className?: string;
}

const typeConfig: Record<ActivityType, { icon: React.ElementType; color: string; bg: string; label: string; dot: string }> = {
  [ActivityType.EXPENSE]:  { icon: ArrowUpRight, color: 'text-red-600',     bg: 'bg-red-50',     label: 'Expense',  dot: 'bg-red-500' },
  [ActivityType.ADVANCE]:  { icon: Wallet,       color: 'text-amber-600',   bg: 'bg-amber-50',   label: 'Advance',  dot: 'bg-amber-500' },
  [ActivityType.INVOICE]:  { icon: FileText,     color: 'text-blue-600',    bg: 'bg-blue-50',    label: 'Invoice',  dot: 'bg-blue-500' },
  [ActivityType.FUNDS]:    { icon: ArrowDownRight,color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Funds',    dot: 'bg-emerald-500' },
  [ActivityType.PAYMENT]:  { icon: Banknote,     color: 'text-cyan-600',    bg: 'bg-cyan-50',    label: 'Payment',  dot: 'bg-cyan-500' },
};

const RecentActivity: React.FC<RecentActivityProps> = ({ activities, className }) => {
  return (
    <div className={cn('bg-white rounded-lg border border-border/60 shadow-sm flex flex-col', className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{activities.length} transactions</p>
        </div>
        <div className="p-2 rounded-md bg-muted">
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ClockIcon className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No recent activities</p>
          </div>
        ) : (
          activities.map((activity) => {
            const cfg = typeConfig[activity.type] ?? typeConfig[ActivityType.EXPENSE];
            const Icon = cfg.icon;
            const isInflow = activity.type === ActivityType.FUNDS;
            return (
              <div key={activity.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className={cn('p-2 rounded-md flex-shrink-0', cfg.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(activity.date, 'dd MMM yyyy')} · {activity.user}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn('text-sm font-semibold tabular-nums', isInflow ? 'text-emerald-600' : 'text-foreground')}>
                    {isInflow ? '+' : '-'}₹{activity.amount.toLocaleString('en-IN')}
                  </p>
                  <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activities.length > 0 && (
        <div className="px-5 py-3 border-t border-border/50">
          <button className="w-full text-center text-xs font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-wide">
            View All Transactions →
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
