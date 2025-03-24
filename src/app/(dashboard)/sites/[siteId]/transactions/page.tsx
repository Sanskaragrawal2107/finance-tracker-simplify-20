
import React from 'react';
import TransactionForm from '@/components/transactions/TransactionForm';
import { useParams } from 'react-router-dom';

const TransactionsPage = () => {
  const { siteId } = useParams<{ siteId: string }>();

  return (
    <div>
      <h1>Site Transactions</h1>
      {siteId && <TransactionForm siteId={siteId} />}
    </div>
  );
};

export default TransactionsPage;
