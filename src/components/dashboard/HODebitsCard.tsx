
import React from 'react';
import { IndianRupee, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HODebitsCardProps {
  totalDebits: number;
  className?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
}

const HODebitsCard: React.FC<HODebitsCardProps> = ({ totalDebits, className, trend }) => {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-border/60 shadow-sm p-5 border-l-4 border-l-cyan-500 transition-shadow hover:shadow-md flex flex-col gap-3',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Funds from H.O.</p>
        <div className="p-2 rounded-md bg-cyan-50 text-cyan-600">
          <Building2 className="h-4 w-4" />
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          ₹{Number(totalDebits).toLocaleString('en-IN')}
        </p>
      </div>

      {trend && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          trend.isPositive ? 'text-emerald-600' : 'text-red-500'
        )}>
          {trend.isPositive
            ? <TrendingUp className="h-3.5 w-3.5" />
            : <TrendingDown className="h-3.5 w-3.5" />}
          <span>{trend.value}%</span>
          <span className="text-muted-foreground font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

export default HODebitsCard;
