
import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  accentColor?: 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';
}

const accentMap = {
  blue:   { border: 'border-l-blue-500',   icon: 'bg-blue-50 text-blue-600',   badge: 'text-blue-600' },
  emerald:{ border: 'border-l-emerald-500', icon: 'bg-emerald-50 text-emerald-600', badge: 'text-emerald-600' },
  amber:  { border: 'border-l-amber-500',  icon: 'bg-amber-50 text-amber-600', badge: 'text-amber-600' },
  red:    { border: 'border-l-red-500',    icon: 'bg-red-50 text-red-600',     badge: 'text-red-600' },
  cyan:   { border: 'border-l-cyan-500',   icon: 'bg-cyan-50 text-cyan-600',   badge: 'text-cyan-600' },
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  className,
  valuePrefix = '',
  valueSuffix = '',
  accentColor = 'blue',
}) => {
  const accent = accentMap[accentColor];

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-border/60 shadow-sm p-5 border-l-4 transition-shadow hover:shadow-md flex flex-col gap-3',
        accent.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className={cn('p-2 rounded-md', accent.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {valuePrefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}{valueSuffix}
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
          {trend.label && <span className="text-muted-foreground font-normal">{trend.label}</span>}
        </div>
      )}
    </div>
  );
};

export default StatCard;
