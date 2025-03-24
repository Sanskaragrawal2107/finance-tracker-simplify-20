import React from 'react';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionHistory } from '@/components/transactions/TransactionHistory';
import { SupervisorTransactionForm } from '@/components/transactions/SupervisorTransactionForm';
import { SupervisorTransactionHistory } from '@/components/transactions/SupervisorTransactionHistory';
import { useAuth } from '@/hooks/use-auth';

interface TransactionsPageProps {
  params: {
    siteId: string;
  };
}

export default function TransactionsPage({ params }: TransactionsPageProps) {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground">
          Add new transactions and view transaction history
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4">Add New Transaction</h3>
          <TransactionForm siteId={params.siteId} />
        </div>

        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4">Transaction History</h3>
          <TransactionHistory siteId={params.siteId} />
        </div>

        {isSupervisor && (
          <>
            <div className="rounded-lg border p-6">
              <h3 className="text-lg font-medium mb-4">Supervisor Transactions</h3>
              <SupervisorTransactionForm />
            </div>

            <div className="rounded-lg border p-6">
              <h3 className="text-lg font-medium mb-4">Supervisor Transaction History</h3>
              <SupervisorTransactionHistory siteId={params.siteId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
} 