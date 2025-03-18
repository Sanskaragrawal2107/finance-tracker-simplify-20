
import React, { useState } from 'react';
import { Expense, Advance, FundsReceived, Invoice, ExpenseCategory, AdvancePurpose, RecipientType, UserRole } from '@/lib/types';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface SiteDetailTransactionsProps {
  expenses: Expense[];
  advances: Advance[];
  fundsReceived: FundsReceived[];
  invoices: Invoice[];
  userRole: UserRole;
  onAddExpense: () => void;
  onAddAdvance: () => void;
  onAddFunds: () => void;
  onDeleteExpense?: (id: string) => void;
  onDeleteAdvance?: (id: string) => void;
  onDeleteFundsReceived?: (id: string) => void;
  onEditExpense?: (expense: Expense) => void;
  onEditAdvance?: (advance: Advance) => void;
  onEditFundsReceived?: (funds: FundsReceived) => void;
}

const SiteDetailTransactions: React.FC<SiteDetailTransactionsProps> = ({
  expenses,
  advances,
  fundsReceived,
  invoices,
  userRole,
  onAddExpense,
  onAddAdvance,
  onAddFunds,
  onDeleteExpense,
  onDeleteAdvance,
  onDeleteFundsReceived,
  onEditExpense,
  onEditAdvance,
  onEditFundsReceived
}) => {
  const [activeTab, setActiveTab] = useState('expenses');
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = userRole === UserRole.ADMIN;

  const filteredExpenses = expenses.filter(expense => 
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAdvances = advances.filter(advance => 
    advance.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    advance.purpose.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFunds = fundsReceived.filter(fund => 
    fund.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fund.method?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDeleteExpense = (id: string) => {
    if (onDeleteExpense) {
      onDeleteExpense(id);
    } else {
      console.log('Delete expense handler not provided for ID:', id);
    }
  };

  const handleDeleteAdvance = (id: string) => {
    if (onDeleteAdvance) {
      onDeleteAdvance(id);
    } else {
      console.log('Delete advance handler not provided for ID:', id);
    }
  };

  const handleDeleteFunds = (id: string) => {
    if (onDeleteFundsReceived) {
      onDeleteFundsReceived(id);
    } else {
      console.log('Delete funds handler not provided for ID:', id);
    }
  };

  return (
    <div className="w-full mt-6">
      <Tabs defaultValue="expenses" onValueChange={setActiveTab} value={activeTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <TabsList className="h-10">
            <TabsTrigger value="expenses" className="text-sm">Expenses</TabsTrigger>
            <TabsTrigger value="advances" className="text-sm">Advances</TabsTrigger>
            <TabsTrigger value="funds" className="text-sm">Funds Received</TabsTrigger>
            <TabsTrigger value="invoices" className="text-sm">Invoices</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-8"
              />
            </div>
            
            {activeTab === 'expenses' && (
              <Button size="sm" onClick={onAddExpense}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            )}
            {activeTab === 'advances' && (
              <Button size="sm" onClick={onAddAdvance}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            )}
            {activeTab === 'funds' && (
              <Button size="sm" onClick={onAddFunds}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            )}
          </div>
        </div>
        
        <TabsContent value="expenses" className="mt-2">
          <div className="bg-white rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {format(expense.date, 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{expense.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">₹{expense.amount.toLocaleString()}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {onEditExpense && (
                                <Button variant="ghost" size="icon" onClick={() => onEditExpense(expense)}>
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              )}
                              {onDeleteExpense && (
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(expense.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="px-4 py-6 text-center text-sm text-gray-500">
                        No expenses found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="advances" className="mt-2">
          <div className="bg-white rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Recipient</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Purpose</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAdvances.length > 0 ? (
                    filteredAdvances.map((advance) => (
                      <tr key={advance.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {format(advance.date, 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{advance.recipientName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            {advance.recipientType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{advance.purpose}</td>
                        <td className="px-4 py-3 text-sm font-medium">₹{advance.amount.toLocaleString()}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {onEditAdvance && (
                                <Button variant="ghost" size="icon" onClick={() => onEditAdvance(advance)}>
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              )}
                              {onDeleteAdvance && (
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteAdvance(advance.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-center text-sm text-gray-500">
                        No advances found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="funds" className="mt-2">
          <div className="bg-white rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Reference</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Method</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredFunds.length > 0 ? (
                    filteredFunds.map((fund) => (
                      <tr key={fund.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {format(fund.date, 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fund.reference || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {fund.method ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              {fund.method}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">₹{fund.amount.toLocaleString()}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {onEditFundsReceived && (
                                <Button variant="ghost" size="icon" onClick={() => onEditFundsReceived(fund)}>
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              )}
                              {onDeleteFundsReceived && (
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteFunds(fund.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="px-4 py-6 text-center text-sm text-gray-500">
                        No funds received found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="invoices" className="mt-2">
          <div className="bg-white rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Invoice #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Vendor</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Material</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {format(invoice.date, 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{invoice.invoiceNumber || invoice.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{invoice.partyName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{invoice.material}</td>
                        <td className="px-4 py-3 text-sm font-medium">₹{invoice.netAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.paymentStatus === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {invoice.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                        No invoices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SiteDetailTransactions;
