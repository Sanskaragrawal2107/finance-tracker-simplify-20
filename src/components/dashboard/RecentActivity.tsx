
import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, ActivityType } from '@/lib/types';
import CustomCard from '../ui/CustomCard';
import { ClockIcon, IndianRupee, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';

interface RecentActivityProps {
  activities: Activity[];
  className?: string;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ 
  activities,
  className 
}) => {
  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case ActivityType.EXPENSE:
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case ActivityType.ADVANCE:
        return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      case ActivityType.INVOICE:
        return <ArrowUpRight className="h-4 w-4 text-purple-500" />;
      case ActivityType.FUNDS:
        return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case ActivityType.PAYMENT:
        return <ArrowUpRight className="h-4 w-4 text-blue-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <CustomCard className={cn("", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <ClockIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No recent activities</p>
        ) : (
          activities.map((activity) => (
            <div 
              key={activity.id}
              className="flex items-center justify-between py-2 border-b last:border-b-0"
            >
              <div className="flex items-center">
                <div className="p-2 bg-muted rounded-full mr-3">
                  {getActivityIcon(activity.type)}
                </div>
                <div>
                  <p className="text-sm font-medium">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(activity.date, 'MMM dd, yyyy')} • {activity.user}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <IndianRupee className="h-3 w-3 text-muted-foreground mr-1" />
                <span className="font-medium">{activity.amount.toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {activities.length > 0 && (
        <button className="w-full mt-4 text-center text-sm text-primary font-medium py-2 hover:bg-primary/5 rounded-md transition-colors">
          View All Activity
        </button>
      )}
    </CustomCard>
  );
};

export default RecentActivity;
