// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { MaterialItem, BankDetails, BalanceSummary } from '@/lib/types';

const SUPABASE_URL = "https://bpyzpnioddmzniuikbsn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweXpwbmlvZGRtem5pdWlrYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODE0MzksImV4cCI6MjA1NzM1NzQzOX0.UEdE77tebNbCdJkmX0RyNpKVp3mWhTL-hekMVNcPuIg";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Function to refresh the schema cache
export const refreshSchemaCache = async () => {
  try {
    // Force a refresh of the schema cache by making a simple query
    // This ensures that the client is aware of any schema changes
    await supabase.from('site_invoices').select('id').limit(1);
    await supabase.from('funds_received').select('id').limit(1);
    
    console.log('Schema cache refreshed successfully');
    return true;
  } catch (error) {
    console.error('Error refreshing schema cache:', error);
    return false;
  }
};

// Initialize the schema cache refresh
refreshSchemaCache();

// Function to calculate total paid invoices for a site
export const calculatePaidInvoicesTotalForSite = async (siteId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('site_invoices')
      .select('net_amount')
      .eq('site_id', siteId)
      .eq('payment_status', 'paid');
      
    if (error) {
      console.error('Error fetching paid invoices:', error);
      throw error;
    }
    
    // Sum all net_amount values
    const total = data?.reduce((sum, invoice) => sum + (Number(invoice.net_amount) || 0), 0) || 0;
    return total;
  } catch (error) {
    console.error('Error calculating paid invoices total:', error);
    return 0;
  }
};

// Function to calculate total funds received for a site
export const calculateFundsReceivedForSite = async (siteId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('funds_received')
      .select('amount')
      .eq('site_id', siteId);
      
    if (error) {
      console.error('Error fetching funds received:', error);
      throw error;
    }
    
    // Sum all amount values
    const total = data?.reduce((sum, fund) => sum + (Number(fund.amount) || 0), 0) || 0;
    return total;
  } catch (error) {
    console.error('Error calculating funds received total:', error);
    return 0;
  }
};

// Function to fetch site invoices
export const fetchSiteInvoices = async (siteId: string) => {
  try {
    console.log('Fetching invoices for site ID:', siteId);
    const { data, error } = await supabase
      .from('site_invoices')
      .select('*')
      .eq('site_id', siteId)
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching site invoices:', error);
      throw error;
    }

    console.log('Raw invoice data from DB:', data);
    console.log('Number of invoices found:', data?.length || 0);
    
    // Transform the data to match the expected Invoice format
    return data.map(invoice => {
      try {
        // Parse material_items as MaterialItem[]
        let materialItems: any[] = [];
        if (invoice.material_items) {
          try {
            // Handle case where it might be a string or already parsed JSON
            if (typeof invoice.material_items === 'string') {
              materialItems = JSON.parse(invoice.material_items);
            } else if (Array.isArray(invoice.material_items)) {
              materialItems = invoice.material_items;
            } else if (typeof invoice.material_items === 'object') {
              materialItems = [invoice.material_items];
            }
          } catch (e) {
            console.error('Error parsing material items:', e, invoice.material_items);
          }
        }

        // Parse bank_details as BankDetails
        let bankDetails: any = {
          bankName: '',
          accountNumber: '',
          ifscCode: ''
        };
        
        if (invoice.bank_details) {
          try {
            // Handle case where it might be a string or already parsed JSON
            if (typeof invoice.bank_details === 'string') {
              bankDetails = JSON.parse(invoice.bank_details);
            } else if (typeof invoice.bank_details === 'object') {
              bankDetails = invoice.bank_details;
            }
          } catch (e) {
            console.error('Error parsing bank details:', e, invoice.bank_details);
          }
        }

        return {
          id: invoice.id,
          date: new Date(invoice.date),
          partyId: invoice.party_id,
          partyName: invoice.party_name,
          material: invoice.material,
          quantity: Number(invoice.quantity),
          rate: Number(invoice.rate),
          gstPercentage: Number(invoice.gst_percentage),
          grossAmount: Number(invoice.gross_amount),
          netAmount: Number(invoice.net_amount),
          materialItems,
          bankDetails,
          billUrl: invoice.bill_url,
          paymentStatus: invoice.payment_status,
          createdBy: invoice.created_by,
          createdAt: new Date(invoice.created_at),
          approverType: invoice.approver_type,
          siteId: invoice.site_id,
          vendorName: invoice.party_name,  
          invoiceNumber: invoice.id.slice(0, 8),
          amount: Number(invoice.net_amount),
          status: invoice.payment_status
        };
      } catch (error) {
        console.error('Error processing invoice:', error, invoice);
        // Return a minimal valid invoice object if parsing fails
        return {
          id: invoice.id,
          date: new Date(invoice.date || new Date()),
          partyId: invoice.party_id || '',
          partyName: invoice.party_name || '',
          material: invoice.material || '',
          quantity: Number(invoice.quantity) || 0,
          rate: Number(invoice.rate) || 0,
          gstPercentage: Number(invoice.gst_percentage) || 0,
          grossAmount: Number(invoice.gross_amount) || 0,
          netAmount: Number(invoice.net_amount) || 0,
          materialItems: [],
          bankDetails: {
            bankName: '',
            accountNumber: '',
            ifscCode: ''
          },
          paymentStatus: invoice.payment_status || 'pending',
          createdBy: invoice.created_by || '',
          createdAt: new Date(invoice.created_at || new Date()),
          siteId: invoice.site_id || '',
          status: invoice.payment_status || 'pending',
          vendorName: invoice.party_name || '',
          invoiceNumber: invoice.id.slice(0, 8),
          amount: Number(invoice.net_amount) || 0,
          approverType: invoice.approver_type || ''
        };
      }
    });
  } catch (error) {
    console.error('Error processing site invoices:', error);
    return [];
  }
};

// Function to fetch site expenses
export const fetchSiteExpenses = async (siteId: string) => {
  try {
    console.log('Fetching expenses for site ID:', siteId);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('site_id', siteId)
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching site expenses:', error);
      throw error;
    }

    console.log('Raw expenses data from DB:', data);
    console.log('Number of expenses found:', data?.length || 0);
    
    return data;
  } catch (error) {
    console.error('Error fetching site expenses:', error);
    return [];
  }
};

// Function to fetch site advances
export const fetchSiteAdvances = async (siteId: string) => {
  try {
    console.log('Fetching advances for site ID:', siteId);
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .eq('site_id', siteId)
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching site advances:', error);
      throw error;
    }

    console.log('Raw advances data from DB:', data);
    console.log('Number of advances found:', data?.length || 0);
    
    return data;
  } catch (error) {
    console.error('Error fetching site advances:', error);
    return [];
  }
};

// Function to fetch site funds received
export const fetchSiteFundsReceived = async (siteId: string) => {
  try {
    console.log('Fetching funds received for site ID:', siteId);
    const { data, error } = await supabase
      .from('funds_received')
      .select('*')
      .eq('site_id', siteId)
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching site funds received:', error);
      throw error;
    }

    console.log('Raw funds received data from DB:', data);
    console.log('Number of funds received found:', data?.length || 0);
    
    return data;
  } catch (error) {
    console.error('Error fetching site funds received:', error);
    return [];
  }
};

// Function to check if user has admin role
export const checkAdminRole = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
    
    return data?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
};

// Function to check if user has supervisor or admin role
export const checkSupervisorOrAdminRole = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error checking role:', error);
      return false;
    }
    
    return data?.role === 'admin' || data?.role === 'supervisor';
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
};

// Function to delete a transaction with role check
export const deleteTransaction = async (transactionId: string, userId: string, table: string) => {
  try {
    console.log(`Attempting to delete transaction ${transactionId} from table ${table}`);
    const isAdmin = await checkAdminRole(userId);
    
    if (!isAdmin) {
      throw new Error('You do not have permission to delete transactions. Admin access required.');
    }
    
    // Validate the table name to ensure it's one of our valid tables
    const validTables = ['expenses', 'advances', 'funds_received', 'site_invoices'];
    if (!validTables.includes(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }
    
    const { error, data } = await supabase
      .from(table)
      .delete()
      .eq('id', transactionId)
      .select();
      
    if (error) {
      console.error(`Error deleting transaction from ${table}:`, error);
      throw error;
    }
    
    console.log(`Successfully deleted transaction ${transactionId} from table ${table}`, data);
    return { success: true, message: 'Transaction deleted successfully' };
  } catch (error) {
    console.error(`Error in deleteTransaction function:`, error);
    throw error;
  }
};

// Function to update a transaction with role check
export const updateTransaction = async (transactionId: string, updates: any, userId: string, table: string) => {
  const isAdmin = await checkAdminRole(userId);
  
  if (!isAdmin) {
    throw new Error('You do not have permission to update transactions. Admin access required.');
  }
  
  const { error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', transactionId);
    
  if (error) {
    console.error(`Error updating transaction in ${table}:`, error);
    throw error;
  }
  
  return { success: true, message: 'Transaction updated successfully' };
};

// Function to delete an expense
export const deleteExpense = async (expenseId: string, userId: string) => {
  return deleteTransaction(expenseId, userId, 'expenses');
};

// Function to update an expense
export const updateExpense = async (expenseId: string, updates: any, userId: string) => {
  return updateTransaction(expenseId, updates, userId, 'expenses');
};

// Function to delete an advance
export const deleteAdvance = async (advanceId: string, userId: string) => {
  return deleteTransaction(advanceId, userId, 'advances');
};

// Function to update an advance
export const updateAdvance = async (advanceId: string, updates: any, userId: string) => {
  return updateTransaction(advanceId, updates, userId, 'advances');
};

// Function to delete a funds received record
export const deleteFundsReceived = async (fundsReceivedId: string, userId: string) => {
  try {
    console.log(`Attempting to delete funds received record: ${fundsReceivedId}`);
    return await deleteTransaction(fundsReceivedId, userId, 'funds_received');
  } catch (error) {
    console.error('Error in deleteFundsReceived:', error);
    throw error;
  }
};

// Function to update a funds received record
export const updateFundsReceived = async (fundsReceivedId: string, updates: any, userId: string) => {
  return updateTransaction(fundsReceivedId, updates, userId, 'funds_received');
};

// Function to delete an invoice
export const deleteInvoice = async (invoiceId: string, userId: string) => {
  return deleteTransaction(invoiceId, userId, 'site_invoices');
};

// Function to update an invoice
export const updateInvoice = async (invoiceId: string, updates: any, userId: string) => {
  return updateTransaction(invoiceId, updates, userId, 'site_invoices');
};

// Function to fetch site financial summary
export const fetchSiteFinancialSummary = async (siteId: string): Promise<BalanceSummary | null> => {
  try {
    console.log('Fetching financial summary for site ID:', siteId);
    
    // Fetch the summary data from the site_financial_summary table
    const { data: summaryData, error: summaryError } = await supabase
      .from('site_financial_summary')
      .select('*')
      .eq('site_id', siteId)
      .single();
      
    if (summaryError) {
      console.error('Error fetching site financial summary:', summaryError);
      return null;
    }

    console.log('Site financial summary from DB:', summaryData);
    
    if (!summaryData) return null;
    
    // Transform the data to match the expected BalanceSummary format
    return {
      fundsReceived: Number(summaryData.funds_received) || 0,
      totalExpenditure: Number(summaryData.total_expenses_paid) || 0,
      totalAdvances: Number(summaryData.total_advances_paid) || 0,
      debitsToWorker: Number(summaryData.debit_to_worker) || 0,
      invoicesPaid: Number(summaryData.invoices_paid) || 0,
      pendingInvoices: 0, // This is not stored in the summary table, would need additional query
      totalBalance: Number(summaryData.current_balance) || 0
    };
  } catch (error) {
    console.error('Error processing site financial summary:', error);
    return null;
  }
};
