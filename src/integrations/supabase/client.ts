
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { MaterialItem, BankDetails } from '@/lib/types';

const SUPABASE_URL = "https://bpyzpnioddmzniuikbsn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweXpwbmlvZGRtem5pdWlrYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODE0MzksImV4cCI6MjA1NzM1NzQzOX0.UEdE77tebNbCdJkmX0RyNpKVp3mWhTL-hekMVNcPuIg";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Helper function for incrementing values
if (!supabase.rpc) {
  // Create a placeholder rpc function if it doesn't exist
  // This will be replaced by the real implementation when Supabase is initialized
  console.warn("RPC function not available, using fallback implementation");
}

// RPC helper to increment a column value
export const incrementValue = async (value: number, rowId: string, columnName: string) => {
  try {
    // Using direct update instead of rpc
    const { data, error } = await supabase
      .from('sites')
      .update({ [columnName]: value })
      .eq('id', rowId)
      .select();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error incrementing value:", error);
    throw error;
  }
};

// Function to fetch site invoices
export const fetchSiteInvoices = async (siteId: string) => {
  try {
    const { data, error } = await supabase
      .from('site_invoices')
      .select('*')
      .eq('site_id', siteId);
      
    if (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    return data.map(invoice => {
      // Parse material_items from JSON
      let parsedMaterialItems: MaterialItem[] = [];
      try {
        if (invoice.material_items) {
          parsedMaterialItems = (typeof invoice.material_items === 'string') 
            ? JSON.parse(invoice.material_items) 
            : (invoice.material_items as unknown as MaterialItem[]);
        }
      } catch (e) {
        console.error('Error parsing material items:', e);
      }
      
      // Parse bank_details from JSON
      let parsedBankDetails: BankDetails = {
        accountNumber: '',
        bankName: '',
        ifscCode: ''
      };
      try {
        if (invoice.bank_details) {
          parsedBankDetails = (typeof invoice.bank_details === 'string')
            ? JSON.parse(invoice.bank_details)
            : (invoice.bank_details as unknown as BankDetails);
        }
      } catch (e) {
        console.error('Error parsing bank details:', e);
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
        materialItems: parsedMaterialItems,
        bankDetails: parsedBankDetails,
        billUrl: invoice.bill_url,
        paymentStatus: invoice.payment_status as any,
        createdBy: invoice.created_by || '',
        createdAt: new Date(invoice.created_at),
        approverType: invoice.approver_type as "ho" | "supervisor" || "ho",
        siteId: invoice.site_id || ''
      };
    });
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
