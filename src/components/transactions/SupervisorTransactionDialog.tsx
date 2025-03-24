import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SupervisorTransactionForm } from './SupervisorTransactionForm';

interface SupervisorTransactionDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function SupervisorTransactionDialog({
  trigger,
  onSuccess,
}: SupervisorTransactionDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full">
            Advance Paid to Supervisor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Supervisor Transaction</DialogTitle>
        </DialogHeader>
        <SupervisorTransactionForm onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
} 