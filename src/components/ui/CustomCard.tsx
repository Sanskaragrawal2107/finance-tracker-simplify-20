
import React from 'react';
import { cn } from '@/lib/utils';

interface CustomCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  glass?: boolean;
  variant?: 'default' | 'primary' | 'secondary';
  onClick?: () => void;
}

const CustomCard: React.FC<CustomCardProps> = ({ 
  children, 
  className,
  hoverEffect = false,
  glass = false,
  variant = 'default',
  onClick
}) => {
  return (
    <div 
      className={cn(
        "rounded-lg p-6 shadow-subtle border bg-white animate-scale-in",
        glass && "glass-panel",
        hoverEffect && "hover-card",
        variant === 'primary' && "bg-primary text-primary-foreground",
        variant === 'secondary' && "bg-secondary text-secondary-foreground",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default CustomCard;
