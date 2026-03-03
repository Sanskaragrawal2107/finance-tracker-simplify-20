
import React from 'react';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ChartDataPoint } from '@/lib/types';

interface ExpenseChartProps {
  data: ChartDataPoint[];
  title: string;
  className?: string;
  type?: 'bar' | 'area' | 'pie';
}

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#0891b2', '#64748b', '#6366f1'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border shadow-lg rounded-lg px-3 py-2">
        <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.value > 1000
              ? `₹${Number(p.value).toLocaleString('en-IN')}`
              : `${p.value}${typeof p.value === 'number' && p.value <= 100 ? '%' : ''}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ExpenseChart: React.FC<ExpenseChartProps> = ({ data, title, className, type = 'bar' }) => {
  const isPie = type === 'pie';

  return (
    <div className={cn('bg-white rounded-lg border border-border/60 shadow-sm p-5', className)}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chart</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{title}</p>
        </div>
        <div className="flex gap-1">
          {CHART_COLORS.slice(0, Math.min(data.length, 3)).map((c, i) => (
            <div key={i} className="h-2 w-6 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {isPie ? (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            </PieChart>
          ) : type === 'area' ? (
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} dx={-4} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#expenseGradient)"
                dot={{ fill: '#2563eb', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#2563eb' }}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} dx={-4} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28}>
                {data.map((_, index) => (
                  <Cell key={`bar-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ExpenseChart;
