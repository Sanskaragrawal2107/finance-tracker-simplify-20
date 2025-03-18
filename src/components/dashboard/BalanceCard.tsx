
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface BalanceCardProps {
  name: string;
  value: number;
  icon: React.ReactNode;
  description: string;
  trend: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
}

const BalanceCard: React.FC<BalanceCardProps> = ({
  name,
  value,
  icon,
  description,
  trend
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(value)}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="flex items-center mt-4">
            <div className={`mr-2 p-1 rounded-full ${
              trend.direction === 'up' 
                ? 'bg-green-50 text-green-600' 
                : trend.direction === 'down' 
                  ? 'bg-red-50 text-red-600' 
                  : 'bg-gray-50 text-gray-600'
            }`}>
              {trend.direction === 'up' ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : trend.direction === 'down' ? (
                <ArrowDownRight className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </div>
            <div className="text-sm">
              <span className="font-medium">{trend.value}</span> {trend.label}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BalanceCard;
