import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SupervisorTransactionHistory } from './SupervisorTransactionHistory';

interface SupervisorTransactionListProps {
  siteId?: string;
  title?: string;
  description?: string;
}

export function SupervisorTransactionList({
  siteId,
  title = 'Supervisor-to-Supervisor Transactions',
  description = 'View all transactions between supervisors',
}: SupervisorTransactionListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SupervisorTransactionHistory siteId={siteId} />
      </CardContent>
    </Card>
  );
} 