import React from 'react';
import { SupervisorTransactionDialog } from '@/components/transactions/SupervisorTransactionDialog';
import { SupervisorTransactionList } from '@/components/transactions/SupervisorTransactionList';
import { SiteFinancialSummary } from '@/components/sites/SiteFinancialSummary';
import { useAuth } from '@/hooks/use-auth';

export default function AdminSupervisorSitesPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Supervisor Sites</h2>
        <p className="text-muted-foreground">
          Manage sites and view financial summaries
        </p>
      </div>

      <div className="grid gap-6">
        <div className="flex justify-end">
          <SupervisorTransactionDialog />
        </div>

        <SiteFinancialSummary />

        <SupervisorTransactionList
          title="Supervisor-to-Supervisor Transactions"
          description="View all transactions between supervisors"
        />
      </div>
    </div>
  );
} 