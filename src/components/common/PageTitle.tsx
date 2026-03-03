
import React from 'react';
import { cn } from '@/lib/utils';

interface PageTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

const PageTitle: React.FC<PageTitleProps> = ({
  title,
  subtitle,
  className,
}) => {
  return (
    <div className={cn('animate-fade-up', className)}>
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 rounded-full bg-primary" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
      </div>
      {subtitle && (
        <p className="mt-1 ml-4 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
};

export default PageTitle;
