
import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import CustomCard from '../ui/CustomCard';

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
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon,
  trend, 
  className,
  valuePrefix = '',
  valueSuffix = '',
}) => {
  return (
    <CustomCard 
      className={cn("transition-all duration-300", className)}
      hoverEffect
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {valuePrefix}{typeof value === 'number' ? value.toLocaleString() : value}{valueSuffix}
          </h3>
          
          {trend && (
            <p className={cn(
              "mt-2 text-sm font-medium flex items-center",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              <span className="inline-block mr-1">
                {trend.isPositive ? '↑' : '↓'}
              </span>
              {trend.value}%
              {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
            </p>
          )}
        </div>
        
        <div className="p-2 rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </CustomCard>
  );
};

export default StatCard;
