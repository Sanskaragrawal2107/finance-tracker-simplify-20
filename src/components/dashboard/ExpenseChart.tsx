
import React from 'react';
import { cn } from '@/lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import CustomCard from '../ui/CustomCard';
import { ChartDataPoint } from '@/lib/types';

interface ExpenseChartProps {
  data: ChartDataPoint[];
  title: string;
  className?: string;
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({ 
  data,
  title,
  className 
}) => {
  return (
    <CustomCard className={cn("", className)}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 10,
              left: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `₹${value}`}
              dx={-10}
            />
            <Tooltip 
              formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
              contentStyle={{
                borderRadius: '0.5rem',
                border: 'none',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Bar 
              dataKey="value" 
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              barSize={30}
              animationDuration={1500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CustomCard>
  );
};

export default ExpenseChart;
